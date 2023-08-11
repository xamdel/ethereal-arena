import React from 'react';
import styles from '../../../styles/CombatLog.module.css'

interface CombatLogProps {
  log: string[];
}

const CombatLog: React.FC<CombatLogProps> = ({ log }) => {
  return (
    <div className={styles.combatLog}>
      {log.reverse().map((entry, index) => (
        <div key={index} className={styles.combatLogEntry}>{entry}</div>
      ))}
    </div>
  );
};

export default CombatLog;