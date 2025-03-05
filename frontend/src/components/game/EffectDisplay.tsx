'use client';

import { useGame } from '@/context';
import { QueuedEffect } from '@/types';
import { useState, useEffect } from 'react';

// List of particle effects for different effect types
const effectStyles = {
  'damage': {
    className: 'text-red-500',
    icon: '💥',
    animation: 'animate-bounce'
  },
  'heal': {
    className: 'text-green-500',
    icon: '✨',
    animation: 'animate-pulse'
  },
  'block': {
    className: 'text-blue-500',
    icon: '🛡️',
    animation: 'animate-pulse'
  },
  'status': {
    className: 'text-purple-500',
    icon: '⚡',
    animation: 'animate-spin'
  },
  'draw': {
    className: 'text-yellow-500',
    icon: '🃏',
    animation: 'animate-bounce'
  },
  'energy': {
    className: 'text-cyan-500',
    icon: '✦',
    animation: 'animate-pulse'
  },
  'default': {
    className: 'text-white',
    icon: '✧',
    animation: 'animate-pulse'
  }
};

// Maps effect types to style configuration
function getEffectStyle(effect: QueuedEffect) {
  // Match effect.type to one of the known types or use default
  const knownTypes = Object.keys(effectStyles);
  
  for (const type of knownTypes) {
    if (effect.type.toLowerCase().includes(type)) {
      return effectStyles[type as keyof typeof effectStyles];
    }
  }
  
  return effectStyles.default;
}

interface AnimatedEffectProps {
  effect: QueuedEffect;
  onComplete: () => void;
}

// Single effect animation
function AnimatedEffect({ effect, onComplete }: AnimatedEffectProps) {
  const style = getEffectStyle(effect);
  
  // Cleanup effect after animation
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [onComplete]);
  
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className={`text-4xl ${style.animation} ${style.className}`}>
        <span className="mr-2">{style.icon}</span>
        <span className="font-bold">
          {effect.value ? (effect.type === 'damage' ? '-' : '+') + effect.value : effect.type}
        </span>
      </div>
    </div>
  );
}

export function EffectDisplay() {
  const { gameState } = useGame();
  const [activeEffects, setActiveEffects] = useState<QueuedEffect[]>([]);
  
  // Process new effects from the queue
  useEffect(() => {
    if (gameState.effectQueue.length > 0 && activeEffects.length < 3) {
      // Get up to 3 new effects from the queue to display
      const newEffects = gameState.effectQueue.slice(0, 3 - activeEffects.length);
      if (newEffects.length > 0) {
        setActiveEffects(prev => [...prev, ...newEffects]);
      }
    }
  }, [gameState.effectQueue, activeEffects]);
  
  // Remove an effect when animation completes
  const handleEffectComplete = (effectId: string) => {
    setActiveEffects(prev => prev.filter(effect => effect.id !== effectId));
  };
  
  if (activeEffects.length === 0) {
    return null;
  }
  
  return (
    <div className="relative w-full h-full">
      {activeEffects.map((effect, index) => (
        <AnimatedEffect
          key={effect.id}
          effect={effect}
          onComplete={() => handleEffectComplete(effect.id)}
        />
      ))}
    </div>
  );
}