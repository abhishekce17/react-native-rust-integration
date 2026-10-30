export type BrickType =
  | 'red'
  | 'blue'
  | 'yellow'
  | 'purple'
  | 'metal'       // 4-hit heavy metal armored brick
  | 'prism'       // Cyan electric crystal
  | 'plasma'      // Blazing orange / fire explosive
  | 'shield'      // Armored magenta / heavy defense
  | 'quantum'     // Lime / emerald multiplier
  | 'supernova'   // Solar gold / rare high score
  | 'obsidian';   // Dark metallic / indestructible

export interface Brick {
  id: string;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: BrickType;
  hp: number;
  maxHp: number;
  points: number;
  isDestroyed: boolean;
  glowColor: string;
  badge?: string;
}

export type PowerUpType =
  | 'triball'    // Spawns 2 extra balls
  | 'wide'       // Paddle width extension
  | 'extralife'; // +1 Life restore

export interface PowerUp {
  id: PowerUpType;
  name: string;
  subtitle: string;
  icon: string;
  color: string;
  secondaryColor: string;
  active: boolean;
  duration: number;   // In seconds
  remaining: number;  // In seconds
}

export interface ActiveBall {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
  isFireball?: boolean;
}

export interface FallingPowerUp {
  id: string;
  type: PowerUpType;
  x: number;
  y: number;
  vy: number;
  radius: number;
  color: string;
}

export type GameplayState =
  | 'READY_TO_LAUNCH'  // S18: Ball poised on paddle, aiming
  | 'ACTIVE'           // S19: Ball moving, physics loop
  | 'LAST_LIFE'        // S20: 1 life remaining alert
  | 'BOSS_LEVEL'       // S21: Boss encounter
  | 'LEVEL_COMPLETED'  // S22: Stage cleared
  | 'GAME_OVER'        // S23: All lives depleted
  | 'PAUSED';          // M01: Game suspended

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  opacity: number;
}

export interface SparkParticle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  alpha: number;
}

export type ThemeId = 'cyber' | 'synthwave' | 'matrix' | 'solar';

export interface ColorTheme {
  id: ThemeId;
  name: string;
  accent: string;
  accentGlow: string;
  secondary: string;
  backgroundStart: string;
  backgroundEnd: string;
  gridLine: string;
  paddlePrimary: string;
  paddleSecondary: string;
  ballCore: string;
  ballGlow: string;
  hudCardBg: string;
  hudBorder: string;
}

export interface PlayerStats {
  score: number;
  highScore: number;
  level: number;
  lives: number;
  maxLives: number;
  coins: number;
  gems: number;
  totalBricksDestroyed: number;
  gamesPlayed: number;
  gamesWon: number;
}
