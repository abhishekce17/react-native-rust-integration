use crate::physics::{
    apply_paddle_bounce, resolve_ball_brick_collision,
    BALL_RADIUS, BASE_BALL_SPEED, PADDLE_DEFAULT_WIDTH, PADDLE_HEIGHT, PADDLE_WIDE_WIDTH,
    POWERUP_FALL_SPEED,
};
use crate::types::{
    ActivePowerUp, Ball, Brick, BrickType, FallingPowerUp, GameState, Paddle, PowerUpType,
    EVENT_BRICK_DESTROY, EVENT_BRICK_HIT, EVENT_GAME_OVER, EVENT_LEVEL_COMPLETED, EVENT_LIFE_LOST,
    EVENT_PADDLE_HIT, EVENT_POWERUP_COLLECT,
};
use rand::Rng;
use std::f32::consts::PI;

pub struct RustGame {
    pub width: f32,
    pub height: f32,
    pub paddle: Paddle,
    pub balls: Vec<Ball>,
    pub bricks: Vec<Brick>,
    pub falling_powerups: Vec<FallingPowerUp>,
    pub active_powerups: Vec<ActivePowerUp>,
    pub score: u32,
    pub lives: u32,
    pub max_lives: u32,
    pub level: u32,
    pub combo: f32,
    pub combo_decay_timer: f32,
    pub state: GameState,
    pub is_launched: bool,
    pub aim_angle: f32,
    pub events: u32,
    aim_time: f32,
    next_id: u32,

    // Contiguous float buffers exported to C++ for fast JSI buffer copying
    balls_buffer: Vec<f32>,
    bricks_buffer: Vec<f32>,
    powerups_buffer: Vec<f32>,
}

impl RustGame {
    pub fn new(width: f32, height: f32) -> Self {
        let paddle_y = height - 115.0;
        let paddle = Paddle {
            x: (width - PADDLE_DEFAULT_WIDTH) * 0.5,
            y: paddle_y,
            width: PADDLE_DEFAULT_WIDTH,
            height: PADDLE_HEIGHT,
            tilt: 0.0,
            default_width: PADDLE_DEFAULT_WIDTH,
            wide_width: PADDLE_WIDE_WIDTH,
        };

        let initial_ball = Ball {
            id: 1,
            x: paddle.x + paddle.width * 0.5,
            y: paddle.y - BALL_RADIUS - 4.0,
            vx: 0.0,
            vy: 0.0,
            radius: BALL_RADIUS,
            speed: BASE_BALL_SPEED,
        };

        let bricks = Self::generate_stage_bricks(width, 36.0);

        Self {
            width,
            height,
            paddle,
            balls: vec![initial_ball],
            bricks,
            falling_powerups: Vec::new(),
            active_powerups: Vec::new(),
            score: 0,
            lives: 3,
            max_lives: 3,
            level: 1,
            combo: 1.0,
            combo_decay_timer: 0.0,
            state: GameState::ReadyToLaunch,
            is_launched: false,
            aim_angle: -PI / 2.3,
            events: 0,
            aim_time: 0.0,
            next_id: 10,
            balls_buffer: Vec::new(),
            bricks_buffer: Vec::new(),
            powerups_buffer: Vec::new(),
        }
    }

