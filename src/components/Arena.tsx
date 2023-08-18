import React from 'react';
import styles from '../../styles/Arena.module.css';
import HealthEnergyDisplay from './HUD/HealthEnergyDisplay';
import { useGameState } from '../context/Provider';
import HandDisplay from './Gameplay/HandDisplay';
import CombatLog from './CombatLog';
import CardDropArea from './Gameplay/CardDropArea';
import BuffDebuffDisplay from './HUD/BuffDebuffDisplay';

const Arena = () => {
    const { player1, player2, turn, turnNumber, combatLog, endTurn, handlePlayerReady, onCardDrop } = useGameState();

    return (
        <div className={styles.arenaContainer}>
            <div className={styles.leftSpace}>
                <p>Turn: {turn}</p>
                <p>Turn number: {turnNumber}</p>
                <button onClick={endTurn}>End Turn</button>
                <button onClick={() => handlePlayerReady('player1')}>Player 1 Ready</button>
                <button onClick={() => handlePlayerReady('player2')}>Player 2 Ready</button>
            </div>
            <div className={styles.battleHud}>
                <div className={styles.opponentArea}>
                    <div className={styles.opponentHand}>
                        <HandDisplay cards={player2.hand} isPlayer2={true} />
                    </div>
                    <div className={styles.status}>
                        <div className={styles.debuffs}>
                            <BuffDebuffDisplay effects={player2.debuffs} isBuff={false} />
                        </div>
                        <div className={styles.hpEnergy}>
                            <HealthEnergyDisplay isPlayer2={true} />
                        </div>
                        <div className={styles.buffs}>
                            <BuffDebuffDisplay effects={player2.buffs} isBuff={true} />
                        </div>
                    </div>
                </div>
                <div className={styles.cardDropAreaContainer}>
                    <CardDropArea onCardDrop={onCardDrop} />
                </div>
                <div className={styles.playerArea}>
                    <div className={styles.status}>
                        <div className={styles.debuffs}>
                            <BuffDebuffDisplay effects={player1.debuffs} isBuff={false} />

                        </div>
                        <div className={styles.hpEnergy}>
                            <HealthEnergyDisplay />
                        </div>
                        <div className={styles.buffs}>
                            <BuffDebuffDisplay effects={player1.buffs} isBuff={true} />
                        </div>
                    </div>
                    <div className={styles.playerHand}>
                        <HandDisplay cards={player1.hand} />
                    </div>
                </div>
            </div>
            <div className={styles.combatLog}>
                <CombatLog log={combatLog} />
            </div>
        </div>
    );
};

export default Arena;