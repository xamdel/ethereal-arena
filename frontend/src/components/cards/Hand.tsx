'use client';

import { useGame } from '@/context';
import { useGameActions } from '@/hooks';
import { CardDisplay } from './CardDisplay';
import { CardDetail } from './CardDetail';
import { useState } from 'react';
import { Card } from '@/types/game';

export function Hand() {
  const { gameState, uiState, getCurrentPlayer, canPlayCard } = useGame();
  const { selectCard, showCardDetail, hideCardDetail, playCard } = useGameActions();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [detailCardId, setDetailCardId] = useState<string | null>(null);
  
  const player = getCurrentPlayer();
  
  if (!player) {
    return <div className="text-center">Loading player data...</div>;
  }
  
  // Handle card click
  const handleCardClick = (cardId: string) => {
    if (uiState.isProcessing) return;
    
    // If card is already selected, play it
    if (selectedCardId === cardId) {
      playCard(cardId);
      setSelectedCardId(null);
    } else {
      // Otherwise select it
      setSelectedCardId(cardId);
      selectCard(cardId);
    }
  };
  
  // Handle double click to show detail view
  const handleCardDoubleClick = (cardId: string) => {
    setDetailCardId(cardId);
    showCardDetail(cardId);
  };
  
  // Close detail view
  const closeDetail = () => {
    setDetailCardId(null);
    hideCardDetail();
  };

  return (
    <div className="relative">
      {/* Hand container with flex layout and overlapping cards effect */}
      <div className="flex justify-center items-end space-x-[-20px] h-80 px-4">
        {player.hand.map((card: Card) => (
          <div 
            key={card.id}
            className="transform transition-transform hover:translate-y-[-20px]"
            onClick={() => handleCardClick(card.id)}
            onDoubleClick={() => handleCardDoubleClick(card.id)}
          >
            <CardDisplay
              card={card}
              isSelected={selectedCardId === card.id}
              isPlayable={canPlayCard(card.id)}
            />
          </div>
        ))}
      </div>
      
      {/* Card detail modal */}
      {detailCardId && (
        <CardDetail
          card={player.hand.find((card: Card) => card.id === detailCardId)!}
          onClose={closeDetail}
        />
      )}
    </div>
  );
}
