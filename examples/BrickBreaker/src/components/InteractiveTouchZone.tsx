import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  GestureResponderEvent,
} from 'react-native';
import { FloatingText, GameplayState } from '../types/game';

interface InteractiveTouchZoneProps {
  width: number;
  height: number;
  paddleWidth: number;
  gameState: GameplayState;
  onPaddleMove: (newX: number, velocityX: number) => void;
  onLaunchBall: () => void;
  onTapScreen?: (x: number, y: number) => void;
  floatingTexts?: FloatingText[];
}

export const InteractiveTouchZone: React.FC<InteractiveTouchZoneProps> = React.memo(({
  width,
  height,
  paddleWidth,
  gameState,
  onPaddleMove,
  onLaunchBall,
  onTapScreen,
  floatingTexts = [],
}) => {
  const isReadyToLaunch = gameState === 'READY_TO_LAUNCH';

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt: GestureResponderEvent, gestureState) => {
          const { locationX, locationY } = evt.nativeEvent;

          if (isReadyToLaunch) {
            if (locationY >= height - 160) {
              const touchX = gestureState.x0 > 0 ? gestureState.x0 : locationX;
              const clampedX = Math.max(0, Math.min(width - paddleWidth, touchX - paddleWidth / 2));
              onPaddleMove(clampedX, 0);
            }
            onLaunchBall();
            return;
          }

          // Reposition paddle smoothly to touch anywhere on screen
          const touchX = gestureState.x0 > 0 ? gestureState.x0 : locationX;
          const clampedX = Math.max(0, Math.min(width - paddleWidth, touchX - paddleWidth / 2));
          onPaddleMove(clampedX, 0);
        },
        onPanResponderMove: (evt: GestureResponderEvent, gestureState) => {
          const touchX = gestureState.moveX > 0 ? gestureState.moveX : evt.nativeEvent.locationX;
          const clampedX = Math.max(0, Math.min(width - paddleWidth, touchX - paddleWidth / 2));
          onPaddleMove(clampedX, gestureState.vx);
        },
        onPanResponderRelease: () => {
          onPaddleMove(-1, 0); // Reset tilt
        },
        onPanResponderTerminate: () => {
          onPaddleMove(-1, 0);
        },
      }),
    [width, height, paddleWidth, isReadyToLaunch, onPaddleMove, onLaunchBall, onTapScreen]
  );

  return (
    <View style={[styles.touchLayer, { width, height }]} {...panResponder.panHandlers}>
      {/* Floating Tactical Hit Popups */}
      {floatingTexts.map(item => (
        <View
          key={item.id}
          pointerEvents="none"
          style={[
            styles.floatingTextContainer,
            {
              left: item.x - 60,
              top: item.y - 15,
              opacity: item.opacity,
            },
          ]}
        >
          <Text style={[styles.floatingScoreText, { color: item.color }]}>
            {item.text}
          </Text>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  touchLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 5,
  },
  floatingTextContainer: {
    position: 'absolute',
    width: 120,
    alignItems: 'center',
  },
  floatingScoreText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
