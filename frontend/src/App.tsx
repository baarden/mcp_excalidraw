import React, { useState } from 'react'
import { ExcalidrawClient } from './ExcalidrawClient'

function App(): JSX.Element {
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)

  const formatSyncTime = (time: Date | null): string => {
    if (!time) return ''
    return time.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <h1>Excalidraw Canvas</h1>
        <div className="controls">
          <div className="status">
            <div className={`status-dot ${isConnected ? 'status-connected' : 'status-disconnected'}`}></div>
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>

          {/* Sync Status */}
          {syncStatus === 'success' && (
            <span className="sync-success">✅ Synced</span>
          )}
          {syncStatus === 'error' && (
            <span className="sync-error">❌ Sync Failed</span>
          )}
          {lastSyncTime && syncStatus === 'idle' && (
            <span className="sync-time">
              Last sync: {formatSyncTime(lastSyncTime)}
            </span>
          )}
        </div>
      </div>

      {/* Canvas Container */}
      <div className="canvas-container">
        <ExcalidrawClient
          onConnect={() => setIsConnected(true)}
          onDisconnect={() => setIsConnected(false)}
          onSync={(count) => {
            setSyncStatus('success')
            setLastSyncTime(new Date())
            setTimeout(() => setSyncStatus('idle'), 2000)
            console.log(`Synced ${count} elements`)
          }}
          onSyncError={(error) => {
            setSyncStatus('error')
            console.error('Sync error:', error)
          }}
        />
      </div>
    </div>
  )
}

export default App
