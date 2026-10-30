pub mod game;
pub mod physics;
pub mod types;

use game::RustGame;
use std::ptr;

// ---------- Game Instance Lifecycle ----------

#[unsafe(no_mangle)]
pub extern "C" fn rust_game_create(width: f32, height: f32) -> *mut RustGame {
    Box::into_raw(Box::new(RustGame::new(width, height)))
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_game_destroy(game: *mut RustGame) {
    if !game.is_null() {
        drop(unsafe { Box::from_raw(game) });
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_game_reset(game: *mut RustGame) {
    if let Some(g) = unsafe { game.as_mut() } {
        g.reset();
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_game_launch(game: *mut RustGame) {
    if let Some(g) = unsafe { game.as_mut() } {
        g.launch();
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_game_set_paddle(game: *mut RustGame, x: f32, tilt: f32) {
    if let Some(g) = unsafe { game.as_mut() } {
        g.set_paddle(x, tilt);
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_game_step(game: *mut RustGame, dt: f32) {
    if let Some(g) = unsafe { game.as_mut() } {
        g.step(dt);
    }
}

// ---------- Scalar State Getters ----------

#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_game_get_state(game: *const RustGame) -> u32 {
    if let Some(g) = unsafe { game.as_ref() } {
        g.state as u32
    } else {
        0
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_game_get_score(game: *const RustGame) -> u32 {
    if let Some(g) = unsafe { game.as_ref() } {
        g.score
    } else {
        0
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_game_get_lives(game: *const RustGame) -> u32 {
    if let Some(g) = unsafe { game.as_ref() } {
        g.lives
    } else {
        0
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_game_get_combo(game: *const RustGame) -> f32 {
    if let Some(g) = unsafe { game.as_ref() } {
        g.combo
    } else {
        1.0
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_game_get_paddle_x(game: *const RustGame) -> f32 {
    if let Some(g) = unsafe { game.as_ref() } {
        g.paddle.x
    } else {
        0.0
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_game_get_paddle_width(game: *const RustGame) -> f32 {
    if let Some(g) = unsafe { game.as_ref() } {
        g.paddle.width
    } else {
        130.0
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_game_get_aim_angle(game: *const RustGame) -> f32 {
    if let Some(g) = unsafe { game.as_ref() } {
        g.get_aim_angle()
    } else {
        -1.57
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_game_get_level(game: *const RustGame) -> u32 {
    if let Some(g) = unsafe { game.as_ref() } {
        g.get_level()
    } else {
        1
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_game_get_events(game: *mut RustGame) -> u32 {
    if let Some(g) = unsafe { game.as_mut() } {
        g.get_events()
    } else {
        0
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_game_set_level(game: *mut RustGame, level: u32) {
    if let Some(g) = unsafe { game.as_mut() } {
        g.set_level(level);
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_game_next_level(game: *mut RustGame) {
    if let Some(g) = unsafe { game.as_mut() } {
        g.next_level();
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_game_revive(game: *mut RustGame) {
    if let Some(g) = unsafe { game.as_mut() } {
        g.revive();
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_game_pause(game: *mut RustGame) {
    if let Some(g) = unsafe { game.as_mut() } {
        g.pause();
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_game_resume(game: *mut RustGame) {
    if let Some(g) = unsafe { game.as_mut() } {
        g.resume();
    }
}

// ---------- Zero-Copy Slice / Buffer Getters ----------

#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_game_get_balls_data(
    game: *mut RustGame,
    out_len: *mut usize,
) -> *const f32 {
    if let Some(g) = unsafe { game.as_mut() } {
        let slice = g.get_balls_data();
        if !out_len.is_null() {
            unsafe { *out_len = slice.len() };
        }
        slice.as_ptr()
    } else {
        if !out_len.is_null() {
            unsafe { *out_len = 0 };
        }
        ptr::null()
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_game_get_bricks_data(
    game: *mut RustGame,
    out_len: *mut usize,
) -> *const f32 {
    if let Some(g) = unsafe { game.as_mut() } {
        let slice = g.get_bricks_data();
        if !out_len.is_null() {
            unsafe { *out_len = slice.len() };
        }
        slice.as_ptr()
    } else {
        if !out_len.is_null() {
            unsafe { *out_len = 0 };
        }
        ptr::null()
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_game_get_powerups_data(
    game: *mut RustGame,
    out_len: *mut usize,
) -> *const f32 {
    if let Some(g) = unsafe { game.as_mut() } {
        let slice = g.get_powerups_data();
        if !out_len.is_null() {
            unsafe { *out_len = slice.len() };
        }
        slice.as_ptr()
    } else {
        if !out_len.is_null() {
            unsafe { *out_len = 0 };
        }
        ptr::null()
    }
}
