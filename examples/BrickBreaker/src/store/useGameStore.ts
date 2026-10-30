import { create } from 'zustand';
import { ThemeId } from '../types/game';

interface GameState {
  // Player Stats & Economy
  score: number;
  highScore: number;
  combo: number;
  lives: number;
  maxLives: number;
  level: number;
  levelName: string;
  coins: number;
  gems: number;

  // Progression
  unlockedLevels: number;
  levelStars: Record<number, number>;
  totalBricksDestroyed: number;

  // Customization
  themeId: ThemeId;
  paddleSkin: string;
  ballSkin: string;

  // Actions
  addScore: (points: number) => void;
  setHighScore: (score: number) => void;
  incrementCombo: () => void;
  resetCombo: () => void;
  decrementLife: () => number;
  addLife: (amount?: number) => void;
  resetLives: () => void;
  setLevel: (level: number, name?: string) => void;
  completeLevel: (stars: number) => void;
  setThemeId: (themeId: ThemeId) => void;
  addCoins: (amount: number) => void;
  incrementBricksDestroyed: (count?: number) => void;
  resetRun: () => void;
}

const LEVEL_NAMES: Record<number, string> = {
  1: 'Asteroid Belt',
  2: 'Solar Flare',
  3: 'Crystal Caverns',
  4: 'Nebula Rift',
  5: 'Magnetic Galaxy',
  6: 'Plasma Core',
  7: 'Quantum Horizon',
  8: 'Cosmic Supernova',
};

export const useGameStore = create<GameState>((set, get) => ({
  score: 0,
  highScore: 342100,
  combo: 1.0,
  lives: 3,
  maxLives: 3,
  level: 1,
  levelName: LEVEL_NAMES[1] || 'Quantum Horizon',
  coins: 1450,
  gems: 85,

  unlockedLevels: 7,
  levelStars: {
    1: 3,
    2: 3,
    3: 2,
    4: 3,
    5: 2,
    6: 1,
  },
  totalBricksDestroyed: 1240,

  themeId: 'cyber',
  paddleSkin: 'paddle_cyan_standard',
  ballSkin: 'ball_cyan',

  addScore: (points: number) =>
    set(state => {
      const newScore = state.score + points;
      const newHighScore = Math.max(state.highScore, newScore);
      return { score: newScore, highScore: newHighScore };
    }),

  setHighScore: (score: number) => set({ highScore: score }),

  incrementCombo: () =>
    set(state => ({
      combo: Math.min(10.0, +(state.combo + 0.5).toFixed(1)),
    })),

  resetCombo: () => set({ combo: 1.0 }),

  decrementLife: () => {
    const nextLives = Math.max(0, get().lives - 1);
    set({ lives: nextLives });
    return nextLives;
  },

  addLife: (amount: number = 1) =>
    set(state => ({
      lives: Math.min(state.maxLives, state.lives + amount),
    })),

  resetLives: () =>
    set(state => ({
      lives: state.maxLives,
    })),

  setLevel: (level: number, name?: string) =>
    set({
      level,
      levelName: name || LEVEL_NAMES[level] || `Sector ${level}`,
      combo: 1.0,
    }),

  completeLevel: (stars: number) =>
    set(state => {
      const nextLevel = state.level + 1;
      const updatedStars = {
        ...state.levelStars,
        [state.level]: Math.max(state.levelStars[state.level] || 0, stars),
      };
      const unlocked = Math.max(state.unlockedLevels, nextLevel);
      const earnedCoins = stars * 150 + 200;

      return {
        levelStars: updatedStars,
        unlockedLevels: unlocked,
        coins: state.coins + earnedCoins,
      };
    }),

  setThemeId: (themeId: ThemeId) => set({ themeId }),

  addCoins: (amount: number) => set(state => ({ coins: state.coins + amount })),

  incrementBricksDestroyed: (count: number = 1) =>
    set(state => ({ totalBricksDestroyed: state.totalBricksDestroyed + count })),

  resetRun: () =>
    set(state => ({
      score: 0,
      combo: 1.0,
      lives: state.maxLives,
    })),
}));
