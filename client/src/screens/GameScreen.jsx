import React, { useState, useEffect, useRef } from 'react'; // Import hooks
import { useGameStore } from '../store/useGameStore'; // Import the store
import { emitGameAction } from '../services/socketService'; // Import the action emitter
import styles from './GameScreen.module.css';

// Placeholder components for different areas (to be created later)
const PlayerInfo = ({ player, isOpponent = false }) => (
  <div className={styles.playerInfo}>
    <h3>{player?.name || (isOpponent ? 'Opponent' : 'Player')}</h3>
    <p>HP: {player?.hp ?? 'N/A'} / {player?.maxHp ?? 'N/A'}</p>
    <p>Block: {player?.block ?? 'N/A'}</p>
    <p>Energy: {player?.energy ?? 'N/A'} / {player?.maxEnergy ?? 'N/A'}</p>
    {/* TODO: Display Status Effects */}
  </div>
);

const HandArea = ({ cards, onPlayCard }) => (
  <div className={styles.handArea}>
    <h4>Your Hand</h4>
    <div className={styles.handCards}>
      {cards?.length > 0 ? cards.map(card => (
        <div key={card.id} className={styles.cardInHand} onClick={() => onPlayCard(card.id)}>
           <h5>{card.name} ({card.cost} E)</h5>
           {/* More card details */}
        </div>
      )) : <p>No cards in hand.</p>}
    </div>
  </div>
);

// Sub-component for individual log entries with streaming effect
const LogEntry = ({ entry }) => {
    const [displayedContent, setDisplayedContent] = useState('');
    const isStreaming = entry.streaming && !entry.streamComplete; // Check if actively streaming
    const streamEndedRef = useRef(false); // Track if stream has ended for this entry

    useEffect(() => {
        if (isStreaming) {
            // Start with empty content when streaming begins
            setDisplayedContent('');
            streamEndedRef.current = false; // Reset end tracker
            let index = 0;
            const intervalId = setInterval(() => {
                setDisplayedContent(entry.content.substring(0, index + 1));
                index++;
                if (index >= entry.content.length) {
                    // Check if the stream *actually* ended via store state
                    const streamIsDone = !useGameStore.getState().activeStreams[entry.correlationId];
                    if (streamIsDone) {
                         clearInterval(intervalId);
                         streamEndedRef.current = true; // Mark as ended locally
                    }
                    // If not done according to store, interval continues, waiting for more content
                }
            }, 30); // Adjust speed as needed (milliseconds per character)

            return () => clearInterval(intervalId); // Cleanup on unmount or re-render
        } else {
            // If not streaming or stream has ended, show full content immediately
            setDisplayedContent(entry.content);
        }
    }, [entry.content, isStreaming, entry.correlationId]); // Rerun effect if content or streaming status changes

    // Determine final content to display
    const contentToShow = isStreaming && !streamEndedRef.current ? displayedContent : entry.content;

    return (
        <li key={entry.id} className={styles[`logEntry_${entry.type}`]}>
            <span className={styles.logTimestamp}>[{new Date(entry.timestamp).toLocaleTimeString()}]</span> {contentToShow}
        </li>
    );
};


const CombatLog = () => {
    const combatLogEntries = useGameStore((state) => state.combatLog);
    const logContainerRef = useRef(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [combatLogEntries]); // Scroll whenever entries change

    return (
        <div className={styles.combatLog} ref={logContainerRef}>
            <h4>Combat Log</h4>
            <ul>
                {combatLogEntries.map(entry => (
                    <LogEntry key={entry.id} entry={entry} />
                ))}
            </ul>
        </div>
    );
};


function GameScreen() {
  // Get necessary state from the store
  const { gameState, playerId } = useGameStore((state) => ({
    gameState: state.gameState,
    playerId: state.playerId,
  }));

  // Find the player and opponent objects from the gameState
  const player = gameState?.players[playerId];
  const opponent = Object.values(gameState?.players || {}).find(p => p.id !== playerId);

  const handlePlayCard = (cardId) => {
    console.log(`Attempting to play card: ${cardId}`);
    if (!gameState || !playerId) {
        console.error("Cannot play card: Missing game state or player ID.");
        return;
    }
    // Basic targeting: assume target is opponent if opponent exists
    const targetId = opponent?.id;
    // Always request streaming for PLAY_CARD for now
    const streamResponse = true;

    const action = {
        type: 'PLAY_CARD', // Use string directly or import ActionType if needed here
        playerId: playerId,
        payload: { cardId, targetId }
        // correlationId will be added by emitGameAction
    };
    emitGameAction(gameState.id, action, streamResponse);
  };

  const handleEndTurn = () => {
    console.log('Ending turn...');
    if (!gameState || !playerId) {
        console.error("Cannot end turn: Missing game state or player ID.");
        return;
    }
    const action = {
        type: 'END_TURN', // Use string directly or import ActionType
        playerId: playerId,
        payload: {}
    };
    emitGameAction(gameState.id, action);
  };


  if (!gameState || !player) {
    // Handle loading state or error if game state/player isn't available
    return <div className={styles.loading}>Loading Game...</div>;
  }

  return (
    <div className={styles.gameScreen}>
      <div className={styles.opponentArea}>
        <PlayerInfo player={opponent} isOpponent={true} />
        {/* Opponent's hand might be hidden or just show card backs */}
      </div>

      <div className={styles.combatLogArea}>
         <CombatLog />
      </div>

      <div className={styles.playerArea}>
        <PlayerInfo player={player} />
        <HandArea cards={player.hand} onPlayCard={handlePlayCard} />
        {/* TODO: Add Discard Pile display */}
        <button onClick={handleEndTurn} className={styles.endTurnButton}>End Turn</button>
      </div>
    </div>
  );
}

export default GameScreen;
