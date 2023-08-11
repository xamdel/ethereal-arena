import React from 'react';
import styles from '../../styles/Arena.module.css';

const Arena = () => {
    return (
        <div className={styles.arenaContainer}>
            <div className={styles.leftSpace}></div>
            <div className={styles.battleHud}>
                <div className={styles.opponentArea}>
                    <div className={styles.opponentHand}>Opponent's hand</div>
                    <div className={styles.status}>
                        <div className={styles.debuffs}>Opponent Debuffs</div>
                        <div className={styles.hpEnergy}>Opponent HP/Energy</div>
                        <div className={styles.buffs}>Opponent Buffs</div>
                    </div>
                </div>
                <div className={styles.cardDropArea}>
                    Card drop area
                </div>
                <div className={styles.playerArea}>
                    <div className={styles.status}>
                        <div className={styles.debuffs}>Player Debuffs</div>
                        <div className={styles.hpEnergy}>Player HP/Energy</div>
                        <div className={styles.buffs}>Player Buffs</div>
                    </div>
                    <div className={styles.playerHand}>Player's hand</div>
                </div>
            </div>
            <div className={styles.combatLog}>
                Combat Log
            </div>
        </div>
    );
};

export default Arena;