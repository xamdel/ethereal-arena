import React, { useState, useEffect, useRef } from 'react';
import styles from './CharacterCreatorScreen.module.css';
import CharacterImageDisplay from '../components/CharacterImageDisplay/CharacterImageDisplay';
import InfoCard from '../components/InfoCard/InfoCard';
import StartingCardsSection from '../components/StartingCardsSection/StartingCardsSection';
import {
  addSocketListener,
  removeSocketListener,
  emitGenerateCharacter
} from '../services/socketService';

function CharacterCreatorScreen() {
  const [className, setClassName] = useState('');
  const [characterData, setCharacterData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isInfoViewActive, setIsInfoViewActive] = useState(true); // State for carousel view
  const scrollTimeoutRef = useRef(null); // Ref for debounce timer

  // Setup socket listeners
  useEffect(() => {
    const handleCharacterGenerated = (data) => {
      console.log('[Socket Event] characterGenerated received:', data);
      setCharacterData(data);
      setIsLoading(false);
      setError(null);
    };

    const handleCharacterGenerationFailed = (errorData) => {
      console.error('[Socket Event] characterGenerationFailed received:', errorData);
      setError(`Generation failed: ${errorData.message} (Step: ${errorData.step || 'unknown'})`);
      setIsLoading(false);
      setCharacterData(null);
    };

    addSocketListener('characterGenerated', handleCharacterGenerated);
    addSocketListener('characterGenerationFailed', handleCharacterGenerationFailed);

    // Cleanup listeners on component unmount
    return () => {
      removeSocketListener('characterGenerated', handleCharacterGenerated);
      removeSocketListener('characterGenerationFailed', handleCharacterGenerationFailed);
    };
  }, []); // Empty dependency array ensures this runs only once on mount/unmount

  const handleInputChange = (event) => {
    setClassName(event.target.value);
  };

  // Debounced scroll handler
  const handleWheelScroll = (event) => {
    // Clear any existing timeout to debounce
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Set a new timeout
    scrollTimeoutRef.current = setTimeout(() => {
      const scrollDown = event.deltaY > 0;
      const scrollUp = event.deltaY < 0;

      if (scrollDown && isInfoViewActive) {
        setIsInfoViewActive(false);
      } else if (scrollUp && !isInfoViewActive) {
        setIsInfoViewActive(true);
      }
      scrollTimeoutRef.current = null; // Clear ref after execution
    }, 100); // Adjust debounce delay (ms) as needed
  };

  const handleGenerateClick = () => {
    if (!className.trim()) {
      setError('Please enter a class name.');
      return;
    }
    setError(null);
    setIsLoading(true);
    setCharacterData(null); // Clear previous data
    setError(null); // Clear previous errors
    console.log(`Requesting generation for class: ${className}`);
    emitGenerateCharacter(className.trim());
  };

  return (
    <div className={styles.screenContainer}>
      {/* Top Section (Fixed) */}
      <div className={styles.topSection}>
        <h1 className={styles.title}>Create Your Character</h1>
        <div className={styles.inputSection}>
          <input
            type="text"
            value={className}
            onChange={handleInputChange}
            placeholder="Enter character class (e.g., Shadow Weaver, Ironclad Paladin)"
            className={styles.classNameInput}
            disabled={isLoading}
          />
          <button
            onClick={handleGenerateClick}
            className={styles.generateButton}
            disabled={isLoading || !className.trim()}
          >
            {isLoading ? 'Generating...' : 'Generate'}
          </button>
        </div>
        {error && <p className={styles.errorMessage}>{error}</p>}
        {/* Loading indicator can stay in top section or move, let's keep it here for now */}
        {isLoading && !characterData && <div className={styles.loadingIndicator}>Generating character... please wait.</div>}
      </div>

      {/* Main Content Area - Attach wheel listener here */}
      <div className={styles.mainContentArea} onWheel={handleWheelScroll}>
        {/* Fixed Background Image - Rendered only when data exists */}
        {characterData && (
          <div className={styles.fixedBackground}>
            <CharacterImageDisplay
              imageUrl={characterData.fullBodyImageUrl}
              altText={`${characterData.className} full body`}
              isLoading={false} // Already loaded if characterData exists
            />
          </div>
        )}

        {/* Carousel Content Area - Replaces Scroll Container */}
        {/* Render content only when not initially loading OR when data is present */}
        {(characterData || !isLoading) && characterData && (
          <div
            className={`${styles.carouselContent} ${
              !isInfoViewActive ? styles.cardsViewActive : ''
            }`}
          >
            {/* Info Cards Section */}
            <div className={styles.infoCardsSection}>
              <InfoCard
                title="Description & Backstory"
                content={characterData.descriptionAndBackstory}
              />
              <InfoCard
                title="Class Features"
                content={characterData.classFeatures}
                imageUrl={characterData.facialPortraitImageUrl}
                imageAlt={`${characterData.className} facial portrait`}
              />
            </div>

            {/* Starting Cards Section */}
            <div className={styles.startingCardsSectionWrapper}>
              <StartingCardsSection startingCards={characterData.startingCards} />
            </div>
          </div>
        )}

        {/* Show loading indicator - position might need adjustment if it was inside scroll area */}
        {isLoading && characterData && <div className={styles.loadingIndicator}>Regenerating...</div>}
        {/* Note: The initial loading indicator is still in the topSection */}

      </div>
    </div>
  );
}

export default CharacterCreatorScreen;
