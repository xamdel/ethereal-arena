'use client';

import { useGame } from '@/context';
import { useGameActions } from '@/hooks';
import { PlayerStats } from '../players';
import { Hand } from '../cards';
import { GameControls } from './GameControls';
import { GameLog } from './GameLog';
import { TurnIndicator } from './TurnIndicator';
import { EffectDisplay } from './EffectDisplay';

export function GameBoard() {
  const { gameState, getCurrentPlayer, getOpponent } = useGame();
  
  const currentPlayer = getCurrentPlayer();
  const opponent = getOpponent();
  
  if (!currentPlayer || !opponent) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Loading game...</h2>
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="container mx-auto h-full flex flex-col">
        {/* Top section - opponent stats */}
        <div className="flex justify-between pt-6 px-8">
          <PlayerStats player={opponent} isOpponent={true} />
          <div className="flex-1"></div>
          <TurnIndicator />
        </div>
        
        {/* Middle section - game board */}
        <div className="flex-1 flex justify-center items-center relative my-4">
          {/* Effect visualization area */}
          <div className="w-full h-full flex justify-center items-center">
            <EffectDisplay />
          </div>
          
          {/* Game log (floating on right side) */}
          <div className="absolute right-8 top-0 bottom-0 w-72">
            <GameLog />
          </div>
        </div>
        
        {/* Bottom section - player's hand and stats */}
        <div className="mb-4 px-8">
          <div className="flex justify-between mb-2">
            <PlayerStats player={currentPlayer} />
            <div className="flex-1"></div>
            <GameControls />
          </div>
          
          {/* Player's hand */}
          <Hand />
        </div>
      </div>
    </div>
  );
}