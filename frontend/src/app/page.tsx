
'use client';

import { useEffect } from 'react';
import { GameBoard } from '@/components/game';
import { useGameActions } from '@/hooks';
import { LoadingSpinner } from '@/components/ui';
import { useGame } from '@/context';

export default function Home() {
  const { gameState } = useGame();
  const { initGame } = useGameActions();
  
  // Initialize game on first load (for testing)
  useEffect(() => {
    if (!gameState.id) {
      initGame(true); // Initialize single player game
    }
  }, [gameState.id, initGame]);
  
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
  
  return <GameBoard />;
}
