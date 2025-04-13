import React from 'react';
import PropTypes from 'prop-types';
import styles from './CharacterImageDisplay.module.css';

/**
 * Component to display the main character image.
 * Handles loading state and placeholder.
 */
function CharacterImageDisplay({ imageUrl, altText, isLoading }) {
  if (isLoading) {
    return (
      <div className={`${styles.imageContainer} ${styles.loading}`}>
        Generating Image...
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className={`${styles.imageContainer} ${styles.placeholder}`}>
        Character Image Area
      </div>
    );
  }

  return (
    <div className={styles.imageContainer}>
      <img src={imageUrl} alt={altText} className={styles.characterImage} />
    </div>
  );
}

CharacterImageDisplay.propTypes = {
  imageUrl: PropTypes.string, // URL of the character image
  altText: PropTypes.string, // Alt text for the image
  isLoading: PropTypes.bool, // Whether the image is currently being generated/loaded
};

CharacterImageDisplay.defaultProps = {
  imageUrl: null,
  altText: 'Generated character image',
  isLoading: false,
};

export default CharacterImageDisplay;