    pub fn generate_stage_bricks(canvas_width: f32, top_offset: f32) -> Vec<Brick> {
        let cols = 6;
        let padding_h = 14.0;
        let gap_x = 7.0;
        let gap_y = 8.0;
        let total_gaps = (cols as f32 - 1.0) * gap_x;
        let available_width = canvas_width - padding_h * 2.0 - total_gaps;
        let brick_width = (available_width / cols as f32).floor();
        let brick_height = (brick_width * 0.48).round();
        let start_x = ((canvas_width - (cols as f32 * brick_width + total_gaps)) / 2.0).floor();

        let stage_grid: [[BrickType; 6]; 4] = [
            [
                BrickType::Red,
                BrickType::Red,
                BrickType::Red,
                BrickType::Red,
                BrickType::Red,
                BrickType::Red,
            ],
            [
                BrickType::Blue,
                BrickType::Metal,
                BrickType::Blue,
                BrickType::Blue,
                BrickType::Metal,
                BrickType::Blue,
            ],
            [
                BrickType::Yellow,
                BrickType::Yellow,
                BrickType::Metal,
                BrickType::Metal,
                BrickType::Yellow,
                BrickType::Yellow,
            ],
            [
                BrickType::Purple,
                BrickType::Purple,
                BrickType::Purple,
                BrickType::Purple,
                BrickType::Purple,
                BrickType::Purple,
            ],
        ];

        let mut bricks = Vec::with_capacity(24);
        let mut id = 1;
        for (r_idx, row) in stage_grid.iter().enumerate() {
            for (c_idx, &b_type) in row.iter().enumerate() {
                let x = start_x + c_idx as f32 * (brick_width + gap_x);
                let y = top_offset + r_idx as f32 * (brick_height + gap_y);
                bricks.push(Brick {
                    id,
                    row: r_idx,
                    col: c_idx,
                    x,
                    y,
                    width: brick_width,
                    height: brick_height,
                    brick_type: b_type,
                    hp: b_type.max_hp(),
                    destroyed: false,
                });
                id += 1;
            }
        }
        bricks
    }

    pub fn generate_random_bricks(level: u32, canvas_width: f32, top_offset: f32) -> Vec<Brick> {
        let rows = 4;
        let cols = 6;
        let padding_h = 14.0;
        let gap_x = 7.0;
        let gap_y = 8.0;
        let total_gaps = (cols as f32 - 1.0) * gap_x;
        let available_width = canvas_width - padding_h * 2.0 - total_gaps;
        let brick_width = (available_width / cols as f32).floor();
        let brick_height = (brick_width * 0.48).round();
        let start_x = ((canvas_width - (cols as f32 * brick_width + total_gaps)) / 2.0).floor();

        let mut rng = rand::thread_rng();
        let fill_chance = (0.65 + level.saturating_sub(1) as f64 * 0.05).min(0.95);
        let brick_types = [
            BrickType::Red,
            BrickType::Blue,
            BrickType::Yellow,
            BrickType::Purple,
            BrickType::Metal,
        ];

        let mut bricks = Vec::new();
        let mut id = 1;

        for r_idx in 0..rows {
            for c_idx in 0..cols {
                if rng.gen_bool(fill_chance) {
                    let b_type = brick_types[rng.gen_range(0..brick_types.len())];
                    let x = start_x + c_idx as f32 * (brick_width + gap_x);
                    let y = top_offset + r_idx as f32 * (brick_height + gap_y);
                    bricks.push(Brick {
                        id,
                        row: r_idx,
                        col: c_idx,
                        x,
                        y,
                        width: brick_width,
                        height: brick_height,
                        brick_type: b_type,
                        hp: b_type.max_hp(),
                        destroyed: false,
                    });
                    id += 1;
                }
            }
        }

        if bricks.is_empty() {
            return Self::generate_stage_bricks(canvas_width, top_offset);
        }

        bricks
    }

    pub fn launch(&mut self) {
        if self.is_launched || self.state != GameState::ReadyToLaunch {
            return;
        }

        self.is_launched = true;
        self.state = GameState::Active;
        let initial_ball = Ball {
            id: 1,
            x: self.paddle.x + self.paddle.width * 0.5,
            y: self.paddle.y - BALL_RADIUS - 4.0,
            vx: self.aim_angle.cos() * BASE_BALL_SPEED,
            vy: self.aim_angle.sin() * BASE_BALL_SPEED,
            radius: BALL_RADIUS,
            speed: BASE_BALL_SPEED,
        };
        self.balls = vec![initial_ball];
    }

