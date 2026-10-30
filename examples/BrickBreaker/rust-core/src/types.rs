pub const EVENT_PADDLE_HIT: u32 = 1 << 0;
pub const EVENT_BRICK_HIT: u32 = 1 << 1;
pub const EVENT_BRICK_DESTROY: u32 = 1 << 2;
pub const EVENT_POWERUP_COLLECT: u32 = 1 << 3;
pub const EVENT_LIFE_LOST: u32 = 1 << 4;
pub const EVENT_LEVEL_COMPLETED: u32 = 1 << 5;
pub const EVENT_GAME_OVER: u32 = 1 << 6;

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BrickType {
    Red = 0,
    Blue = 1,
    Yellow = 2,
    Purple = 3,
    Metal = 4,
}

impl BrickType {
    pub fn max_hp(&self) -> u8 {
        match self {
            BrickType::Metal => 4,
            _ => 1,
        }
    }

    pub fn points(&self) -> u32 {
        match self {
            BrickType::Metal => 500,
            _ => 100,
        }
    }
}

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PowerUpType {
    Wide = 0,
    TriBall = 1,
    ExtraLife = 2,
}

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GameState {
    ReadyToLaunch = 0,
    Active = 1,
    LastLife = 2,
    LevelCompleted = 3,
    GameOver = 4,
    Paused = 5,
}

#[derive(Debug, Clone)]
pub struct Ball {
    pub id: u32,
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
    pub radius: f32,
    pub speed: f32,
}

#[derive(Debug, Clone)]
pub struct Paddle {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub tilt: f32,
    pub default_width: f32,
    pub wide_width: f32,
}

#[derive(Debug, Clone)]
pub struct Brick {
    pub id: u32,
    pub row: usize,
    pub col: usize,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub brick_type: BrickType,
    pub hp: u8,
    pub destroyed: bool,
}

#[derive(Debug, Clone)]
pub struct FallingPowerUp {
    pub id: u32,
    pub power_type: PowerUpType,
    pub x: f32,
    pub y: f32,
    pub vy: f32,
    pub radius: f32,
}

#[derive(Debug, Clone)]
pub struct ActivePowerUp {
    pub power_type: PowerUpType,
    pub duration: f32,
    pub remaining: f32,
}

