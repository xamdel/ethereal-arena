'use client';

import { useGame } from '@/context';
import { GameAction, QueuedEffect } from '@/types';
import { useEffect, useRef } from 'react';

// Helper function to generate log message for an action
function getLogMessage(action: GameAction, gameState: any): string {
  switch (action.type) {
    case 'PLAY_CARD':
      const cardId = action.payload?.cardId;
      const playerName = gameState.players[action.playerId]?.name || action.playerId;
      
      // Find the card name if possible
      let cardName = "a card";
      const player = gameState.players[action.playerId];
      if (player) {
        // Look in discard pile for the card (since it may have been played already)
        const card = player.discard.find((c: any) => c.id === cardId);
        if (card) {
          cardName = card.name;
        }
      }
      
      return `${playerName} played ${cardName}`;
      
    case 'END_TURN':
      const endingPlayerName = gameState.players[action.playerId]?.name || action.playerId;
      return `${endingPlayerName} ended their turn`;
      
    case 'SELECT_CARDS':
      return `Cards selected from draft`;
      
    case 'APPLY_EFFECT':
      const effect = action.payload?.effect as QueuedEffect;
      if (effect?.narration) {
        return effect.narration;
      }
      
      const effectType = effect?.type || 'Unknown';
      const value = effect?.value;
      const target = effect?.target 
        ? gameState.players[effect.target]?.name 
        : 'Unknown';
        
      if (value !== undefined) {
        return `${effectType.charAt(0).toUpperCase() + effectType.slice(1)} ${value} applied to ${target}`;
      }
      return `${effectType.charAt(0).toUpperCase() + effectType.slice(1)} applied to ${target}`;
      
    case 'PROCESS_QUEUE':
      return 'Processing effects...';
      
    case 'GAME_INIT':
      return 'Game started';
      
    default:
      return `Action: ${action.type}`;
  }
}

// Function to check if the action is the most recent PLAY_CARD action
function isLastPlayCardAction(action: GameAction, gameState: any): boolean {
  if (action.type !== 'PLAY_CARD') return false;
  
  // Get all PLAY_CARD actions
  const playCardActions = gameState.actionHistory.filter(a => a.type === 'PLAY_CARD');
  
  // If no PLAY_CARD actions, this must be the first one
  if (playCardActions.length === 0) return true;
  
  // Get the last PLAY_CARD action
  const lastPlayCardAction = playCardActions[playCardActions.length - 1];
  
  return lastPlayCardAction?.id === action.id;
}

// Check if this action has a card narrative from the server
function hasCardNarrative(action: GameAction, gameState: any): boolean {
  return isLastPlayCardAction(action, gameState) && Boolean(gameState.cardNarrative);
}

// Check if this action has effect narrations from the server
function hasEffectNarrations(action: GameAction, gameState: any): boolean {
  return isLastPlayCardAction(action, gameState) && 
         Array.isArray(gameState.effectNarrations) && 
         gameState.effectNarrations.length > 0;
}

// Process an on_play_description by replacing player/opponent placeholders
function processOnPlayDescription(description: string, playerId: string, gameState: any): string {
  if (!description) return '';
  
  let processed = description;
  
  // Replace [player] with the player's name
  const playerName = gameState.players[playerId]?.name || "Player";
  processed = processed.replace(/\[player\]/g, playerName);
  
  // Replace [opponent] with the opponent's name
  const opponentId = Object.keys(gameState.players).find(id => id !== playerId);
  const opponentName = opponentId ? gameState.players[opponentId]?.name || "Opponent" : "Opponent";
  processed = processed.replace(/\[opponent\]/g, opponentName);
  
  return processed;
}

