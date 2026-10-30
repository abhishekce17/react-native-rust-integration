import React from 'react';
import {
  Canvas,
  Rect,
  RoundedRect,
  Circle,
  Line,
  Group,
  LinearGradient,
  vec,
  Image,
  useImage,
} from '@shopify/react-native-skia';
import {
  ActiveBall,
  Brick,
  ColorTheme,
  FallingPowerUp,
  PowerUp,
  PowerUpType,
  SparkParticle,
} from '../types/game';
import { BRICK_COLOR_MAP } from '../theme/themes';
import { GAME_ASSETS } from '../assets';
import { GAME_CONFIG } from '../constant/gameConfig';
import { GAME_SPRITE_CACHE } from '../utils/assetPreloader';

interface CyberCanvasProps {
  width: number;
  height: number;
  theme?: ColorTheme;
  bricks: Brick[];
  paddleX: number;
  paddleWidth: number;
  balls: ActiveBall[];
  aimAngle: number;
  showAimLine: boolean;
  fallingPowerUps: FallingPowerUp[];
}

export const CyberCanvas: React.FC<CyberCanvasProps> = React.memo(({
  width,
  height,
  bricks,
  paddleX,
  paddleWidth,
  balls,
  aimAngle,
  showAimLine,
  fallingPowerUps,
}) => {
  const paddleHeight = GAME_CONFIG.PADDLE_HEIGHT;
  const paddleY = height - GAME_CONFIG.PADDLE_Y_OFFSET;

  // 1. Load Ball Sprite from preloaded cache or fallback to useImage
  const hookBallImg = useImage(GAME_ASSETS.balls.standard);
  const ballImg = GAME_SPRITE_CACHE['ball_standard'] || hookBallImg;

  // 2. Load Paddle Sprites
  const hookPaddleStandardImg = useImage(GAME_ASSETS.paddles.standard);
  const hookPaddleLongImg = useImage(GAME_ASSETS.paddles.long);
  const paddleStandardImg = GAME_SPRITE_CACHE['paddle_standard'] || hookPaddleStandardImg;
  const paddleLongImg = GAME_SPRITE_CACHE['paddle_long'] || hookPaddleLongImg;

  // 3. Load Brick Sprites
  const hookBrickRedImg = useImage(GAME_ASSETS.bricks.red);
  const hookBrickCyanImg = useImage(GAME_ASSETS.bricks.cyan);
  const hookBrickBlueImg = useImage(GAME_ASSETS.bricks.blue);
  const hookBrickYellowImg = useImage(GAME_ASSETS.bricks.yellow);
  const hookBrickPurpleImg = useImage(GAME_ASSETS.bricks.purple);
  const hookMetalHp4Img = useImage(GAME_ASSETS.bricks.metalHp4);
  const hookMetalHp3Img = useImage(GAME_ASSETS.bricks.metalHp3);
  const hookMetalHp2Img = useImage(GAME_ASSETS.bricks.metalHp2);
  const hookMetalHp1Img = useImage(GAME_ASSETS.bricks.metalHp1);

  const brickRedImg = GAME_SPRITE_CACHE['brick_red'] || hookBrickRedImg;
  const brickCyanImg = GAME_SPRITE_CACHE['brick_cyan'] || hookBrickCyanImg;
  const brickBlueImg = GAME_SPRITE_CACHE['brick_blue'] || hookBrickBlueImg;
  const brickYellowImg = GAME_SPRITE_CACHE['brick_yellow'] || hookBrickYellowImg;
  const brickPurpleImg = GAME_SPRITE_CACHE['brick_purple'] || hookBrickPurpleImg;
  const metalHp4Img = GAME_SPRITE_CACHE['metal_hp4'] || hookMetalHp4Img;
  const metalHp3Img = GAME_SPRITE_CACHE['metal_hp3'] || hookMetalHp3Img;
  const metalHp2Img = GAME_SPRITE_CACHE['metal_hp2'] || hookMetalHp2Img;
  const metalHp1Img = GAME_SPRITE_CACHE['metal_hp1'] || hookMetalHp1Img;

  // 4. Load Power-Up Sprites
  const hookPuExpandImg = useImage(GAME_ASSETS.powerups.expand);
  const hookPuTriballImg = useImage(GAME_ASSETS.powerups.triball);
  const hookPuExtraLifeImg = useImage(GAME_ASSETS.powerups.extralife);
  const puExpandImg = GAME_SPRITE_CACHE['pu_expand'] || hookPuExpandImg;
  const puTriballImg = GAME_SPRITE_CACHE['pu_triball'] || hookPuTriballImg;
  const puExtraLifeImg = GAME_SPRITE_CACHE['pu_extralife'] || hookPuExtraLifeImg;

  // Aiming trajectory line from primary ball or paddle center
  const primaryBall = balls[0];
  const launchOriginX = primaryBall ? primaryBall.x : paddleX + paddleWidth / 2;
  const launchOriginY = primaryBall ? primaryBall.y : paddleY - 12;

  const aimLength = 220;
  const aimTargetX = launchOriginX + Math.cos(aimAngle) * aimLength;
  const aimTargetY = launchOriginY + Math.sin(aimAngle) * aimLength;

  const wallHitX = aimTargetX < 16 ? 16 : aimTargetX > width - 16 ? width - 16 : aimTargetX;
  const wallHitY = aimTargetY < 20 ? 20 : aimTargetY;

  // Helper: Choose Brick Sprite Image based on type
  const getBrickImage = (brick: Brick) => {
    switch (brick.type) {
      case 'red':
        return brickRedImg;
      case 'blue':
        return brickCyanImg || brickBlueImg;
      case 'yellow':
        return brickYellowImg;
      case 'purple':
        return brickPurpleImg;
      case 'metal':
        // 4 hits destroy complete: 4 HP (intact) -> 3 HP (crack 1) -> 2 HP (crack 2) -> 1 HP (crack 3) -> 0 HP (destroyed)
        if (brick.hp >= 4) return metalHp4Img;
        if (brick.hp === 3) return metalHp3Img;
        if (brick.hp === 2) return metalHp2Img;
        return metalHp1Img;
      default:
        return brickCyanImg || brickBlueImg;
    }
  };

  // Helper: Choose Power-Up Sprite Image
  const getPowerUpImage = (type: PowerUpType) => {
    switch (type) {
      case 'wide':
        return puExpandImg;
      case 'triball':
        return puTriballImg;
      case 'extralife':
        return puExtraLifeImg;
      default:
        return puExpandImg;
    }
  };

  // Paddle Sprite selection based on buffs
  const paddleImg = paddleWidth > 140 ? paddleLongImg : paddleStandardImg;

  return (
    <Canvas style={{ width, height }}>
      {/* 1. Flat Deep Space Background (Zero Neon Glow) */}
      <Rect x={0} y={0} width={width} height={height} color="#0B1425" />

      {/* 3. Real Sprite Bricks Layer from src/assets/bricks (Crisp Direct Render, No Neon Glow) */}
      {bricks.map(brick => {
        if (brick.isDestroyed) return null;
        const img = getBrickImage(brick);

        if (img) {
          return (
            <Image
              key={brick.id}
              image={img}
              x={brick.x}
              y={brick.y}
              width={brick.width}
              height={brick.height}
              fit="fill"
            />
          );
        }

        return null;
      })}

      {/* 4. Aim Trajectory Guide Line (Clean Thin Line, No Glow) */}
      {showAimLine && (
        <Group opacity={0.5}>
          <Line
            p1={vec(launchOriginX, launchOriginY)}
            p2={vec(wallHitX, wallHitY)}
            color="#FFFFFF"
            strokeWidth={1.2}
          />
          <Circle cx={wallHitX} cy={wallHitY} r={3} color="#FFFFFF" />
        </Group>
      )}


      {/* 6. Falling Power-Up Sprite Capsules (Direct Render, No Glow) */}
      {fallingPowerUps.map(item => {
        const img = getPowerUpImage(item.type);
        if (img) {
          return (
            <Image
              key={item.id}
              image={img}
              x={item.x - item.radius}
              y={item.y - item.radius}
              width={item.radius * 2}
              height={item.radius * 2}
              fit="contain"
            />
          );
        }
        return (
          <Circle
            key={item.id}
            cx={item.x}
            cy={item.y}
            r={item.radius}
            color={item.color}
          />
        );
      })}

      {/* 7. Active Balls (Clean Direct Sprite Render, Zero Halo/Glow/Trail) */}
      {balls.map(ball => {
        if (ballImg) {
          return (
            <Image
              key={ball.id}
              image={ballImg}
              x={ball.x - ball.radius}
              y={ball.y - ball.radius}
              width={ball.radius * 2}
              height={ball.radius * 2}
              fit="contain"
            />
          );
        }
        return null;
      })}

      {/* 8. The Real Cyber Paddle Sprite from src/assets/paddles (Zero Neon Glow) */}
      {paddleImg ? (
        <Image
          image={paddleImg}
          x={paddleX}
          y={paddleY}
          width={paddleWidth}
          height={paddleHeight}
          fit="fill"
        />
      ) : null}
    </Canvas>
  );
});
