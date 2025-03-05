'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/types/game';
import { CardDisplay } from '@/components/cards/CardDisplay';
import { CardDetail } from '@/components/cards/CardDetail';

interface DraftScreenProps {
  cards: Card[];
  onDraftComplete: (selectedCardIds: string[]) => void;
  maxSelections?: number;
}

export const DraftScreen: React.FC<DraftScreenProps> = ({ 
  cards,
  onDraftComplete,
  maxSelections = 5
}) => {
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [detailCardId, setDetailCardId] = useState<string | null>(null);
  const [isConfirmDisabled, setIsConfirmDisabled] = useState(true);

  // Check if confirm button should be enabled
  useEffect(() => {
    setIsConfirmDisabled(selectedCardIds.length !== maxSelections);
  }, [selectedCardIds, maxSelections]);

  // Handle card selection/deselection
  const handleCardClick = (cardId: string) => {
    if (selectedCardIds.includes(cardId)) {
      // Deselect the card
      setSelectedCardIds(prev => prev.filter(id => id !== cardId));
    } else if (selectedCardIds.length < maxSelections) {
      // Select the card if we haven't reached max selections
      setSelectedCardIds(prev => [...prev, cardId]);
    }
  };

  // Handle card detail view
  const handleCardDoubleClick = (cardId: string) => {
    setDetailCardId(cardId);
  };

  // Close detail view
  const closeDetail = () => {
    setDetailCardId(null);
  };

  // Complete the draft
  const confirmSelection = () => {
    if (selectedCardIds.length === maxSelections) {
      onDraftComplete(selectedCardIds);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-6">Choose Your Starting Cards</h1>
        
        <div className="text-center mb-8">
          <p className="mb-2">Select {maxSelections} cards to form your starting hand.</p>
          <p className="text-sm text-gray-400">
            Selected: {selectedCardIds.length}/{maxSelections}
          </p>
        </div>
        
        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {cards.map((card) => (
            <div 
              key={card.id}
              className={`cursor-pointer transform transition-all duration-200 ${
                selectedCardIds.includes(card.id) 
                  ? 'scale-105 ring-2 ring-purple-500 shadow-lg' 
                  : 'hover:scale-105'
              }`}
              onClick={() => handleCardClick(card.id)}
              onDoubleClick={() => handleCardDoubleClick(card.id)}
            >
              <CardDisplay 
                card={card}
                isSelected={selectedCardIds.includes(card.id)} 
                isPlayable={selectedCardIds.length < maxSelections || selectedCardIds.includes(card.id)}
              />
              
              {/* Selection indicator */}
              {selectedCardIds.includes(card.id) && (
                <div className="absolute top-2 right-2 bg-purple-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                  {selectedCardIds.indexOf(card.id) + 1}
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Confirm button */}
        <div className="flex justify-center">
          <button
            onClick={confirmSelection}
            disabled={isConfirmDisabled}
            className={`px-6 py-3 rounded-lg font-semibold ${
              isConfirmDisabled
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-500 active:bg-purple-700'
            }`}
          >
            {isConfirmDisabled 
              ? `Select ${maxSelections - selectedCardIds.length} More Cards`
              : 'Confirm Selection'
            }
          </button>
        </div>
      </div>
      
      {/* Card detail modal */}
      {detailCardId && (
        <CardDetail
          card={cards.find(card => card.id === detailCardId)!}
          onClose={closeDetail}
        />
      )}
    </div>
  );
};