
'use client';

import { useState, useEffect } from 'react';
import { GameBoard } from '@/components/game';
import { useGameActions } from '@/hooks';
import { LoadingSpinner, Notification, SplashScreen, DraftScreen } from '@/components/ui';
import { useGame } from '@/context';
import { ActionType } from '@/types';

export default function Home() {
  const { gameState, uiState, dispatchUI, getCurrentPlayer } = useGame();
  const { initGame, selectInitialCards } = useGameActions();
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  
  // Function to start a new game with the real backend
  const handleNewGame = () => {
    setIsCreatingGame(true);
    
    // Initialize a single player game with the real backend (false = don't use mock data)
    initGame(true, false)
      .catch(error => {
        console.error("Error starting game:", error);
        dispatchUI({ 
          type: 'SET_ERROR', 
          payload: { message: 'Failed to create a new game. Please try again.' } 
        });
      })
      .finally(() => {
        setIsCreatingGame(false);
      });
  };
  
  // Handle draft completion
  const handleDraftComplete = (selectedCardIds: string[]) => {
    console.log('Draft completed, selected cards:', selectedCardIds);
    selectInitialCards(selectedCardIds);
  };
  
  // Automatically process effects in the queue
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

  // If no game is active, show the splash screen
  if (!gameState.id) {
    return <SplashScreen onNewGame={handleNewGame} isLoading={isCreatingGame} />;
  }
  
  // Game is initializing or loading
  if (isCreatingGame || uiState.isProcessing) {
    return (
      <div className="h-screen bg-gray-900 text-white">
        <LoadingSpinner 
          fullscreen 
          size="large" 
          message="Preparing your mystical journey..." 
        />
      </div>
    );
  }
  
  // Check if we're in draft phase (phase is 'draw' and it's the first turn)
  const player = getCurrentPlayer();
  const isInDraftPhase = gameState.phase === 'draw' && 
                         gameState.turnNumber === 0 && 
                         player && 
                         player.hand && 
                         player.hand.length > 5;
  
  // Show draft screen if in draft phase
  if (isInDraftPhase && player) {
    return (
      <DraftScreen 
        cards={player.hand} 
        onDraftComplete={handleDraftComplete} 
        maxSelections={5}
      />
    );
  }
  
  // Game is ready, show the game board
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