    pub fn reset_ball_on_paddle(&mut self) {
        self.is_launched = false;
        self.state = if self.lives == 1 {
            GameState::LastLife
        } else {
            GameState::ReadyToLaunch
        };
        let reset_ball = Ball {
            id: 1,
            x: self.paddle.x + self.paddle.width * 0.5,
            y: self.paddle.y - BALL_RADIUS - 4.0,
            vx: 0.0,
            vy: 0.0,
            radius: BALL_RADIUS,
            speed: BASE_BALL_SPEED,
        };
        self.balls = vec![reset_ball];
        self.falling_powerups.clear();
    }

    pub fn reset(&mut self) {
        self.score = 0;
        self.lives = 3;
        self.combo = 1.0;
        self.combo_decay_timer = 0.0;
        self.level = 1;
        self.events = 0;
        self.bricks = Self::generate_stage_bricks(self.width, 36.0);
        self.active_powerups.clear();
        self.falling_powerups.clear();
        self.paddle.width = self.paddle.default_width;
        self.reset_ball_on_paddle();
    }

    pub fn get_events(&mut self) -> u32 {
        let ev = self.events;
        self.events = 0;
        ev
    }

    pub fn get_aim_angle(&self) -> f32 {
        self.aim_angle
    }

    pub fn get_level(&self) -> u32 {
        self.level
    }

    pub fn set_level(&mut self, level: u32) {
        self.level = level;
        self.combo = 1.0;
        self.combo_decay_timer = 0.0;
        self.events = 0;
        self.bricks = if level == 1 {
            Self::generate_stage_bricks(self.width, 36.0)
        } else {
            Self::generate_random_bricks(level, self.width, 36.0)
        };
        self.active_powerups.clear();
        self.falling_powerups.clear();
        self.paddle.width = self.paddle.default_width;
        self.reset_ball_on_paddle();
    }

    pub fn next_level(&mut self) {
        self.set_level(self.level + 1);
    }

    pub fn revive(&mut self) {
        self.lives = 1;
        self.state = GameState::ReadyToLaunch;
        self.reset_ball_on_paddle();
    }

    pub fn pause(&mut self) {
        if self.state == GameState::Active || self.state == GameState::LastLife {
            self.state = GameState::Paused;
        }
    }

    pub fn resume(&mut self) {
        if self.state == GameState::Paused {
            self.state = if self.lives == 1 {
                GameState::LastLife
            } else {
                GameState::Active
            };
        }
    }

    pub fn set_paddle(&mut self, x: f32, tilt: f32) {
        let max_x = (self.width - self.paddle.width).max(0.0);
        self.paddle.x = x.clamp(0.0, max_x);
        self.paddle.tilt = tilt.clamp(-1.0, 1.0);
    }

    pub fn spawn_tri_ball(&mut self) {
        if self.balls.is_empty() || self.balls.len() >= 8 {
            return;
        }
        let base = &self.balls[0];
        let speed = base.speed;
        let id1 = self.next_id;
        let id2 = self.next_id + 1;
        self.next_id += 2;

        let extra1 = Ball {
            id: id1,
            x: base.x,
            y: base.y,
            vx: -speed * 0.7,
            vy: -speed * 0.7,
            radius: BALL_RADIUS,
            speed,
        };
        let extra2 = Ball {
            id: id2,
            x: base.x,
            y: base.y,
            vx: speed * 0.7,
            vy: -speed * 0.7,
            radius: BALL_RADIUS,
            speed,
        };

        self.balls.push(extra1);
        self.balls.push(extra2);
    }

