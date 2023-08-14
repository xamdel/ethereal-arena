import React from 'react';
import styles from '../../styles/Arena.module.css';
import HealthEnergyDisplay from './HUD/HealthEnergyDisplay';
import { useGameState } from '../context/Provider';
import HandDisplay from './Gameplay/HandDisplay';

const Arena = () => {
    const gameState = useGameState();

    return (
        <div className={styles.arenaContainer}>
            <div className={styles.leftSpace}></div>
            <div className={styles.battleHud}>
                <div className={styles.opponentArea}>
                    <div className={styles.opponentHand}>
                        <HandDisplay cards={gameState.player2.hand} isPlayer2={true} />
                    </div>
                    <div className={styles.status}>
                        <div className={styles.debuffs}>Opponent Debuffs</div>
                        <div className={styles.hpEnergy}>
                            <HealthEnergyDisplay isPlayer2={true}/>
                        </div>
                        <div className={styles.buffs}>Opponent Buffs</div>
                    </div>
                </div>
                <div className={styles.cardDropAreaContainer}>
                    Card drop area
                </div>
                <div className={styles.playerArea}>
                    <div className={styles.status}>
                        <div className={styles.debuffs}>Player Debuffs</div>
                        <div className={styles.hpEnergy}>
                            <HealthEnergyDisplay />
                        </div>
                        <div className={styles.buffs}>Player Buffs</div>
                    </div>
                    <div className={styles.playerHand}>
                        <HandDisplay cards={gameState.player1.hand} />
                    </div>
                </div>
            </div>
            <div className={styles.combatLog}>
                Combat Log
            </div>
        </div>
    );
};

export default Arena;