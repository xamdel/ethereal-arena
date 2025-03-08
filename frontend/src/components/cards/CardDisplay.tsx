'use client';

import { Card } from '@/types';
import { useState } from 'react';
import { useGame } from '@/context';

interface CardDisplayProps {
  card: Card;
  onClick?: () => void;
  isSelected?: boolean;
  isPlayable?: boolean;
  showDetail?: boolean;
}

export function CardDisplay({
  card,
  onClick,
  isSelected = false,
  isPlayable = true,
  showDetail = false,
}: CardDisplayProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  // Use the game context
  const { getCardEnergyCost } = useGame();
  
  // Get energy cost calculation if available
  const energyCost = getCardEnergyCost(card.id);
  const displayCost = energyCost?.energyCost !== undefined ? energyCost.energyCost : card.cost;
  const hasReducedCost = energyCost?.energyCost !== undefined && energyCost.energyCost < card.cost;
  const hasIncreasedCost = energyCost?.energyCost !== undefined && energyCost.energyCost > card.cost;
  
  // Determine card style based on props
  const cardClasses = `
    relative 
    rounded-lg 
    p-4 
    w-48 
    h-72 
    flex 
    flex-col 
    bg-gradient-to-b 
    from-blue-800 
    to-indigo-900 
    text-white 
    shadow-lg 
    transition-all 
    duration-300
    ${isSelected ? 'ring-4 ring-yellow-400 scale-105' : ''} 
    ${isPlayable ? 'cursor-pointer hover:scale-105' : 'opacity-70 cursor-not-allowed'}
    ${showDetail ? 'scale-110' : ''}
  `;
  
  const energyCostClasses = `
    absolute 
    top-2 
    left-2 
    w-8 
    h-8 
    rounded-full 
    ${hasReducedCost ? 'bg-green-600' : hasIncreasedCost ? 'bg-red-600' : 'bg-blue-600'} 
    flex 
    items-center 
    justify-center 
    text-lg 
    font-bold 
    shadow-md
    transition-colors
    duration-300
    ${hasReducedCost || hasIncreasedCost ? 'animate-pulse' : ''}
  `;

  return (
    <div 
      className={cardClasses}
      onClick={isPlayable ? onClick : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Energy cost display */}
      <div className={energyCostClasses}>
        {displayCost}
      </div>
      
      {/* Show energy cost tooltip if cost was modified */}
      {(hasReducedCost || hasIncreasedCost) && isHovered && (
        <div className="absolute top-2 left-12 bg-black bg-opacity-80 p-2 rounded text-xs z-10 max-w-[200px]">
          {energyCost?.reason || (hasReducedCost ? 'Cost reduced!' : 'Cost increased!')}
        </div>
      )}
      
      {/* Card name */}
      <h3 className="text-center text-lg font-bold mt-2 mb-1">{card.name}</h3>
      
      {/* Card image/art placeholder */}
      <div className="h-24 bg-indigo-700 rounded mb-2 flex items-center justify-center">
        <span className="text-sm text-center px-2 italic">
          {card.art_prompt.substring(0, 40)}...
        </span>
      </div>
      
      {/* Card base effects */}
      <div className="text-xs mb-1">
        {card.base_effects.map((effect, index) => (
          <div key={index} className="mb-1">
            <span className="font-bold">{effect.effect_type}: </span>
            <span>{effect.value} ({effect.target})</span>
          </div>
        ))}
      </div>
      
      {/* Card wildcard effect - only show in detail mode or on hover */}
      {(showDetail || isHovered) && (
        <div className="text-xs italic mt-auto">
          <span className="font-bold">Special: </span>
          {card.wildcard_effect}
        </div>
      )}
    </div>
  );
}