import React from 'react';
import styles from '../../../styles/Arena.module.css'
import { Card as CardModel } from '../../models';
import Card from '../Card'

interface HandDisplayProps {
  cards: CardModel[];
  isPlayer2?: boolean;
}

const HandDisplay: React.FC<HandDisplayProps> = ({ cards, isPlayer2 = false }) => {
    const playerClass = isPlayer2 ? styles.player2Hand : styles.player1Hand;

  return (
    <div className={`${styles.handDisplay} ${playerClass}`}>
      {cards.map((card, index) => (
        <Card key={index} card={card} isPlayer2={isPlayer2} />
      ))}
    </div>
  );
};

export default HandDisplay;