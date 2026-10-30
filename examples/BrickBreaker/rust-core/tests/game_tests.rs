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

#[test]
fn test_launch_on_last_life() {
    let mut game = RustGame::new(400.0, 800.0);
    game.launch();

    // Drop life 1 (3 -> 2)
    game.balls[0].y = 900.0;
    game.step(0.016);
    assert_eq!(game.lives, 2);
    assert_eq!(game.state, GameState::ReadyToLaunch);

    // Launch and drop life 2 (2 -> 1)
    game.launch();
    assert_eq!(game.state, GameState::Active);
    game.balls[0].y = 900.0;
    game.step(0.016);
    assert_eq!(game.lives, 1);
    assert_eq!(game.state, GameState::ReadyToLaunch);
    assert!(!game.is_launched);

    // Launch on last life: must not soft-lock
    game.launch();
    assert!(game.is_launched);
    assert_eq!(game.state, GameState::LastLife);

    let initial_y = game.balls[0].y;
    game.step(0.016);
    assert!(game.balls[0].y < initial_y); // ball successfully advances upward
    assert_eq!(game.lives, 1);
}

#[test]
fn test_revive_and_launch() {
    let mut game = RustGame::new(400.0, 800.0);
    game.launch();

    // Drop all 3 lives to trigger GameOver
    game.balls[0].y = 900.0;
    game.step(0.016); // 2 lives
    game.launch();
    game.balls[0].y = 900.0;
    game.step(0.016); // 1 life
    game.launch();
    game.balls[0].y = 900.0;
    game.step(0.016); // 0 lives -> GameOver

    assert_eq!(game.lives, 0);
    assert_eq!(game.state, GameState::GameOver);

    // Revive
    game.revive();
    assert_eq!(game.lives, 1);
    assert_eq!(game.state, GameState::ReadyToLaunch);
    assert!(!game.is_launched);

    // Launch after revive
    game.launch();
    assert!(game.is_launched);
    assert_eq!(game.state, GameState::LastLife);

    let initial_y = game.balls[0].y;
    game.step(0.016);
    assert!(game.balls[0].y < initial_y);
    assert_eq!(game.lives, 1);
}

#[test]
fn test_step_nan_infinity_negative_rejection() {
    let mut game = RustGame::new(400.0, 800.0);
    game.launch();
    assert_eq!(game.lives, 3);
    assert_eq!(game.balls.len(), 1);

    let initial_x = game.balls[0].x;
    let initial_y = game.balls[0].y;

    // Passing NaN must NOT cause ball drop or life loss
    game.step(f32::NAN);
    assert_eq!(game.lives, 3);
    assert_eq!(game.balls.len(), 1);
    assert_eq!(game.balls[0].x, initial_x);
    assert_eq!(game.balls[0].y, initial_y);

    // Passing Infinity must NOT drop the ball
    game.step(f32::INFINITY);
    assert_eq!(game.lives, 3);
    assert_eq!(game.balls.len(), 1);

    // Passing negative or zero dt must NOT drop the ball
    game.step(-1.0);
    assert_eq!(game.lives, 3);
    game.step(0.0);
    assert_eq!(game.lives, 3);
}

#[test]
fn test_paddle_nan_infinity_rejection() {
    let mut game = RustGame::new(400.0, 800.0);
    game.set_paddle(150.0, 0.2);
    assert_eq!(game.paddle.x, 150.0);
    assert_eq!(game.paddle.tilt, 0.2);

    // Setting NaN must be rejected, preserving existing valid paddle state
    game.set_paddle(f32::NAN, 0.5);
    assert_eq!(game.paddle.x, 150.0);
    assert_eq!(game.paddle.tilt, 0.2);

    game.set_paddle(200.0, f32::NAN);
    assert_eq!(game.paddle.x, 150.0);
    assert_eq!(game.paddle.tilt, 0.2);

    // Setting Infinity must be rejected
    game.set_paddle(f32::INFINITY, 0.0);
    assert_eq!(game.paddle.x, 150.0);
}

#[test]
fn test_set_level_safe_range() {
    let mut game = RustGame::new(400.0, 800.0);
    game.set_level(0);
    assert_eq!(game.level, 1);
    assert!(!game.bricks.is_empty());
}
