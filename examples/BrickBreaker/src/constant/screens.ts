/**
 * Central Screen Route Identifiers
 * Simplified to 3 Core Screens: Splash, Home, Gameplay
 */
export const SCREENS = {
  SPLASH: 'Splash',
  HOME: 'Home',
  GAMEPLAY: 'Gameplay',
} as const;

export type ScreenName = (typeof SCREENS)[keyof typeof SCREENS];
