import React from 'react';
import PropTypes from 'prop-types';
import Card from '../Card/Card'; // Import the generic Card component
import styles from './StartingCardsSection.module.css';

/**
 * Component to display the "Starting Cards" section,
 * including a header and a list of Card components.
 */
function StartingCardsSection({ startingCards }) {
  // Ensure startingCards is an array before trying to map
  const cardsToDisplay = Array.isArray(startingCards) ? startingCards : [];

  return (
    <div className={styles.sectionContainer}>
      <h2 className={styles.sectionHeader}>Starting Cards</h2>
      {cardsToDisplay.length > 0 ? (
        <div className={styles.cardsWrapper}>
          {cardsToDisplay.map((card, index) => (
            <Card
              key={card.abilityName + index} // Use name + index for a reasonable key
              artUrl={card.artUrl}
              abilityName={card.abilityName}
              effects={card.effects}
              flavorText={card.flavorText}
            />
          ))}
        </div>
      ) : (
        <p className={styles.noCardsMessage}>No starting cards generated.</p>
      )}
    </div>
  );
}

StartingCardsSection.propTypes = {
  // Expects an array of objects matching the card data structure
  startingCards: PropTypes.arrayOf(PropTypes.shape({
    artUrl: PropTypes.string,
    abilityName: PropTypes.string.isRequired,
    effects: PropTypes.string.isRequired,
    flavorText: PropTypes.string,
  })),
};

StartingCardsSection.defaultProps = {
  startingCards: [], // Default to an empty array
};

export default StartingCardsSection;
