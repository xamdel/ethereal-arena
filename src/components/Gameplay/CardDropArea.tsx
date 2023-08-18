import React, { useEffect, useState } from 'react';
import styles from '../../../styles/Arena.module.css';
import { Card as CardModel } from '../../models';
import Card from '../Gameplay/Card';

interface CardDropAreaProps {
  onCardDrop?: (card: CardModel) => void;
  turnNumber: number;
}

const CardDropArea: React.FC<CardDropAreaProps> = ({ onCardDrop, turnNumber }) => {
  const [playedCards, setPlayedCards] = useState<CardModel[]>([]);

  // Clear board on turn end
  useEffect(() => {
    setPlayedCards([]);
  }, [turnNumber]);

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();

    // Retrieve the card data from the dragged element
    const cardData = event.dataTransfer.getData('text/plain');
    const droppedCard = JSON.parse(cardData) as CardModel;

    // Add the card to the playedCards state
    setPlayedCards(prev => [...prev, droppedCard]);

    // Call the onCardDrop function if provided
    onCardDrop?.(droppedCard);
  };

  // Function to allow drop event on the div
  const allowDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <div className={styles.cardDropArea} onDrop={handleDrop} onDragOver={allowDrop}>
      {playedCards.map((card, index) => (
        <Card key={index} card={card} />
      ))}
    </div>
  );
};

export default CardDropArea;