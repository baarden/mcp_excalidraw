import React, { useState, useEffect, useRef } from 'react'
import {
  Excalidraw,
  convertToExcalidrawElements,
  CaptureUpdateAction,
  ExcalidrawImperativeAPI
} from '@excalidraw/excalidraw'
import type { ExcalidrawElement, NonDeleted, NonDeletedExcalidrawElement } from '@excalidraw/excalidraw/types/element/types'
import { convertMermaidToExcalidraw, DEFAULT_MERMAID_CONFIG } from './utils/mermaidConverter'
import type { MermaidConfig } from '@excalidraw/mermaid-to-excalidraw'

// Type definitions
type ExcalidrawAPIRefValue = ExcalidrawImperativeAPI;

interface ServerElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  backgroundColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  roughness?: number;
  opacity?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string | number;
  label?: {
    text: string;
  };
  createdAt?: string;
  updatedAt?: string;
  version?: number;
  syncedAt?: string;
  source?: string;
  syncTimestamp?: string;
  boundElements?: any[] | null;
  containerId?: string | null;
  locked?: boolean;
}

interface WebSocketMessage {
  type: string;
  element?: ServerElement;
  elements?: ServerElement[];
  elementId?: string;
  count?: number;
  timestamp?: string;
  source?: string;
  mermaidDiagram?: string;
  config?: MermaidConfig;
}

interface ApiResponse {
  success: boolean;
  elements?: ServerElement[];
  element?: ServerElement;
  count?: number;
  error?: string;
  message?: string;
}

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

// ExcalidrawClient Props
export interface ExcalidrawClientProps {
  serverUrl?: string;
  roomId?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onSync?: (count: number) => void;
  onSyncError?: (error: Error) => void;
  onMessage?: (message: WebSocketMessage) => void;
  onReady?: (api: { send: (message: unknown) => void; syncToBackend: () => Promise<void> }) => void;
  initialData?: {
    elements?: any[];
    appState?: any;
  };
}

// Helper function to clean elements for Excalidraw
const cleanElementForExcalidraw = (element: ServerElement): Partial<ExcalidrawElement> => {
  const {
    createdAt,
    updatedAt,
    version,
    syncedAt,
    source,
    syncTimestamp,
    ...cleanElement
  } = element;
  return cleanElement;
}

// Helper function to validate and fix element binding data
const validateAndFixBindings = (elements: Partial<ExcalidrawElement>[]): Partial<ExcalidrawElement>[] => {
  const elementMap = new Map(elements.map(el => [el.id!, el]));
  
  return elements.map(element => {
    const fixedElement = { ...element };
    
    // Validate and fix boundElements
    if (fixedElement.boundElements) {
      if (Array.isArray(fixedElement.boundElements)) {
        fixedElement.boundElements = fixedElement.boundElements.filter((binding: any) => {
          // Ensure binding has required properties
          if (!binding || typeof binding !== 'object') return false;
          if (!binding.id || !binding.type) return false;
          
          // Ensure the referenced element exists
          const referencedElement = elementMap.get(binding.id);
          if (!referencedElement) return false;
          
          // Validate binding type
          if (!['text', 'arrow'].includes(binding.type)) return false;
          
          return true;
        });
        
        // Remove boundElements if empty
        if (fixedElement.boundElements.length === 0) {
          fixedElement.boundElements = null;
        }
      } else {
        // Invalid boundElements format, set to null
        fixedElement.boundElements = null;
      }
    }
    
    // Validate and fix containerId
    if (fixedElement.containerId) {
      const containerElement = elementMap.get(fixedElement.containerId);
      if (!containerElement) {
        // Container doesn't exist, remove containerId
        fixedElement.containerId = null;
      }
    }
    
    return fixedElement;
  });
}

