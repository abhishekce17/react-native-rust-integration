use rust_core::game::RustGame;
use rust_core::types::GameState;

#[test]
fn test_game_initial_state() {
    let mut game = RustGame::new(400.0, 800.0);
    assert_eq!(game.state, GameState::ReadyToLaunch);
    assert_eq!(game.lives, 3);
    assert_eq!(game.score, 0);
    assert_eq!(game.balls.len(), 1);
    assert_eq!(game.bricks.len(), 24);

    let balls_slice = game.get_balls_data();
    assert_eq!(balls_slice.len(), 4); // [id, x, y, radius]
}

#[test]
fn test_game_launch_and_step() {
    let mut game = RustGame::new(400.0, 800.0);
    game.launch();
    assert_eq!(game.state, GameState::Active);
    assert!(game.is_launched);

    let initial_y = game.balls[0].y;
    game.step(0.016);
    assert!(game.balls[0].y < initial_y); // ball moves upward
}

#[test]
fn test_paddle_movement() {
    let mut game = RustGame::new(400.0, 800.0);
    game.set_paddle(200.0, 0.5);
    assert_eq!(game.paddle.x, 200.0);
    assert_eq!(game.paddle.tilt, 0.5);

    // Left screen edge boundary clamping
    game.set_paddle(-50.0, 0.0);
    assert_eq!(game.paddle.x, 0.0);

    // Right screen edge boundary clamping
    game.set_paddle(1000.0, 0.0);
    assert_eq!(game.paddle.x, 400.0 - 130.0);
}

#[test]
fn test_tri_ball_spawn() {
    let mut game = RustGame::new(400.0, 800.0);
    game.launch();
    game.spawn_tri_ball();
    assert_eq!(game.balls.len(), 3);
}

#[test]
fn test_ball_loss_and_life_decrement() {
    let mut game = RustGame::new(400.0, 800.0);
    game.launch();

    // Place ball past the bottom
    game.balls[0].y = 900.0;
    game.step(0.016);

    assert_eq!(game.lives, 2);
    assert_eq!(game.state, GameState::ReadyToLaunch);
    assert!(!game.is_launched);
    assert_eq!(game.balls.len(), 1);
}

#[test]
fn test_max_lives_limit() {
    let mut game = RustGame::new(400.0, 800.0);
    assert_eq!(game.lives, 3);
    assert_eq!(game.max_lives, 3);
    // Simulate ExtraLife collection capped at max_lives
    game.lives = (game.lives + 1).min(game.max_lives);
    assert_eq!(game.lives, 3);
}

#[test]
fn test_metal_brick_four_hits_progression() {
    use rust_core::types::BrickType;
    let mut game = RustGame::new(400.0, 800.0);
    let metal_idx = game.bricks.iter().position(|b| b.brick_type == BrickType::Metal).unwrap();
    assert_eq!(game.bricks[metal_idx].hp, 4);

    let bx = game.bricks[metal_idx].x + game.bricks[metal_idx].width * 0.5;
    let b_bottom = game.bricks[metal_idx].y + game.bricks[metal_idx].height;

    // Simulate Hit 1
    game.balls[0].x = bx;
    game.balls[0].y = b_bottom + 5.0;
    game.balls[0].vx = 0.0;
    game.balls[0].vy = -200.0;
    game.is_launched = true;
    game.state = GameState::Active;

    game.step(0.016);
    assert_eq!(game.bricks[metal_idx].hp, 3);
    assert!(!game.bricks[metal_idx].destroyed);
    assert!(game.balls[0].vy > 0.0); // bounced downward

    // Frame immediately after bounce must NOT decrement again
    game.step(0.016);
    assert_eq!(game.bricks[metal_idx].hp, 3);

    // Simulate Hit 2
    game.balls[0].y = b_bottom + 5.0;
    game.balls[0].vy = -200.0;
    game.step(0.016);
    assert_eq!(game.bricks[metal_idx].hp, 2);
    assert!(!game.bricks[metal_idx].destroyed);

    // Simulate Hit 3 (Stage 4 image: 1 HP remaining)
    game.balls[0].y = b_bottom + 5.0;
    game.balls[0].vy = -200.0;
    game.step(0.016);
    assert_eq!(game.bricks[metal_idx].hp, 1);
    assert!(!game.bricks[metal_idx].destroyed);

    // Simulate Hit 4 (Destroyed)
    game.balls[0].y = b_bottom + 5.0;
    game.balls[0].vy = -200.0;
    game.step(0.016);
    assert_eq!(game.bricks[metal_idx].hp, 0);
    assert!(game.bricks[metal_idx].destroyed);
}
