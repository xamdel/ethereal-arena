import React from 'react';
import PropTypes from 'prop-types';
import styles from './InfoCard.module.css';

/**
 * A reusable card component to display information sections
 * like Description or Class Features. Can optionally include an image (e.g., facial portrait).
 */
function InfoCard({ title, content, imageUrl, imageAlt }) {
  return (
    <div className={styles.infoCard}>
      {imageUrl && (
        <div className={styles.imageSection}>
          <img src={imageUrl} alt={imageAlt} className={styles.cardImage} />
        </div>
      )}
      <h3 className={styles.cardTitle}>{title}</h3>
      <div className={styles.contentSection}>
        {Array.isArray(content) ? (
          <ul className={styles.listContent}>
            {content.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.paragraphContent}>{content}</p>
        )}
      </div>
    </div>
  );
}

InfoCard.propTypes = {
  title: PropTypes.string.isRequired,
  // Content can be a single string (paragraph) or an array of strings (list items)
  content: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string),
  ]).isRequired,
  imageUrl: PropTypes.string, // Optional URL for an image (e.g., facial portrait)
  imageAlt: PropTypes.string, // Alt text for the image, required if imageUrl is provided
};

InfoCard.defaultProps = {
  imageUrl: null,
  imageAlt: 'Card image',
};

export default InfoCard;
