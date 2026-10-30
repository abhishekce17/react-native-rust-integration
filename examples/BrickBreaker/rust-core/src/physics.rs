use crate::types::{Ball, Brick, Paddle};
use std::f32::consts::PI;

pub const BASE_BALL_SPEED: f32 = 460.0;
pub const MAX_BALL_SPEED: f32 = 780.0;
pub const BALL_SPEED_RAMP: f32 = 4.0;
pub const BALL_RADIUS: f32 = 14.0;
pub const PADDLE_HEIGHT: f32 = 22.0;
pub const PADDLE_DEFAULT_WIDTH: f32 = 130.0;
pub const PADDLE_WIDE_WIDTH: f32 = 168.0;
pub const POWERUP_FALL_SPEED: f32 = 160.0;

/// Circle to Rectangle AABB contact detection
pub fn circle_intersects_rect(
    cx: f32,
    cy: f32,
    radius: f32,
    rx: f32,
    ry: f32,
    rw: f32,
    rh: f32,
) -> bool {
    let closest_x = cx.clamp(rx, rx + rw);
    let closest_y = cy.clamp(ry, ry + rh);
    let dx = cx - closest_x;
    let dy = cy - closest_y;
    dx * dx + dy * dy <= radius * radius
}

/// Applies paddle bounce physics based on contact offset and paddle tilt
pub fn apply_paddle_bounce(ball: &mut Ball, paddle: &Paddle) {
    let hit_offset = ((ball.x - (paddle.x + paddle.width * 0.5)) / (paddle.width * 0.5)).clamp(-1.0, 1.0);
    let raw_angle = -PI / 2.0 + hit_offset * (PI / 2.7) + paddle.tilt * 0.12;
    // Keep angle safely directed upward (between -165 deg and -15 deg)
    let angle = raw_angle.clamp(-PI + 0.26, -0.26);

    ball.speed = (ball.speed + BALL_SPEED_RAMP).min(MAX_BALL_SPEED);
    ball.vx = ball.speed * angle.cos();
    ball.vy = ball.speed * angle.sin();
    ball.y = paddle.y - ball.radius - 1.0;
}

/// Resolves collision between ball and brick
/// Returns (hit: bool, destroyed: bool, points: u32)
pub fn resolve_ball_brick_collision(ball: &mut Ball, brick: &mut Brick) -> (bool, bool, u32) {
    if brick.destroyed {
        return (false, false, 0);
    }

    if !circle_intersects_rect(
        ball.x,
        ball.y,
        ball.radius,
        brick.x,
        brick.y,
        brick.width,
        brick.height,
    ) {
        return (false, false, 0);
    }

    // Determine which side of the brick was hit and push ball out of intersection
    let overlap_left = (ball.x + ball.radius) - brick.x;
    let overlap_right = (brick.x + brick.width) - (ball.x - ball.radius);
    let overlap_top = (ball.y + ball.radius) - brick.y;
    let overlap_bottom = (brick.y + brick.height) - (ball.y - ball.radius);

    let min_overlap_x = overlap_left.min(overlap_right);
    let min_overlap_y = overlap_top.min(overlap_bottom);

    if min_overlap_x < min_overlap_y {
        if overlap_left < overlap_right {
            ball.x = brick.x - ball.radius - 1.0;
            ball.vx = -ball.vx.abs();
        } else {
            ball.x = brick.x + brick.width + ball.radius + 1.0;
            ball.vx = ball.vx.abs();
        }
    } else {
        if overlap_top < overlap_bottom {
            ball.y = brick.y - ball.radius - 1.0;
            ball.vy = -ball.vy.abs();
        } else {
            ball.y = brick.y + brick.height + ball.radius + 1.0;
            ball.vy = ball.vy.abs();
        }
    }

    // Damage brick
    brick.hp = brick.hp.saturating_sub(1);
    let is_destroyed = brick.hp == 0;
    if is_destroyed {
        brick.destroyed = true;
    }

    let points = if is_destroyed {
        brick.brick_type.points()
    } else {
        0
    };

    (true, is_destroyed, points)
}

