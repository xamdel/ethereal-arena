import React, { useState } from 'react';
import styles from '../../../styles/Arena.module.css'
import { Card as CardModel } from '../../models';
import Card from '../Gameplay/Card'

interface CardDropAreaProps {
  card?: CardModel;
  onCardDrop?: (card: CardModel) => void; // Placeholder function to handle card drop
}

const CardDropArea: React.FC<CardDropAreaProps> = ({ onCardDrop }) => {
    const [playedCards, setPlayedCards] = useState<CardModel[]>([]);
  
  const handleDrop = (event: React.DragEvent) => {
    //placeholder
  };

  return (
    <div className={styles.cardDropArea} onDrop={handleDrop}>
      {playedCards.map((card, index) => (
        <Card key={index} card={card} />
      ))}
    </div>
  );
};

export default CardDropArea;