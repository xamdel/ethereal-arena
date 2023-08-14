import React from 'react';
import styles from '../../styles/CombatLog.module.css'
import { CombatLogEntry } from '../models';

interface CombatLogProps {
  log: CombatLogEntry[];
}

const CombatLog: React.FC<CombatLogProps> = ({ log }) => {

  const formatEntry = (entry: CombatLogEntry) => {
    const date = entry.timestamp.toLocaleTimeString();
    const details = typeof entry.details === 'string' ? entry.details : JSON.stringify(entry.details)

    return `${date} ${details}`
  }

  const reversedLog = [...log].reverse();

  return (
    <div className={styles.combatLog}>
      {reversedLog.map((entry, index) => (
        <div key={index} className={styles.combatLogEntry}>{formatEntry(entry)}</div>
      ))}
    </div>
  );
};

export default CombatLog;