    pub fn step(&mut self, dt: f32) {
        let clamped_dt = dt.clamp(0.001, 0.033);

        // 1. Ready state: sweep aim angle and anchor ball to paddle
        if !self.is_launched && (self.state == GameState::ReadyToLaunch || self.state == GameState::LastLife) {
            self.aim_time += clamped_dt * 1.5;
            self.aim_angle = -PI / 2.0 + (self.aim_time.sin() * 0.4);
            if let Some(ball) = self.balls.first_mut() {
                ball.x = self.paddle.x + self.paddle.width * 0.5;
                ball.y = self.paddle.y - BALL_RADIUS - 4.0;
                ball.vx = 0.0;
                ball.vy = 0.0;
            }
            return;
        }

        if self.state == GameState::GameOver || self.state == GameState::LevelCompleted || self.state == GameState::Paused {
            return;
        }

        let mut rng = rand::thread_rng();

        // 2. Update active power-ups duration
        let mut is_wide_active = false;
        self.active_powerups.retain_mut(|pu| {
            pu.remaining -= clamped_dt;
            if pu.remaining > 0.0 {
                if pu.power_type == PowerUpType::Wide {
                    is_wide_active = true;
                }
                true
            } else {
                false
            }
        });
        self.paddle.width = if is_wide_active {
            self.paddle.wide_width
        } else {
            self.paddle.default_width
        };

        // 3. Update combo decay timer
        self.combo_decay_timer += clamped_dt;
        if self.combo_decay_timer > 4.5 {
            self.combo = 1.0;
        }

        // 4. Update falling power-ups
        let paddle = &self.paddle;
        let mut collected_powerups = Vec::new();
        self.falling_powerups.retain_mut(|pu| {
            pu.y += pu.vy * clamped_dt;

            // Catch test
            let in_x = pu.x >= paddle.x - 4.0 && pu.x <= paddle.x + paddle.width + 4.0;
            let in_y = pu.y + pu.radius >= paddle.y && pu.y - pu.radius <= paddle.y + paddle.height;

            if in_x && in_y {
                collected_powerups.push(pu.power_type);
                return false;
            }

            // Screen bottom limit
            pu.y <= paddle.y + 120.0
        });

        // Apply collected power-ups
        if !collected_powerups.is_empty() {
            self.events |= EVENT_POWERUP_COLLECT;
        }
        for pu_type in collected_powerups {
            match pu_type {
                PowerUpType::ExtraLife => {
                    self.lives = (self.lives + 1).min(self.max_lives);
                }
                PowerUpType::Wide => {
                    self.active_powerups.retain(|p| p.power_type != PowerUpType::Wide);
                    self.active_powerups.push(ActivePowerUp {
                        power_type: PowerUpType::Wide,
                        duration: 15.0,
                        remaining: 15.0,
                    });
                    self.paddle.width = self.paddle.wide_width;
                }
                PowerUpType::TriBall => {
                    self.spawn_tri_ball();
                }
            }
        }

        // 5. Update balls physics & collisions
        let mut drops_to_spawn: Vec<(f32, f32, PowerUpType)> = Vec::new();
        let field_w = self.width;
        let field_h = self.height;
        let mut surviving_balls = Vec::with_capacity(self.balls.len());

        for mut ball in self.balls.drain(..) {
            let mut next_x = ball.x + ball.vx * clamped_dt;
            let mut next_y = ball.y + ball.vy * clamped_dt;
            let r = ball.radius;

            // Left & Right walls
            if next_x - r <= 0.0 {
                next_x = r;
                ball.vx = ball.vx.abs();
            } else if next_x + r >= field_w {
                next_x = field_w - r;
                ball.vx = -ball.vx.abs();
            }

            // Ceiling
            if next_y - r <= 16.0 {
                next_y = 16.0 + r;
                ball.vy = ball.vy.abs();
            }

            // Paddle collision
            let hit_paddle_x = next_x >= self.paddle.x - 4.0 && next_x <= self.paddle.x + self.paddle.width + 4.0;
            let hit_paddle_y = next_y + r >= self.paddle.y && next_y - r <= self.paddle.y + self.paddle.height;

            if hit_paddle_x && hit_paddle_y && ball.vy > 0.0 {
                apply_paddle_bounce(&mut ball, &self.paddle);
                self.events |= EVENT_PADDLE_HIT;
                next_x = ball.x;
                next_y = ball.y;
            }

            // Brick collisions (resolve at most 1 brick collision per frame per ball)
            for brick in self.bricks.iter_mut() {
                let (hit, is_destroyed, points) = resolve_ball_brick_collision(&mut ball, brick);
                if hit {
                    next_x = ball.x;
                    next_y = ball.y;
                    if is_destroyed {
                        self.events |= EVENT_BRICK_DESTROY;
                    } else {
                        self.events |= EVENT_BRICK_HIT;
                    }

                    if points > 0 {
                        self.score += (points as f32 * self.combo).round() as u32;
                        self.combo = (self.combo + 0.5).min(10.0);
                        self.combo_decay_timer = 0.0;
                    }

                    // Check power-up drop
                    let drop_chance = match brick.brick_type {
                        BrickType::Metal => 0.50,
                        _ => 0.28,
                    };

                    if is_destroyed && rng.gen_bool(drop_chance) {
                        let pu_pool = [PowerUpType::Wide, PowerUpType::TriBall, PowerUpType::ExtraLife];
                        let chosen = pu_pool[rng.gen_range(0..pu_pool.len())];
                        drops_to_spawn.push((brick.x + brick.width * 0.5, brick.y + brick.height * 0.5, chosen));
                    }
                    break;
                }
            }

            ball.x = next_x;
            ball.y = next_y;

            // Retain ball if within playable height
            if next_y <= field_h {
                surviving_balls.push(ball);
            }
        }

        self.balls = surviving_balls;

        // Spawn drops
        for (dx, dy, pu_type) in drops_to_spawn {
            let id = self.next_id;
            self.next_id += 1;
            self.falling_powerups.push(FallingPowerUp {
                id,
                power_type: pu_type,
                x: dx,
                y: dy,
                vy: POWERUP_FALL_SPEED,
                radius: 12.0,
            });
        }

        // Check if all balls were lost
        if self.balls.is_empty() {
            self.is_launched = false;
            self.lives = self.lives.saturating_sub(1);
            if self.lives == 0 {
                self.state = GameState::GameOver;
                self.events |= EVENT_GAME_OVER;
            } else {
                self.events |= EVENT_LIFE_LOST;
                self.reset_ball_on_paddle();
            }
            return;
        }

        // Check if all bricks cleared
        let remaining_bricks = self.bricks.iter().filter(|b| !b.destroyed).count();
        if remaining_bricks == 0 {
            self.state = GameState::LevelCompleted;
            self.events |= EVENT_LEVEL_COMPLETED;
        }
    }

