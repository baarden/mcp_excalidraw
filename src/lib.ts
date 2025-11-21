// Re-export client components from source for external use
// Note: Consumers must have React and @excalidraw/excalidraw as peer dependencies
// and must build this with their own bundler (Vite, webpack, etc.)
export { ExcalidrawClient } from '../frontend/src/ExcalidrawClient';
export type {
  ExcalidrawClientProps,
  ServerElement,
  WebSocketMessage,
  ApiResponse,
  SyncStatus
} from '../frontend/src/ExcalidrawClient';
