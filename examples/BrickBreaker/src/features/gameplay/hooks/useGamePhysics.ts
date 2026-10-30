import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ActiveBall,
  Brick,
  FallingPowerUp,
  GameplayState,
  PowerUpType,
  BrickType,
} from '../../../types/game';
import { getRustModule, RUST_EVENT } from '../../../RustModule';
import { useGameStore } from '../../../store/useGameStore';

const BRICK_TYPE_MAP: BrickType[] = ['red', 'blue', 'yellow', 'purple', 'metal'];
const POWERUP_TYPE_MAP: PowerUpType[] = ['wide', 'triball', 'extralife'];
const POWERUP_COLOR_MAP: Record<PowerUpType, string> = {
  wide: '#FFD60A',
  triball: '#FF00AA',
  extralife: '#43F58A',
};

const RUST_STATE_MAP: Record<number, GameplayState> = {
  0: 'READY_TO_LAUNCH',
  1: 'ACTIVE',
  2: 'LAST_LIFE',
  3: 'LEVEL_COMPLETED',
  4: 'GAME_OVER',
  5: 'PAUSED',
};

interface UseGamePhysicsProps {
  width: number;
  height: number;
  paddleX: number;
  tiltAngle: number;
  gameState?: GameplayState;
  onStateChange?: (state: GameplayState) => void;
}

