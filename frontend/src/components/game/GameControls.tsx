'use client';

import { useGame } from '@/context';
import { useGameActions } from '@/hooks';

export function GameControls() {
  const { gameState, uiState, isCurrentPlayerActive } = useGame();
  const { endTurn } = useGameActions();
  
  const isPlayerTurn = isCurrentPlayerActive();
  const isProcessing = uiState.isProcessing;
  
  return (
    <div className="flex flex-col gap-2 w-40">
      {/* End turn button */}
      <button
        className={`
          py-3 px-6 
          rounded-lg 
          font-bold 
          text-white 
          ${isPlayerTurn && !isProcessing 
            ? 'bg-blue-600 hover:bg-blue-700 transition-colors' 
            : 'bg-gray-700 cursor-not-allowed'}
        `}
        onClick={() => isPlayerTurn && !isProcessing && endTurn()}
        disabled={!isPlayerTurn || isProcessing}
      >
        End Turn
      </button>
      
      {/* Game phase display */}
      <div className="text-center text-xs uppercase font-bold">
        Phase: {gameState.phase}
      </div>
      
      {/* Turn counter */}
      <div className="text-center text-xs">
        Turn {gameState.turnNumber}
      </div>
      
      {/* Processing indicator */}
      {isProcessing && (
        <div className="text-center text-xs text-yellow-400 animate-pulse">
          Processing...
        </div>
      )}
    </div>
  );
}