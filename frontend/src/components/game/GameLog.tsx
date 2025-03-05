'use client';

import { useGame } from '@/context';
import { GameAction } from '@/types';
import { useEffect, useRef } from 'react';

// Helper function to generate log message for an action
function getLogMessage(action: GameAction): string {
  switch (action.type) {
    case 'PLAY_CARD':
      return `Player ${action.playerId} played a card`;
    case 'END_TURN':
      return `Player ${action.playerId} ended their turn`;
    case 'APPLY_EFFECT':
      return `Effect applied: ${action.payload?.type || 'Unknown'}`;
    case 'PROCESS_QUEUE':
      return 'Processing effect queue...';
    default:
      return `Action: ${action.type}`;
  }
}

export function GameLog() {
  const { gameState } = useGame();
  const logEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when log updates
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [gameState.actionHistory]);
  
  // Get last 15 actions for display
  const recentActions = [...gameState.actionHistory].slice(-15).reverse();
  
  return (
    <div className="h-full flex flex-col">
      <div className="bg-black/50 p-3 rounded-t-lg">
        <h3 className="text-lg font-bold">Game Log</h3>
      </div>
      
      {/* Scrollable log area */}
      <div className="flex-1 bg-black/30 rounded-b-lg p-3 overflow-y-auto flex flex-col-reverse">
        {recentActions.length === 0 ? (
          <div className="text-gray-500 italic text-center">No actions yet</div>
        ) : (
          <>
            {recentActions.map((action) => (
              <div key={action.id} className="mb-2 text-sm border-b border-gray-800 pb-2">
                <div className="flex justify-between">
                  <span className="font-bold">{action.type}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(action.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-gray-300 mt-1">{getLogMessage(action)}</div>
              </div>
            ))}
            <div ref={logEndRef}></div>
          </>
        )}
      </div>
    </div>
  );
}