export function useGamePhysics({
  width,
  height,
  paddleX,
  tiltAngle,
  gameState = 'READY_TO_LAUNCH',
  onStateChange,
}: UseGamePhysicsProps) {
  const [balls, setBalls] = useState<ActiveBall[]>([]);
  const [bricks, setBricks] = useState<Brick[]>([]);
  const [paddleWidth, setPaddleWidth] = useState<number>(130);
  const [aimAngle, setAimAngle] = useState(-Math.PI / 2.3);
  const [fallingPowerUps, setFallingPowerUps] = useState<FallingPowerUp[]>([]);

  const paddleRef = useRef({ x: paddleX, tilt: tiltAngle });
  paddleRef.current = { x: paddleX, tilt: tiltAngle };

  const lastStateRef = useRef<GameplayState>(gameState);
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  const bricksLoadedRef = useRef(false);
  const lastLevelRef = useRef<number>(-1);
  const hasActivePUsRef = useRef(false);

  // Initialize Rust engine instance on mount or canvas resize
  useEffect(() => {
    const engine = getRustModule();
    if (engine && width > 0 && height > 0) {
      engine.init(width, height);
      setPaddleWidth(engine.getPaddleWidth());
      bricksLoadedRef.current = false;
    }
  }, [width, height]);

  // Engine control triggers delegating directly to bare-metal Rust
  const launchBall = useCallback(() => {
    getRustModule()?.launch();
  }, []);

  const resetBallOnPaddle = useCallback(() => {
    getRustModule()?.reset();
    bricksLoadedRef.current = false;
  }, []);

  const restart = useCallback(() => {
    getRustModule()?.reset();
    bricksLoadedRef.current = false;
  }, []);

  const nextLevel = useCallback(() => {
    getRustModule()?.nextLevel();
    bricksLoadedRef.current = false;
  }, []);

  const revive = useCallback(() => {
    getRustModule()?.revive();
    bricksLoadedRef.current = false;
  }, []);

  const pause = useCallback(() => {
    getRustModule()?.pause();
  }, []);

  const resume = useCallback(() => {
    getRustModule()?.resume();
  }, []);

  // Core 60/120 FPS Native Bare-Metal Physics Simulation Loop
  useEffect(() => {
    let animId: number;
    const getTimestamp = () => {
      const perf = (globalThis as any).performance;
      return perf && typeof perf.now === 'function' ? perf.now() : Date.now();
    };
    let lastTime = getTimestamp();

    const loop = () => {
      const now = getTimestamp();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(0.033, Math.max(0.001, rawDt));

      const engine = getRustModule();
      if (engine) {
        // 1. Advance bare-metal physics step in Rust
        const p = paddleRef.current;
        engine.setPaddle(p.x, p.tilt);
        engine.step(dt);

        // 2. Consume events bitmask from Rust
        const events = engine.getEvents();

        // 3. Sync Score, Lives, Combo, Level with Zustand store
        const currentScore = engine.getScore();
        const currentLives = engine.getLives();
        const currentCombo = engine.getCombo();
        const currentLevel = engine.getLevel();

        const store = useGameStore.getState();
        if (store.score !== currentScore) {
          useGameStore.setState({ score: currentScore });
        }
        if (store.lives !== currentLives) {
          useGameStore.setState({ lives: currentLives });
        }
        if (store.combo !== currentCombo) {
          useGameStore.setState({ combo: currentCombo });
        }
        if (store.level !== currentLevel) {
          useGameStore.setState({ level: currentLevel });
        }

        // 4. Sync Game State transitions
        const rustStateCode = engine.getState();
        const nextState = RUST_STATE_MAP[rustStateCode] || 'READY_TO_LAUNCH';
        if (nextState !== lastStateRef.current) {
          lastStateRef.current = nextState;
          onStateChangeRef.current?.(nextState);
        }

        // 5. Sync Laser Aim Angle & Paddle Width from Rust
        setAimAngle(engine.getAimAngle());
        setPaddleWidth(engine.getPaddleWidth());

        // 6. Parse Contiguous Ball Buffer from Rust: [id, x, y, radius]
        const ballsData = engine.getBalls();
        if (ballsData && ballsData.length >= 4) {
          const nextBalls: ActiveBall[] = [];
          for (let i = 0; i < ballsData.length; i += 4) {
            nextBalls.push({
              id: `ball_${Math.round(ballsData[i])}`,
              x: ballsData[i + 1],
              y: ballsData[i + 2],
              radius: ballsData[i + 3],
              vx: 0,
              vy: 0,
              speed: 0,
            });
          }
          setBalls(nextBalls);
        }

        // 7. Event-driven Brick Buffer Parsing (only fetches on hits, destroys, or level changes)
        // Eliminates >1,500 redundant object allocations per second from the 60/120 FPS loop
        let needsBrickRefresh = false;
        if (currentLevel !== lastLevelRef.current) {
          lastLevelRef.current = currentLevel;
          needsBrickRefresh = true;
        }

        const hasBrickHit = (events & (RUST_EVENT.BRICK_HIT | RUST_EVENT.BRICK_DESTROY)) !== 0;
        if (needsBrickRefresh || hasBrickHit || !bricksLoadedRef.current) {
          bricksLoadedRef.current = true;
          const bricksData = engine.getBricks();
          if (bricksData && bricksData.length >= 8) {
            const nextBricks: Brick[] = [];
            for (let i = 0; i < bricksData.length; i += 8) {
              const typeIdx = Math.round(bricksData[i + 5]);
              const bType = BRICK_TYPE_MAP[typeIdx] || 'blue';
              const hp = Math.round(bricksData[i + 6]);
              const isDestroyed = bricksData[i + 7] > 0.5;
              nextBricks.push({
                id: `brick_${Math.round(bricksData[i])}`,
                row: Math.floor(i / (8 * 6)),
                col: (i / 8) % 6,
                x: bricksData[i + 1],
                y: bricksData[i + 2],
                width: bricksData[i + 3],
                height: bricksData[i + 4],
                type: bType,
                hp,
                maxHp: bType === 'metal' ? 4 : 1,
                points: bType === 'metal' ? 500 : 100,
                isDestroyed,
                glowColor: '#00FFFF',
              });
            }
            setBricks(nextBricks);
          }
        }

        // 8. Conditional Falling Power-Up Buffer Parsing (only allocates when power-ups exist)
        const puData = engine.getPowerUps();
        if (puData && puData.length >= 5) {
          hasActivePUsRef.current = true;
          const nextPUs: FallingPowerUp[] = [];
          for (let i = 0; i < puData.length; i += 5) {
            const puTypeIdx = Math.round(puData[i + 4]);
            const pType = POWERUP_TYPE_MAP[puTypeIdx] || 'wide';
            nextPUs.push({
              id: `pu_${Math.round(puData[i])}`,
              type: pType,
              x: puData[i + 1],
              y: puData[i + 2],
              radius: puData[i + 3],
              vy: 160,
              color: POWERUP_COLOR_MAP[pType],
            });
          }
          setFallingPowerUps(nextPUs);
        } else if (hasActivePUsRef.current) {
          hasActivePUsRef.current = false;
          setFallingPowerUps([]);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  return {
    balls,
    bricks,
    paddleWidth,
    aimAngle,
    fallingPowerUps,
    launchBall,
    resetBallOnPaddle,
    restart,
    nextLevel,
    revive,
    pause,
    resume,
  };
}
