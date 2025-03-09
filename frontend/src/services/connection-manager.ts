/**
 * Connection manager for WebSocket connections
 * Provides centralized connection state management and event handling
 */

import { Socket } from 'socket.io-client';
import { BehaviorSubject } from 'rxjs';

export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';

class ConnectionManager {
  private connectionState$ = new BehaviorSubject<ConnectionState>('disconnected');
  private reconnectAttempts = 0;
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  
  // Observable for connection state changes
  getConnectionState() {
    return this.connectionState$.asObservable();
  }
  
  getCurrentState(): ConnectionState {
    return this.connectionState$.value;
  }
  
  setSocket(socket: Socket) {
    this.socket = socket;
    this.setupSocketListeners();
  }
  
  private setupSocketListeners() {
    if (!this.socket) return;
    
    this.socket.on('connect', () => {
      this.connectionState$.next('connected');
      this.reconnectAttempts = 0;
      console.log('✅ Connected to game server via WebSocket');
    });
    
    this.socket.on('disconnect', () => {
      this.connectionState$.next('disconnected');
      console.log('Disconnected from game server');
    });
    
    this.socket.on('connect_error', () => {
      if (this.connectionState$.value !== 'reconnecting') {
        this.connectionState$.next('reconnecting');
        console.log('Connection error, attempting to reconnect...');
      }
    });
  }
  
  // Centralized event registration
  addEventListener<T>(event: string, callback: (data: T) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
    
    // Actually register with socket
    if (this.socket) {
      this.socket.on(event, callback as any);
    }
    
    return () => this.removeEventListener(event, callback);
  }
  
  removeEventListener(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
    if (this.socket) {
      this.socket.off(event, callback as any);
    }
  }
  
  clearEventListeners() {
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach(callback => {
        if (this.socket) {
          this.socket.off(event, callback as any);
        }
      });
      callbacks.clear();
    });
    this.listeners.clear();
  }
}

// Export singleton instance
export const connectionManager = new ConnectionManager();