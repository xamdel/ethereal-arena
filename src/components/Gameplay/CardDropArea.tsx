import React, { useEffect, useState } from 'react';
import styles from '../../../styles/Arena.module.css';
import { Card as CardModel } from '../../models';
import Card from '../Gameplay/Card';
import { useGameState } from '../../context/Provider';

const CardDropArea: React.FC = () => {
  const { player1, player2, turn, turnNumber, onCardDrop } = useGameState();
  const [playedCards, setPlayedCards] = useState<CardModel[]>([]);

  // Clear board on turn end
  useEffect(() => {
    setPlayedCards([]);
  }, [turnNumber]);

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();

    // Don't let players play cards before the game starts
    if (!turn) {
      return;
    }

    // Retrieve the card data from the dragged element
    const cardData = event.dataTransfer.getData('text/plain');
    const droppedCard = JSON.parse(cardData) as CardModel;

    // Check if it's their turn
    if (droppedCard.owner !== turn) {
      console.log('Not your turn!');
      return;
    }

    // Determine current player state
    const currentPlayerState = turn === 'player1' ? player1 : player2;

    // Check if the player has enough energy to play the card
    if (droppedCard.energyCost > currentPlayerState.energy.current) {
      console.log('Not enough energy!');
      return;
    }

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