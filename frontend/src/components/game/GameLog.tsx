'use client';

import { useGame } from '@/context';
import { GameAction } from '@/types';
import { useEffect, useRef } from 'react';

// Helper function to generate log message for an action
function getLogMessage(action: GameAction, gameState: any): string {
  switch (action.type) {
    case 'PLAY_CARD':
      const cardId = action.payload?.cardId;
      const playerName = gameState.players[action.playerId]?.name || action.playerId;
      
      // Find the card name if possible
      let cardName = "a card";
      const player = gameState.players[action.playerId];
      if (player) {
        // Look in discard pile for the card (since it may have been played already)
        const card = player.discard.find((c: any) => c.id === cardId);
        if (card) {
          cardName = card.name;
        }
      }
      
      return `${playerName} played ${cardName}`;
      
    case 'END_TURN':
      const endingPlayerName = gameState.players[action.playerId]?.name || action.playerId;
      return `${endingPlayerName} ended their turn`;
      
    case 'SELECT_CARDS':
      return `Cards selected from draft`;
      
    case 'APPLY_EFFECT':
      const effectType = action.payload?.type || 'Unknown';
      const value = action.payload?.value;
      const target = action.payload?.target 
        ? gameState.players[action.payload.target]?.name 
        : 'Unknown';
        
      if (value !== undefined) {
        return `${effectType.charAt(0).toUpperCase() + effectType.slice(1)} ${value} applied to ${target}`;
      }
      return `${effectType.charAt(0).toUpperCase() + effectType.slice(1)} applied to ${target}`;
      
    case 'PROCESS_QUEUE':
      return 'Processing effects...';
      
    case 'GAME_INIT':
      return 'Game started';
      
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
    <div className="h-full flex flex-col drop-shadow-lg">
      <div className="bg-gray-800/90 p-3 rounded-t-lg border-b border-purple-700">
        <h3 className="text-lg font-bold text-purple-300">Game Log</h3>
      </div>
      
      {/* Scrollable log area */}
      <div className="flex-1 bg-black/80 backdrop-blur-sm rounded-b-lg p-3 overflow-y-auto flex flex-col-reverse">
        {recentActions.length === 0 ? (
          <div className="text-gray-500 italic text-center">No actions yet</div>
        ) : (
          <>
            {recentActions.map((action) => (
              <div 
                key={action.id} 
                className="mb-2 text-sm border-b border-purple-900/50 pb-2 hover:bg-purple-900/20 transition-colors duration-150 p-2 rounded"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-purple-300 text-xs uppercase tracking-wider">
                    {action.type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(action.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-gray-100 mt-1">{getLogMessage(action, gameState)}</div>
              </div>
            ))}
            <div ref={logEndRef}></div>
          </>
        )}
      </div>
    </div>
  );
}