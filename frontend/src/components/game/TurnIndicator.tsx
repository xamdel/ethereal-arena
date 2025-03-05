'use client';

import { useGame } from '@/context';

export function TurnIndicator() {
  const { gameState, isCurrentPlayerActive } = useGame();
  
  const isPlayerTurn = isCurrentPlayerActive();
  
  // Map phase to display text
  const phaseDisplay = {
    'init': 'Initializing',
    'turnStart': 'Turn Start',
    'draw': 'Draw Phase',
    'action': 'Action Phase',
    'turnEnd': 'Turn End'
  }[gameState.phase] || gameState.phase;
  
  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div 
        className={`
          py-2 px-4 
          rounded-full 
          font-bold 
          ${isPlayerTurn 
            ? 'bg-green-600 text-white animate-pulse' 
            : 'bg-gray-700 text-gray-300'}
        `}
      >
        {isPlayerTurn ? 'Your Turn' : 'Opponent\'s Turn'}
      </div>
      
      {/* Phase indicator */}
      <div className="mt-2 text-sm font-bold uppercase">
        <span className="text-blue-400">{phaseDisplay}</span>
      </div>
      
      {/* Turn timer - would be implemented in multiplayer mode */}
      {/* 
      <div className="mt-2 w-full bg-gray-700 h-1 rounded-full overflow-hidden">
        <div className="bg-blue-500 h-full" style={{ width: '75%' }}></div>
      </div>
      */}
    </div>
  );
}