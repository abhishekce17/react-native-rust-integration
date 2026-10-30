/**
 * Core Game Engine and Gameplay Rules Configuration
 */
export const GAME_CONFIG = {
  // Lives & Health
  DEFAULT_LIVES: 3,
  MAX_LIVES: 5,
  LAST_LIFE_THRESHOLD: 1,

  // Ball Physics
  BASE_BALL_SPEED: 460, // pixels per second
  MAX_BALL_SPEED: 780,
  BALL_SPEED_RAMP_PER_HIT: 4, // subtle acceleration
  MAX_ACTIVE_BALLS: 6,
  BALL_RADIUS: 14,

  // Paddle Physics
  PADDLE_HEIGHT: 22,
  PADDLE_DEFAULT_WIDTH: 130,
  PADDLE_WIDE_WIDTH: 168,
  PADDLE_MAX_DEFLECTION_ANGLE: (Math.PI / 180) * 65, // Max 65 degree bounce
  PADDLE_Y_OFFSET: 115,

  // Power-Ups
  POWERUP_FALL_SPEED: 160, // pixels per second
  POWERUP_DROP_CHANCE: 0.28, // 28% drop chance on brick shatter
  POWERUP_DURATIONS: {
    triball: 12,
    wide: 16,
  },

  // Scoring & Combos
  BASE_POINTS_PER_BRICK: 100,
  COMBO_INCREMENT: 0.5,
  COMBO_MAX: 10.0,
  COMBO_DECAY_TIME: 4.5, // seconds without hitting a brick resets combo

  // Visuals & Particles
  SPARK_PARTICLES_HIT: 8,
  SPARK_PARTICLES_DESTROY: 16,
  MAX_ACTIVE_SPARKS: 60,
  MAX_FLOATING_TEXTS: 12,
};
