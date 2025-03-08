'use client';

import { Card } from '@/types';
import { useGameActions } from '@/hooks';

interface CardDetailProps {
  card: Card;
  onClose: () => void;
}

export function CardDetail({ card, onClose }: CardDetailProps) {
  const { playCard } = useGameActions();

  return (
    <div 
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      {/* Card detail - clicking the card doesn't close the modal */}
      <div 
        className="relative w-80 h-120 bg-gradient-to-b from-blue-800 to-indigo-900 rounded-lg p-6 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button 
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center"
          onClick={onClose}
        >
          ✕
        </button>
        
        {/* Energy cost */}
        <div className="absolute top-4 left-4 w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold">
          {card.cost}
        </div>
        
        {/* Card name */}
        <h2 className="text-center text-2xl font-bold mt-4 mb-3">{card.name}</h2>
        
        {/* Card image/art placeholder */}
        <div className="h-36 bg-indigo-700 rounded-md mb-4 flex items-center justify-center">
          <p className="text-sm text-center px-4 italic">
            {card.art_prompt}
          </p>
        </div>
        
        {/* Base effects section */}
        <div className="mb-4">
          <h3 className="text-lg font-bold mb-2 border-b border-blue-600 pb-1">Base Effects</h3>
          <p>{card.base_effects}</p>
        </div>
        
        {/* Wildcard effect section */}
        {card.wildcard_effect && (
          <div className="mb-4">
            <h3 className="text-lg font-bold mb-2 border-b border-blue-600 pb-1">Special Effect</h3>
            <p className="italic">{card.wildcard_effect}</p>
          </div>
        )}

        {/* Flavor Text section */}
        {card.flavor_text && (
          <div className="mb-4">
            <h3 className="text-lg font-bold mb-2 border-b border-blue-600 pb-1">Flavor Text</h3>
            <p>{card.flavor_text}</p>
          </div>
        )}
        
        {/* Description section */}
        <div className="mb-8">
          <h3 className="text-lg font-bold mb-2 border-b border-blue-600 pb-1">Description</h3>
          <p>{card.description}</p>
        </div>
        
        {/* Play button */}
        <button 
          className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-md font-bold transition-colors"
          onClick={() => {
            playCard(card.id);
            onClose();
          }}
        >
          Play Card
        </button>
      </div>
    </div>
  );
}
