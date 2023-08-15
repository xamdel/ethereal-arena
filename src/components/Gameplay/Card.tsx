import React, { useRef } from 'react';
import styles from '../../../styles/CardStyles.module.css'
import { Card as CardModel } from '../../models'

interface CardProps {
    card: CardModel;
    isPlayer2?: boolean;
}

const Card: React.FC<CardProps> = ({ card, isPlayer2 = false }) => {
    const cardRef = useRef<HTMLDivElement>(null);

    const handleMouseOver = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        e.currentTarget.classList.add(styles.zoomed);
    };

    const handleMouseOut = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        e.currentTarget.classList.remove(styles.zoomed);
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        e.dataTransfer.setData('text/plain', JSON.stringify(card));
        cardRef.current?.classList.add(styles.dragging);
    };

    const handleDragEnd = () => {
        cardRef.current?.classList.remove(styles.dragging);
    };
    
    // if (isPlayer2) {
    //     return <div className={styles.cardBack}></div>;
    // }

    return (
        <div ref={cardRef}
             className={styles.card} 
             onMouseOver={handleMouseOver} 
             onMouseOut={handleMouseOut}
             draggable
             onDragStart={handleDragStart}
             onDragEnd={handleDragEnd}
        >
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