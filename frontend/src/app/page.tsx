
'use client';

import { useEffect } from 'react';
import { GameBoard } from '@/components/game';
import { useGameActions } from '@/hooks';
import { LoadingSpinner, Notification } from '@/components/ui';
import { useGame } from '@/context';
import { ActionType } from '@/types';

export default function Home() {
  const { gameState, uiState, dispatchUI } = useGame();
  const { initGame } = useGameActions();
  
  // Initialize game on first load (for testing)
  useEffect(() => {
    if (!gameState.id) {
      initGame(true, true); // Initialize single player game with mock data
    }
  }, [gameState.id, initGame]);
  
  // Automatically process effects in the queue for testing UI
  const { dispatch } = useGame();
  
  useEffect(() => {
    if (gameState.effectQueue.length > 0) {
      // Add a delay to simulate processing time
      const timer = setTimeout(() => {
        dispatchUI({ type: 'SET_PROCESSING', payload: { isProcessing: true } });
        
        // Process one effect at a time
        const action = {
          id: Math.random().toString(),
          type: ActionType.PROCESS_QUEUE,
          playerId: 'system',
          payload: {},
          timestamp: Date.now(),
          gameId: gameState.id,
          validated: true
        };
        
        // Dispatch the action
        dispatch(action);
        
        // Reset processing state after a delay
        setTimeout(() => {
          dispatchUI({ type: 'SET_PROCESSING', payload: { isProcessing: false } });
        }, 1000);
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [gameState.effectQueue, gameState.id, dispatchUI, dispatch]);
  
  // Show loading state if no game ID yet
  if (!gameState.id) {
    return (
      <div className="h-screen bg-gray-900 text-white">
        <LoadingSpinner 
          fullscreen 
          size="large" 
          message="Initializing Ethereal Arena..." 
        />
      </div>
    );
  }
  
  return (
    <>
      <GameBoard />
      
      {/* Show error message if any */}
      {uiState.errorMessage && (
        <Notification 
          message={uiState.errorMessage} 
          type="error" 
          onClose={() => dispatchUI({ type: 'SET_ERROR', payload: { message: null } })}
        />
      )}
    </>
  );
}
