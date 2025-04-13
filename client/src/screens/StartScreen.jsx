import React, { useState } from 'react';
import styles from './StartScreen.module.css'; // Import CSS Module

function StartScreen({ onGameStart, onNavigateToCreator }) { // Added onNavigateToCreator prop
  const [playerName, setPlayerName] = useState('');
  const [playerClass, setPlayerClass] = useState('');
  const [gameMode, setGameMode] = useState('pve'); // 'pve' or 'pvp'

  const handleStart = () => {
    if (playerName.trim() && playerClass.trim()) {
      onGameStart({
        name: playerName.trim(),
        class: playerClass.trim(), // Pass the freeform class
        isSinglePlayer: gameMode === 'pve',
      });
    } else {
      // Basic validation feedback
      alert('Please enter your name and choose a class.');
    }
  };

  // TODO: Implement random class suggestion if desired

  return (
    <div className={styles.startScreenContainer}>
      <h1>Ethereal Arena</h1>
      <p>Forge your legend in an arena where cards are born from imagination!</p>

      <div className={styles.inputGroup}>
        <label htmlFor="playerName">Enter Your Name:</label>
        <input
          id="playerName"
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="e.g., Arcanist Bob"
          maxLength={30} // Add a reasonable max length
          className={styles.inputField}
        />
      </div>

      <div className={styles.inputGroup}>
        <label htmlFor="playerClass">Imagine Your Class:</label>
        <input
          id="playerClass"
          type="text"
          value={playerClass}
          onChange={(e) => setPlayerClass(e.target.value)}
          placeholder="e.g., Shadow Weaver, Chrono-Knight, Slime Lord"
          maxLength={50} // Add a reasonable max length
          className={styles.inputField}
        />
        {/* Optional: Button for random suggestion */}
        {/* <button className={styles.suggestButton}>Suggest Random</button> */}
      </div>

      <div className={styles.modeSelection}>
        <label>
          <input
            type="radio"
            name="gameMode"
            value="pve"
            checked={gameMode === 'pve'}
            onChange={() => setGameMode('pve')}
          />
          Play vs AI
        </label>
        <label>
          <input
            type="radio"
            name="gameMode"
            value="pvp"
            checked={gameMode === 'pvp'}
            onChange={() => setGameMode('pvp')}
            disabled // Disable PvP for now until implemented
          />
          Play vs Player (Coming Soon)
        </label>
      </div>


      <div className={styles.buttonGroup}>
        <button onClick={handleStart} className={styles.startButton}>
          Enter the Arena
        </button>
        <button onClick={onNavigateToCreator} className={styles.creatorButton}>
          Character Creator
        </button>
      </div>
    </div>
  );
}

export default StartScreen;
