/**
 * Centralized Game Sprite Asset Registry
 * Only active production assets are exported.
 */
export const GAME_ASSETS = {
  balls: {
    standard: require('./balls/ball_standard.png'),
    cyan: require('./balls/ball_cyan.png'),
  },
  paddles: {
    standard: require('./paddles/paddle_cyan_standard.png'),
    long: require('./paddles/paddle_cyan_long.png'),
  },
  bricks: {
    cyan: require('./bricks/brick_cyan.png'),
    red: require('./bricks/brick_red.png'),
    blue: require('./bricks/brick_blue.png'),
    yellow: require('./bricks/brick_yellow.png'),
    purple: require('./bricks/brick_purple.png'),
    metalHp4: require('./bricks/metal_stage_4hp.png'),
    metalHp3: require('./bricks/metal_stage_3hp.png'),
    metalHp2: require('./bricks/metal_stage_2hp.png'),
    metalHp1: require('./bricks/metal_stage_1hp.png'),
  },
  powerups: {
    expand: require('./powerups/powerup_expand.png'),
    triball: require('./powerups/powerup_multiball.png'),
    extralife: require('./powerups/powerup_extra_life.png'),
  },
  environment: {
    splashArt: require('./splash_art_clean.png'),
  },
  ui: {
    homeLogo: require('./cosmic_bricks_logo.png'),
    homePlayButton: require('./play_button_transparent.png'),
    heartLife: require('./ui/heart_life.png'),
    star: require('./ui/icon_star.png'),
  },
};
