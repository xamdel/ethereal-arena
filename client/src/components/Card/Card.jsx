import React from 'react';
import PropTypes from 'prop-types';
import styles from './Card.module.css';

/**
 * A generic component to display a playing card.
 * Used initially for starting cards in the Character Creator,
 * but designed for potential reuse (e.g., in hand, on board).
 */
function Card({ artUrl, abilityName, effects, flavorText }) {
  return (
    <div className={styles.cardContainer}>
      <div className={styles.artSection}>
        {artUrl ? (
          <img src={artUrl} alt={`${abilityName} art`} className={styles.cardArt} />
        ) : (
          <div className={styles.artPlaceholder}>Art Placeholder</div>
        )}
      </div>
      <div className={styles.infoSection}>
        <h3 className={styles.abilityName}>{abilityName || 'Unnamed Ability'}</h3>
        <p className={styles.effectsText}>{effects || 'No effects described.'}</p>
        {flavorText && (
          <p className={styles.flavorText}><em>{flavorText}</em></p>
        )}
      </div>
    </div>
  );
}

Card.propTypes = {
  artUrl: PropTypes.string, // URL for the card artwork
  abilityName: PropTypes.string.isRequired, // Name of the ability/card
  effects: PropTypes.string.isRequired, // Description of the card's effects
  flavorText: PropTypes.string, // Optional flavor text
};

Card.defaultProps = {
  artUrl: null, // Default to null if no URL is provided
  flavorText: '',
};

export default Card;
