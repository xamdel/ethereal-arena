import React from 'react';
import styles from '../../styles/CardStyles.module.css'
import { Card as CardModel } from '../../models'

interface CardProps {
    card: CardModel;
    isPlayer2?: boolean;
}

const Card: React.FC<CardProps> = ({ card, isPlayer2 = false }) => {
    if (isPlayer2) {
        return <div className={styles.cardBack}></div>;
    }

    return (
        <div className={styles.card}>
            <div className={styles.cardHeader}>
                <div className={styles.cardName}>{card.name}</div>
                <div className={styles.cardEnergyCost}>{card.energyCost}</div>
            </div>
            <div className={styles.cardBody}>
                <div className={styles.cardEffect}>{card.effect}</div>
            </div>
        </div>
    );
};

export default Card;