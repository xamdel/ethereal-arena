import React, { useContext } from 'react';
import styles from '../../../styles/HUD.module.css';
import { GameStateContext } from '../../context';

interface HealthEnergyDisplayProps {
  isPlayer2?: boolean;
}

const HealthEnergyDisplay: React.FC<HealthEnergyDisplayProps> = ({ isPlayer2 = false }) => {
  const gameState = useContext(GameStateContext);
  const playerState = isPlayer2 ? gameState.player2 : gameState.player1;

  return (
    <div className={styles.healthEnergyDisplay}>
      <div className={styles.health}>HP: {playerState.health.current} / {playerState.health.max}</div>
      <div className={styles.energy}>Energy: {playerState.energy.current} / {playerState.energy.max}</div>
    </div>
  );
};

export default HealthEnergyDisplay;