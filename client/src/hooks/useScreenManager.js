import { useState, useCallback } from 'react';

// Manages the current screen state and provides navigation functions.
export const useScreenManager = (initialScreen = 'start') => {
  const [currentScreen, setCurrentScreen] = useState(initialScreen); // 'start', 'creator', 'selection', 'game'

  const navigateToStart = useCallback(() => {
    console.log("Navigating to Start Screen");
    setCurrentScreen('start');
  }, []);

  const navigateToCreator = useCallback(() => {
    console.log("Navigating to Character Creator");
    setCurrentScreen('creator');
  }, []);

  const navigateToSelection = useCallback(() => {
    console.log("Navigating to Card Selection");
    setCurrentScreen('selection');
  }, []);

  const navigateToGame = useCallback(() => {
    console.log("Navigating to Game Screen");
    setCurrentScreen('game');
  }, []);

  return {
    currentScreen,
    navigateToStart,
    navigateToCreator,
    navigateToSelection,
    navigateToGame,
  };
};
