import React from 'react';
import { Buff, Debuff } from '../../models';
import styles from '../../../styles/HUD.module.css'

interface BuffDebuffIconProps {
  effect: Buff | Debuff;
}

const BuffDebuffIcon: React.FC<BuffDebuffIconProps> = ({ effect }) => {
  return (
    <div className={styles.buffDebuffIcon} title={`${effect.name}: ${effect.effect} (${effect.duration} turns)`}>
      {/* Placeholder icon */}
      <div className={styles.iconPlaceholder}>{effect.name.charAt(0)}</div>
    </div>
  );
};

export default BuffDebuffIcon;