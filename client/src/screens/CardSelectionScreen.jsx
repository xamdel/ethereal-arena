import React, { useState } from 'react';
import styles from './CardSelectionScreen.module.css';

// Placeholder Card component (we'll create a proper one later)
const CardPlaceholder = ({ card, isSelected, onToggleSelect }) => (
  <div
    className={`${styles.card} ${isSelected ? styles.selected : ''}`}
    onClick={onToggleSelect}
  >
    <h4>{card.name} ({card.cost} E)</h4>
    <p className={styles.cardDescription}>{card.description}</p>
    <p className={styles.cardEffects}><i>Effects: {card.base_effects}</i></p>
    {card.wildcard_effect && <p className={styles.cardWildcard}><i>Wildcard: {card.wildcard_effect}</i></p>}
  </div>
);


function CardSelectionScreen({ cards = [], onSelect }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const MAX_SELECT = 5;

  const handleToggleSelect = (cardId) => {
    setSelectedIds(prevSelectedIds => {
      const newSelectedIds = new Set(prevSelectedIds);
      if (newSelectedIds.has(cardId)) {
        newSelectedIds.delete(cardId);
      } else {
        if (newSelectedIds.size < MAX_SELECT) {
          newSelectedIds.add(cardId);
        } else {
          // Optional: Provide feedback that max selection is reached
          console.log(`Maximum selection (${MAX_SELECT}) reached.`);
        }
      }
      return newSelectedIds;
    });
  };

  const handleConfirm = () => {
    if (selectedIds.size === MAX_SELECT) {
      onSelect(Array.from(selectedIds));
    } else {
      alert(`Please select exactly ${MAX_SELECT} cards.`);
    }
  };

  if (!cards || cards.length === 0) {
      return (
          <div className={styles.loadingContainer}>
              <h2>Generating initial cards...</h2>
              <p>The arcane energies swirl, shaping your starting arsenal!</p>
              {/* Add a loading spinner maybe */}
          </div>
      );
  }

  return (
    <div className={styles.selectionContainer}>
      <h2>Select Your Starting Hand ({selectedIds.size}/{MAX_SELECT})</h2>
      <p>Choose {MAX_SELECT} cards to begin your journey.</p>
      <div className={styles.cardGrid}>
        {cards.map(card => (
          <CardPlaceholder
            key={card.id}
            card={card}
            isSelected={selectedIds.has(card.id)}
            onToggleSelect={() => handleToggleSelect(card.id)}
          />
        ))}
      </div>
      <button
        onClick={handleConfirm}
        disabled={selectedIds.size !== MAX_SELECT}
        className={styles.confirmButton}
      >
        Confirm Selection ({selectedIds.size}/{MAX_SELECT})
      </button>
    </div>
  );
}

export default CardSelectionScreen;