export function ExcalidrawClient(props: ExcalidrawClientProps = {}): JSX.Element {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawAPIRefValue | null>(null)
  const websocketRef = useRef<WebSocket | null>(null)
  const excalidrawAPIRef = useRef<ExcalidrawAPIRefValue | null>(null)
  const mountedRef = useRef(true)

  // Keep ref in sync with state to avoid closure issues
  excalidrawAPIRef.current = excalidrawAPI

  // Derive base URL for both HTTP and WebSocket connections
  const baseUrl = props.serverUrl || (typeof window !== 'undefined' ? window.location.origin : '')

  // Room ID path segment for multi-room support
  const roomIdPath = props.roomId ? `/${props.roomId}` : ''

  // WebSocket connection - wait for excalidrawAPI before connecting
  useEffect(() => {
    if (!excalidrawAPI) return

    mountedRef.current = true
    connectWebSocket()
    return () => {
      mountedRef.current = false
      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        websocketRef.current.close()
      }
    }
  }, [excalidrawAPI])

  const send = (message: unknown): void => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify(message))
    }
  }

  const connectWebSocket = (): void => {
    if (websocketRef.current &&
        (websocketRef.current.readyState === WebSocket.OPEN ||
         websocketRef.current.readyState === WebSocket.CONNECTING)) {
      return
    }

    // Convert HTTP(S) URL to WS(S) URL
    const protocol = baseUrl.startsWith('https') ? 'wss:' : 'ws:'
    const wsBaseUrl = baseUrl.replace(/^https?:/, protocol)
    const wsUrl = `${wsBaseUrl}${roomIdPath}`

    websocketRef.current = new WebSocket(wsUrl)
    
    websocketRef.current.onopen = () => {
      props.onConnect?.()
      props.onReady?.({ send, syncToBackend })
    }

    websocketRef.current.onmessage = (event: MessageEvent) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data)
        handleWebSocketMessage(data)
      } catch (error) {
        console.error('Error parsing WebSocket message:', error, event.data)
      }
    }

    websocketRef.current.onclose = (event: CloseEvent) => {
      props.onDisconnect?.()

      // Reconnect after 3 seconds if not a clean close and still mounted
      if (event.code !== 1000 && mountedRef.current) {
        setTimeout(connectWebSocket, 3000)
      }
    }

    websocketRef.current.onerror = (error: Event) => {
      if (mountedRef.current) {
        console.error('WebSocket error:', error)
      }
    }
  }

  const handleWebSocketMessage = async (data: WebSocketMessage): Promise<void> => {
    if (!excalidrawAPI) {
      return
    }

    try {
      const currentElements = excalidrawAPI.getSceneElements()

      switch (data.type) {
        case 'initial_elements':
          if (data.elements && data.elements.length > 0) {
            const cleanedElements = data.elements.map(cleanElementForExcalidraw)
            const validatedElements = validateAndFixBindings(cleanedElements)
            // Skip convertToExcalidrawElements - it strips bindings
            // Elements from server are already fully-formed
            excalidrawAPI.updateScene({
              elements: validatedElements as ExcalidrawElement[],
              captureUpdate: CaptureUpdateAction.NEVER
            })
          }
          break

        case 'element_created':
          if (data.element) {
            const cleanedNewElement = cleanElementForExcalidraw(data.element)
            const newElement = convertToExcalidrawElements([cleanedNewElement])
            excalidrawAPI.updateScene({
              elements: [...currentElements, ...newElement],
              captureUpdate: CaptureUpdateAction.NEVER
            })
          }
          break
          
        case 'element_updated':
          if (data.element) {
            const cleanedUpdatedElement = cleanElementForExcalidraw(data.element)
            const convertedUpdatedElement = convertToExcalidrawElements([cleanedUpdatedElement])[0]
            excalidrawAPI.updateScene({
              elements: currentElements.map(el =>
                el.id === data.element!.id ? convertedUpdatedElement : el
              ),
              captureUpdate: CaptureUpdateAction.NEVER
            })
          }
          break

        case 'element_deleted':
          if (data.elementId) {
            const filteredElements = currentElements.filter(el => el.id !== data.elementId)
            excalidrawAPI.updateScene({
              elements: filteredElements,
              captureUpdate: CaptureUpdateAction.NEVER
            })
          }
          break

        case 'elements_batch_created':
          if (data.elements) {
            const cleanedBatchElements = data.elements.map(cleanElementForExcalidraw)
            const batchElements = convertToExcalidrawElements(cleanedBatchElements)
            excalidrawAPI.updateScene({
              elements: [...currentElements, ...batchElements],
              captureUpdate: CaptureUpdateAction.NEVER
            })
          }
          break
          
        case 'elements_synced':
          // Sync confirmation already handled by HTTP response
          break

        case 'sync_status':
          break
          
        case 'mermaid_convert':
          if (data.mermaidDiagram) {
            try {
              const result = await convertMermaidToExcalidraw(data.mermaidDiagram, data.config || DEFAULT_MERMAID_CONFIG)

              if (result.error) {
                console.error('Mermaid conversion error:', result.error)
                return
              }

              if (result.elements && result.elements.length > 0) {
                const convertedElements = convertToExcalidrawElements(result.elements, { regenerateIds: false })
                excalidrawAPI.updateScene({
                  elements: convertedElements,
                  captureUpdate: CaptureUpdateAction.IMMEDIATELY
                })

                if (result.files) {
                  excalidrawAPI.addFiles(Object.values(result.files))
                }

                // Sync to backend automatically after creating elements
                await syncToBackend()
              }
            } catch (error) {
              console.error('Error converting Mermaid diagram from WebSocket:', error)
            }
          }
          break
          
        default:
          props.onMessage?.(data)
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error, data)
    }
  }

  // Data format conversion for backend
  const convertToBackendFormat = (element: ExcalidrawElement): ServerElement => {
    return {
      ...element
    } as ServerElement
  }

  // Sync function
  const syncToBackend = async (): Promise<void> => {
    if (!excalidrawAPIRef.current) {
      return
    }

    try {
      const currentElements = excalidrawAPIRef.current.getSceneElements()
      const activeElements = currentElements.filter(el => !el.isDeleted)
      const backendElements = activeElements.map(convertToBackendFormat)

      const response = await fetch(`${baseUrl}/api/elements/sync${roomIdPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          elements: backendElements,
          timestamp: new Date().toISOString()
        })
      })

      if (response.ok) {
        const result: ApiResponse = await response.json()
        props.onSync?.(result.count || 0)
      } else {
        throw new Error('Sync failed')
      }
    } catch (error) {
      props.onSyncError?.(error as Error)
    }
  }

  return (
    <Excalidraw
      excalidrawAPI={(api: ExcalidrawAPIRefValue) => setExcalidrawAPI(api)}
      initialData={props.initialData || {
        elements: [],
        appState: {
          theme: 'light',
          viewBackgroundColor: '#ffffff'
        }
      }}
    />
  )
}

// Export types for external use
export type { ServerElement, WebSocketMessage, ApiResponse, SyncStatus }