export function GameLog() {
  const { gameState, uiState } = useGame();
  const logEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when log updates
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [gameState.actionHistory, uiState.logEntries]);
  
  // Get last 15 actions for display
  const recentActions = [...gameState.actionHistory].slice(-15).reverse();
  
  // Check if we should display the last played card's on_play_description
  const showImmediateNarration = uiState.lastPlayedCard?.on_play_description && uiState.isProcessing;
  
  // Render log entries from the streaming data
  const renderStreamingEntries = () => {
    if (!uiState.logEntries || uiState.logEntries.length === 0) return null;
    
    return (
      <div className="space-y-3 mb-4 border-b border-purple-900 pb-4">
        {uiState.logEntries.map((entry, index) => {
          // Different styling based on entry type
          let className = "";
          
          switch (entry.type) {
            case 'on-play-description':
              className = "text-cyan-300 italic bg-indigo-900/70 p-2 rounded border-l-4 border-cyan-500";
              break;
            case 'narrative':
              className = "text-amber-300 italic p-2 bg-purple-900/30 rounded border-l-4 border-amber-500";
              break;
            case 'effect':
              className = "text-teal-300 italic p-2 bg-blue-900/30 rounded border-l-4 border-teal-500";
              break;
            case 'error':
              className = "text-red-300 italic p-2 bg-red-900/30 rounded border-l-4 border-red-500";
              break;
            default:
              className = "text-gray-300 italic p-2 bg-gray-800/50 rounded";
          }
          
          return (
            <div key={`${entry.type}-${index}`} className={className}>
              {entry.content}
            </div>
          );
        })}
      </div>
    );
  };
  
  return (
    <div className="h-full flex flex-col drop-shadow-lg">
      <div className="bg-gray-800/90 p-3 rounded-t-lg border-b border-purple-700">
        <h3 className="text-lg font-bold text-purple-300">Game Log</h3>
        {uiState.isStreaming && (
          <div className="text-xs text-emerald-400 mt-1 flex items-center">
            <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse"></div>
            Streaming response...
          </div>
        )}
      </div>
      
      {/* Immediate narration - shows while processing (fallback for old system) */}
      {showImmediateNarration && uiState.logEntries.length === 0 && (
        <div className="p-3 text-cyan-300 italic bg-indigo-900/70 border-b-2 border-cyan-500">
          {processOnPlayDescription(
            uiState.lastPlayedCard.on_play_description,
            gameState.activePlayerId,
            gameState
          )}
        </div>
      )}
      
      {/* Scrollable log area */}
      <div className="flex-1 bg-black/80 backdrop-blur-sm rounded-b-lg p-3 overflow-y-auto flex flex-col-reverse">
        {recentActions.length === 0 && uiState.logEntries.length === 0 ? (
          <div className="text-gray-500 italic text-center">No actions yet</div>
        ) : (
          <>
            {/* Streaming log entries (newer system) */}
            {renderStreamingEntries()}
            
            {/* Legacy action history (older system) */}
            {recentActions.map((action) => (
              <div 
                key={action.id} 
                className="mb-2 text-sm border-b border-purple-900/50 pb-2 hover:bg-purple-900/20 transition-colors duration-150 p-2 rounded"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-purple-300 text-xs uppercase tracking-wider">
                    {action.type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(action.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-gray-100 mt-1">{getLogMessage(action, gameState)}</div>
                
                {/* Card Narrative from the server response (only show for legacy non-streaming responses) */}
                {!uiState.isStreaming && hasCardNarrative(action, gameState) && (
                  <div className="mt-3 text-amber-300 italic p-2 bg-purple-900/30 rounded border-l-4 border-amber-500">
                    {gameState.cardNarrative}
                  </div>
                )}
                
                {/* Individual Effect Narrations from the server response (only show for legacy non-streaming responses) */}
                {!uiState.isStreaming && hasEffectNarrations(action, gameState) && (
                  <div className="mt-3 space-y-2">
                    {gameState.effectNarrations!.map((narration, index) => (
                      <div 
                        key={index} 
                        className="text-teal-300 italic p-2 bg-blue-900/30 rounded border-l-4 border-teal-500"
                      >
                        {narration}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={logEndRef}></div>
          </>
        )}
      </div>
    </div>
  );
}