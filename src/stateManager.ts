import type { ServerElement } from './types.js';

/**
 * Interface for managing Excalidraw element storage.
 * Supports optional room-based isolation for multi-room scenarios.
 */
export interface StateManager {
  /**
   * Get all elements for a room
   * @param roomId - Optional room identifier. If not provided, returns global elements.
   * @returns Map of element IDs to ServerElement objects
   */
  getElements(roomId?: string): Map<string, ServerElement>;

  /**
   * Get a specific element by ID
   * @param elementId - The element identifier
   * @param roomId - Optional room identifier
   * @returns The element if found, undefined otherwise
   */
  getElement(elementId: string, roomId?: string): ServerElement | undefined;

  /**
   * Store or update an element
   * @param elementId - The element identifier
   * @param element - The element to store
   * @param roomId - Optional room identifier
   */
  setElement(elementId: string, element: ServerElement, roomId?: string): void;

  /**
   * Delete an element
   * @param elementId - The element identifier
   * @param roomId - Optional room identifier
   * @returns true if the element was deleted, false if it didn't exist
   */
  deleteElement(elementId: string, roomId?: string): boolean;

  /**
   * Clear all elements for a room
   * @param roomId - Optional room identifier. If not provided, clears global elements.
   */
  clearElements(roomId?: string): void;
}

/**
 * Default implementation that maintains a single global room.
 * All roomId parameters are ignored - all clients share the same element state.
 */
export class SingleRoomStateManager implements StateManager {
  private elements: Map<string, ServerElement>;

  constructor() {
    this.elements = new Map<string, ServerElement>();
  }

  getElements(_roomId?: string): Map<string, ServerElement> {
    return this.elements;
  }

  getElement(elementId: string, _roomId?: string): ServerElement | undefined {
    return this.elements.get(elementId);
  }

  setElement(elementId: string, element: ServerElement, _roomId?: string): void {
    this.elements.set(elementId, element);
  }

  deleteElement(elementId: string, _roomId?: string): boolean {
    return this.elements.delete(elementId);
  }

  clearElements(_roomId?: string): void {
    this.elements.clear();
  }
}
