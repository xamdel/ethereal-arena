'use client';

import { Player, StatusEffect } from '@/types';
import { useState } from 'react';

interface PlayerStatsProps {
  player: Player;
  isOpponent?: boolean;
}

export function PlayerStats({ player, isOpponent = false }: PlayerStatsProps) {
  const [showStatusDetails, setShowStatusDetails] = useState(false);
  
  // Container alignment - opponent at top, player at bottom
  const containerClasses = `
    flex flex-col 
    w-64 
    p-4 
    rounded-lg 
    bg-gradient-to-b 
    ${isOpponent ? 'from-rose-900 to-rose-800' : 'from-blue-900 to-blue-800'} 
    text-white 
    shadow-lg
  `;
  
  // HP display with percentage-based background
  const hpPercentage = (player.hp / player.maxHp) * 100;
  const hpColorClass = 
    hpPercentage > 65 ? 'bg-green-500' : 
    hpPercentage > 30 ? 'bg-yellow-500' : 
    'bg-red-500';
  
  return (
    <div className={containerClasses}>
      {/* Player name and active indicator */}
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-bold">{player.name}</h3>
        {player.isActive && (
          <span className="px-2 py-1 bg-yellow-500 text-black rounded-full text-xs font-bold animate-pulse">
            Active
          </span>
        )}
      </div>
      
      {/* HP Bar */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-bold">HP</span>
          <span className="text-sm">{player.hp} / {player.maxHp}</span>
        </div>
        <div className="w-full h-4 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={`h-full ${hpColorClass} transition-all duration-500`}
            style={{ width: `${hpPercentage}%` }}
          ></div>
        </div>
      </div>
      
      {/* Block value */}
      {player.block > 0 && (
        <div className="mb-3 flex items-center">
          <div className="w-8 h-8 rounded-full bg-gray-200 text-blue-900 flex items-center justify-center font-bold mr-2">
            🛡️
          </div>
          <span className="text-lg font-bold">{player.block} Block</span>
        </div>
      )}
      
      {/* Energy display */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-bold">Energy</span>
          <span className="text-sm">{player.energy} / {player.maxEnergy}</span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: player.maxEnergy }).map((_, index) => (
            <div 
              key={index} 
              className={`w-6 h-6 rounded-full ${index < player.energy ? 'bg-blue-400' : 'bg-gray-700'} flex items-center justify-center text-xs`}
            >
              ✦
            </div>
          ))}
        </div>
      </div>
      
      {/* Draw indicator */}
      <div className="flex items-center mb-3">
        <span className="text-sm mr-2">Draw: {player.draw || 0}</span>
        <span className="text-sm">Deck: {player.deck?.length || 0}</span>
      </div>
      
      {/* Status effects section */}
      {player.statusEffects?.length > 0 && (
        <div className="mt-2">
          <div 
            className="flex justify-between items-center cursor-pointer"
            onClick={() => setShowStatusDetails(!showStatusDetails)}
          >
            <span className="text-sm font-bold">Status Effects</span>
            <span>{showStatusDetails ? '▲' : '▼'}</span>
          </div>
          
          {showStatusDetails && (
            <div className="mt-2 text-sm">
              {player.statusEffects.map((effect) => (
                <StatusEffectDisplay key={effect.id} effect={effect} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Status effect sub-component
function StatusEffectDisplay({ effect }: { effect: StatusEffect }) {
  return (
    <div className="mb-2 p-2 bg-black/20 rounded">
      <div className="flex justify-between">
        <span className="font-bold">{effect.name}</span>
        <span>{effect.duration} turns</span>
      </div>
      <p className="text-xs mt-1">{effect.description}</p>
    </div>
  );
}