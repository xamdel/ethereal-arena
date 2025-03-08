import { GameState, Card, Player, StatusEffect, ActionType } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Mock cards for testing
export const mockCards: Card[] = [
  {
    id: uuidv4(),
    name: "Fireball",
    cost: 2,
    base_effects: "Deal 6 damage to the opponent.",
    description: "A blazing orb of fire that deals damage to your opponent.",
    wildcard_effect: "Leaves a burn effect that deals 2 damage at the end of the turn.",
    art_prompt: "A blazing orb of fire floating above a mage's hand, ready to be unleashed.",
    flavor_text: "Burn, baby, burn!",
    on_play_description: "[player] casts a fireball at [opponent].",
    createdAt: Date.now() - 1000,
    createdBy: "system"
  },
  {
    id: uuidv4(),
    name: "Healing Light",
    cost: 2,
    base_effects: "Heal 4 health to self.",
    description: "A soothing light that restores health.",
    wildcard_effect: "Removes one negative status effect if any are present.",
    art_prompt: "A gentle beam of golden light descending from above, washing over a wounded figure.",
    flavor_text: "Feel the warmth of the light.",
    on_play_description: "[player] channels a healing light.",
    createdAt: Date.now() - 900,
    createdBy: "system"
  },
  {
    id: uuidv4(),
    name: "Energy Surge",
    cost: 1,
    base_effects: "Gain 2 energy.",
    description: "Harness raw energy to fuel your next moves.",
    wildcard_effect: "If your energy was at 0 when played, draw an additional card.",
    art_prompt: "Crackling blue energy swirling around a character, illuminating them with power.",
    flavor_text: "Unlimited power!",
    on_play_description: "[player] absorbs surrounding energy.",
    createdAt: Date.now() - 800,
    createdBy: "system"
  },
  {
    id: uuidv4(),
    name: "Stone Shield",
    cost: 1,
    base_effects: "Gain 5 block.",
    description: "Summons a protective barrier of stone.",
    wildcard_effect: "If you already had block, gain 2 additional block.",
    art_prompt: "Rugged stone plates forming a protective shield around a character.",
    flavor_text: "A bulwark against any assault.",
    on_play_description: "[player] raises a stone shield.",
    createdAt: Date.now() - 700,
    createdBy: "system"
  },
  {
    id: uuidv4(),
    name: "Lightning Strike",
    cost: 3,
    base_effects: "Deal 10 damage to the opponent.",
    description: "Calls down a bolt of lightning on your opponent.",
    wildcard_effect: "Has a 20% chance to hit twice.",
    art_prompt: "A brilliant fork of lightning crashing down from storm clouds onto an opponent.",
    flavor_text: "Feel the power of the storm!",
    on_play_description: "[player] calls down lightning.",
    createdAt: Date.now() - 600,
    createdBy: "system"
  }
];

// Mock status effects
export const mockStatusEffects: StatusEffect[] = [
  {
    id: uuidv4(),
    name: "Burn",
    description: "Taking 2 damage at the end of each turn.",
    duration: 3
  },
  {
    id: uuidv4(),
    name: "Energized",
    description: "Gain 1 extra energy at the start of your turn.",
    duration: 2
  },
  {
    id: uuidv4(),
    name: "Weakness",
    description: "Your attack cards deal 25% less damage.",
    duration: 2
  }
];

// Create mock players
export const createMockPlayers = (): Record<string, Player> => {
  const playerId = uuidv4();
  const opponentId = uuidv4();
  
  // Distribute cards to hand and deck
  const playerCards = [...mockCards.slice(0, 3)];
  const playerDeckCards = [
    ...Array(7).fill(null).map(() => mockCards[Math.floor(Math.random() * mockCards.length)])
  ];
  
  const opponentCards = [...mockCards.slice(2, 4)];
  const opponentDeckCards = [
    ...Array(7).fill(null).map(() => mockCards[Math.floor(Math.random() * mockCards.length)])
  ];
  
  return {
    [playerId]: {
      id: playerId,
      name: "Player",
      hp: 75,
      maxHp: 80,
      block: 3,
      energy: 4,
      maxEnergy: 5,
      draw: 5,
      hand: playerCards,
      deck: playerDeckCards,
      discard: [],
      statusEffects: [mockStatusEffects[1]],
      isActive: true,
      isAI: false
    },
    [opponentId]: {
      id: opponentId,
      name: "Opponent",
      hp: 65,
      maxHp: 80,
      block: 0,
      energy: 3,
      maxEnergy: 5,
      draw: 5,
      hand: opponentCards,
      deck: opponentDeckCards,
      discard: [],
      statusEffects: [mockStatusEffects[0]],
      isActive: false,
      isAI: true
    }
  };
};

// Create a mock game state
export const createMockGameState = (): GameState => {
  const gameId = uuidv4();
  const players = createMockPlayers();
  const playerIds = Object.keys(players);
  
  return {
    id: gameId,
    players,
    activePlayerId: playerIds[0],
    turnNumber: 3,
    phase: "action",
    effectQueue: [
      {
        id: uuidv4(),
        type: "damage",
        value: 5,
        source: playerIds[0],
        target: playerIds[1],
        timing: "immediate",
        timestamp: Date.now(),
        actionId: uuidv4()
      }
    ],
    actionHistory: [
      {
        id: uuidv4(),
        type: ActionType.GAME_INIT,
        playerId: "system",
        payload: {},
        timestamp: Date.now() - 5000,
        gameId,
        validated: true
      },
      {
        id: uuidv4(),
        type: ActionType.PLAY_CARD,
        playerId: playerIds[1],
        payload: { cardId: mockCards[0].id },
        timestamp: Date.now() - 3000,
        gameId,
        validated: true
      },
      {
        id: uuidv4(),
        type: ActionType.END_TURN,
        playerId: playerIds[1],
        payload: {},
        timestamp: Date.now() - 2000,
        gameId,
        validated: true
      }
    ],
    turnStartTime: Date.now() - 10000,
    lastUpdateTime: Date.now(),
    winner: null,
    isMultiplayer: false
  };
};