    /// Packs active ball coordinates into contiguous float slice [id, x, y, radius]
    pub fn get_balls_data(&mut self) -> &[f32] {
        self.balls_buffer.clear();
        for b in &self.balls {
            self.balls_buffer.push(b.id as f32);
            self.balls_buffer.push(b.x);
            self.balls_buffer.push(b.y);
            self.balls_buffer.push(b.radius);
        }
        &self.balls_buffer
    }

    /// Packs brick data into contiguous float slice [id, x, y, width, height, type, hp, destroyed]
    pub fn get_bricks_data(&mut self) -> &[f32] {
        self.bricks_buffer.clear();
        for b in &self.bricks {
            self.bricks_buffer.push(b.id as f32);
            self.bricks_buffer.push(b.x);
            self.bricks_buffer.push(b.y);
            self.bricks_buffer.push(b.width);
            self.bricks_buffer.push(b.height);
            self.bricks_buffer.push(b.brick_type as u8 as f32);
            self.bricks_buffer.push(b.hp as f32);
            self.bricks_buffer.push(if b.destroyed { 1.0 } else { 0.0 });
        }
        &self.bricks_buffer
    }

    /// Packs falling powerups into contiguous float slice [id, x, y, radius, type]
    pub fn get_powerups_data(&mut self) -> &[f32] {
        self.powerups_buffer.clear();
        for pu in &self.falling_powerups {
            self.powerups_buffer.push(pu.id as f32);
            self.powerups_buffer.push(pu.x);
            self.powerups_buffer.push(pu.y);
            self.powerups_buffer.push(pu.radius);
            self.powerups_buffer.push(pu.power_type as u8 as f32);
        }
        &self.powerups_buffer
    }
}
