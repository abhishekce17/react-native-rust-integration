import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { SCREENS } from '../../../constant/screens';
import { GAME_ASSETS } from '../../../assets';
import { Brick, GameplayState } from '../../../types/game';
import { THEMES } from '../../../theme/themes';
import { CyberCanvas } from '../../../components/CyberCanvas';
import { InteractiveTouchZone } from '../../../components/InteractiveTouchZone';
import { PauseMenuModal } from '../../../components/PauseMenuModal';
import { LevelCompleteModal } from '../../../components/LevelCompleteModal';
import { GameOverModal } from '../../../components/GameOverModal';
import { useGameStore } from '../../../store/useGameStore';
import { useGamePhysics } from '../hooks/useGamePhysics';

export const GameplayScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Store integration with fine-grained selectors for instant 60fps reactivity
  const score = useGameStore(s => s.score);
  const highScore = useGameStore(s => s.highScore);
  const combo = useGameStore(s => s.combo);
  const lives = useGameStore(s => s.lives);
  const maxLives = useGameStore(s => s.maxLives);
  const level = useGameStore(s => s.level);
  const themeId = useGameStore(s => s.themeId);

  // Navigation
  const navigation = useNavigation<any>();

  // Selected Theme
  const theme = THEMES[themeId];

  const handleGoHome = () => {
    setPauseVisible(false);
    setGameOverVisible(false);
    setVictoryVisible(false);
    navigation.navigate(SCREENS.HOME);
  };

  // Game Lifecycle State: S18 Ready -> S19 Active -> S20 Last Life -> S22 Victory -> S23 Game Over -> M01 Paused
  const [gameState, setGameState] = useState<GameplayState>('READY_TO_LAUNCH');

  // Modals visibility
  const [pauseVisible, setPauseVisible] = useState(false);
  const [victoryVisible, setVictoryVisible] = useState(false);
  const [gameOverVisible, setGameOverVisible] = useState(false);

  // Paddle position & tilt
  const [paddleX, setPaddleX] = useState<number>(() => (screenWidth - 130) / 2);
  const [tiltAngle, setTiltAngle] = useState(0);

  // Reset lives and combo on session start
  useEffect(() => {
    useGameStore.getState().resetLives();
    useGameStore.getState().resetCombo();
  }, []);

  // Calculate playable canvas area
  const headerHeight = 68;
  const canvasTop = insets.top + headerHeight;
  const canvasHeight = Math.max(300, screenHeight - canvasTop - insets.bottom);

  // Handle state transitions emitted by Rust bare-metal engine
  const handleRustStateChange = useCallback((newState: GameplayState) => {
    setGameState(newState);
    if (newState === 'LEVEL_COMPLETED') {
      setVictoryVisible(true);
      const currentLives = useGameStore.getState().lives;
      const currentMaxLives = useGameStore.getState().maxLives;
      const stars = currentLives === currentMaxLives ? 3 : currentLives >= 2 ? 2 : 1;
      useGameStore.getState().completeLevel(stars);
    } else if (newState === 'GAME_OVER') {
      setGameOverVisible(true);
    }
  }, []);

  // Game physics hook (powered 100% by Rust metal engine)
  const physics = useGamePhysics({
    width: screenWidth,
    height: canvasHeight,
    paddleX,
    tiltAngle,
    gameState,
    onStateChange: handleRustStateChange,
  });

  // Auto-launch ball after brief 1.2s ready preview (or instant tap)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (gameState === 'READY_TO_LAUNCH') {
        physics.launchBall();
        setGameState('ACTIVE');
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [gameState, physics]);

  const paddleWidth = physics.paddleWidth || 130;
  const clampedPaddleX = Math.max(0, Math.min(screenWidth - paddleWidth, paddleX));

  // Re-center paddle when screen dimensions or paddle width resolve
  useEffect(() => {
    if (gameState === 'READY_TO_LAUNCH' && screenWidth > 0) {
      setPaddleX((screenWidth - paddleWidth) / 2);
    }
  }, [screenWidth, paddleWidth, gameState]);
  const totalBricks = physics.bricks.length;
  const bricksLeft = physics.bricks.filter(b => !b.isDestroyed).length;

  // Handlers
  const handlePaddleMove = useCallback((newX: number, velocityX: number) => {
    if (newX >= 0) {
      setPaddleX(newX);
    }
    const clampedTilt = Math.max(-1.5, Math.min(1.5, velocityX * 0.8));
    setTiltAngle(clampedTilt);
  }, []);

  const handleLaunchBall = useCallback(() => {
    if (gameState === 'READY_TO_LAUNCH') {
      physics.launchBall();
      setGameState('ACTIVE');
    }
  }, [gameState, physics]);

  const handleTapScreen = useCallback(() => {
    if (gameState === 'READY_TO_LAUNCH') {
      handleLaunchBall();
    }
  }, [gameState, handleLaunchBall]);

  const handleRestart = () => {
    setPauseVisible(false);
    setGameOverVisible(false);
    setVictoryVisible(false);
    physics.restart();
    setGameState('READY_TO_LAUNCH');
  };

  const handleNextLevel = () => {
    setVictoryVisible(false);
    physics.nextLevel();
    setGameState('READY_TO_LAUNCH');
  };

  const handleRevive = () => {
    setGameOverVisible(false);
    physics.revive();
    setGameState('READY_TO_LAUNCH');
  };

  const handleOpenPause = () => {
    physics.pause();
    setGameState('PAUSED');
    setPauseVisible(true);
  };

  const handleResume = () => {
    setPauseVisible(false);
    physics.resume();
    setGameState('ACTIVE');
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* 1. Sleek Minimal HUD (Matching Reference Mockup) */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        {/* Left: SCORE */}
        <View style={styles.scoreContainer}>
          <Text style={styles.hudLabel}>SCORE</Text>
          <Text style={styles.hudValue}>{score}</Text>
        </View>

        {/* Center: LIVES */}
        <View style={styles.livesContainer}>
          <Text style={styles.hudLabel}>LIVES</Text>
          <View style={styles.livesRow}>
            {Array.from({ length: maxLives }).map((_, i) => (
              <Image
                key={i}
                source={GAME_ASSETS.ui.heartLife}
                style={[
                  styles.lifeHeartIcon,
                  { opacity: i < lives ? 1 : 0.2 },
                ]}
                resizeMode="contain"
              />
            ))}
          </View>
        </View>

        {/* Right: LEVEL + Circular Pause Button */}
        <View style={styles.rightContainer}>
          <View style={styles.levelContainer}>
            <Text style={styles.hudLabel}>LEVEL</Text>
            <Text style={styles.hudValue}>{level}</Text>
          </View>
          <TouchableOpacity
            style={styles.pauseCircle}
            onPress={handleOpenPause}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Pause Game"
          >
            <View style={styles.pausePill} />
            <View style={styles.pausePill} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Interactive Game Canvas Zone */}
      <View style={[styles.canvasContainer, { height: canvasHeight }]}>
        <CyberCanvas
          width={screenWidth}
          height={canvasHeight}
          theme={theme}
          bricks={physics.bricks}
          paddleX={clampedPaddleX}
          paddleWidth={paddleWidth}
          balls={physics.balls}
          aimAngle={physics.aimAngle}
          showAimLine={false}
          fallingPowerUps={physics.fallingPowerUps}
        />

        {/* Touch & Interaction Layer */}
        <InteractiveTouchZone
          width={screenWidth}
          height={canvasHeight}
          paddleWidth={paddleWidth}
          gameState={gameState}
          onPaddleMove={handlePaddleMove}
          onLaunchBall={handleLaunchBall}
          onTapScreen={handleTapScreen}
        />
      </View>

      {/* 3. Modals */}
      <PauseMenuModal
        visible={pauseVisible}
        theme={theme}
        score={score}
        bricksLeft={bricksLeft}
        totalBricks={totalBricks}
        onResume={handleResume}
        onRestart={handleRestart}
        onHome={handleGoHome}
      />

      <LevelCompleteModal
        visible={victoryVisible}
        theme={theme}
        level={level}
        score={score}
        highScore={highScore}
        maxCombo={Math.max(1, Math.round(combo))}
        onNextLevel={handleNextLevel}
        onReplay={handleRestart}
        onClose={handleGoHome}
      />

      <GameOverModal
        visible={gameOverVisible}
        theme={theme}
        level={level}
        score={score}
        highScore={highScore}
        bricksLeft={bricksLeft}
        totalBricks={totalBricks}
        onRetry={handleRestart}
        onRevive={handleRevive}
        onClose={handleGoHome}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B1425',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  scoreContainer: {
    alignItems: 'flex-start',
    minWidth: 70,
  },
  livesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  livesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  lifeHeartIcon: {
    width: 24,
    height: 22,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  levelContainer: {
    alignItems: 'flex-end',
  },
  hudLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7E8B9B',
    letterSpacing: 2,
    marginBottom: 2,
  },
  hudValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pauseCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  pausePill: {
    width: 3.5,
    height: 15,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  canvasContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
});
