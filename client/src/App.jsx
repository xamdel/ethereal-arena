import { useGameStore } from './store/useGameStore';
import { useSocketEvents } from './hooks/useSocketEvents';
import { useScreenManager } from './hooks/useScreenManager';
import { useGameActions } from './hooks/useGameActions';
import './App.css'; // Keep default styles for now
import StartScreen from './screens/StartScreen';
import CardSelectionScreen from './screens/CardSelectionScreen';
import GameScreen from './screens/GameScreen';
import CharacterCreatorScreen from './screens/CharacterCreatorScreen'; // Added import

// Placeholder Screen Components (we'll create these later)
// Removed placeholder StartScreen function
// Removed placeholder CardSelectionScreen function
// Removed placeholder GameScreen function


function App() {
  // Select state needed for rendering
  const isConnected = useGameStore((state) => state.isConnected);
  const storeError = useGameStore((state) => state.error);
  const gameState = useGameStore((state) => state.gameState); // Needed for CardSelectionScreen props
  const playerId = useGameStore((state) => state.playerId); // Needed for CardSelectionScreen props

  // Manage screen state and navigation
  const {
    currentScreen,
    navigateToCreator,
    navigateToSelection,
    navigateToGame,
  } = useScreenManager();

  // Manage game actions
  const { startGame, selectCards } = useGameActions();

  // Setup socket event listeners (passes navigation functions)
  useSocketEvents(navigateToSelection, navigateToGame);

  // Old useEffect and handlers removed. Logic is now in hooks.


  // --- Render Logic ---
  const renderScreen = () => {
    if (!isConnected) {
      // TODO: Add a more robust loading/error state for initial connection
      return <div style={{ padding: '2rem', color: 'white', textAlign: 'center' }}>Connecting to server...</div>;
    }
    switch (currentScreen) {
      case 'creator':
        // TODO: Add props if needed, e.g., a function to navigate back or to game start
        return <CharacterCreatorScreen />;
      case 'selection':
        // Pass the generated cards (assuming they are in gameState.players[playerId].hand)
        // Also pass the selectCards action from the hook
        const player = gameState?.players[playerId]; // Use playerId from store directly
        return <CardSelectionScreen cards={player?.hand || []} onSelect={selectCards} />;
      case 'game':
        return <GameScreen />;
      case 'start':
      default:
        // Pass the startGame and navigateToCreator actions from hooks
        return <StartScreen onGameStart={startGame} onNavigateToCreator={navigateToCreator} />;
    }
  };

  return (
    <div className="App">
      {/* Basic connection indicator */}
      {/* <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p> */}
      {renderScreen()}
      {/* Display error from store state */}
      {storeError && (
         <p style={{ color: 'red', position: 'fixed', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.7)', padding: '5px 10px', borderRadius: '4px' }}>
           Error: {storeError}
         </p>
      )}
    </div>
  );
}

export default App;
