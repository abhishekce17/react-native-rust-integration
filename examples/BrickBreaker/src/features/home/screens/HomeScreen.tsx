import React, { useRef, useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  StatusBar,
  Pressable,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SCREENS } from '../../../constant/screens';
import { GAME_ASSETS } from '../../../assets';

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Scale animation on press
  const scaleAnim = useRef(new Animated.Value(1)).current;
  // Subtle ambient pulse for the Play button
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.025,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.94,
      useNativeDriver: true,
      speed: 30,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  const handlePlay = () => {
    navigation.navigate(SCREENS.GAMEPLAY);
  };

  // Dimensions matching mockup proportions
  const logoWidth = Math.min(360, screenWidth * 0.72);
  const logoHeight = logoWidth / (376 / 118);

  const buttonWidth = Math.min(290, screenWidth * 0.58);
  const buttonHeight = buttonWidth / (336 / 93);

  // Top offsets matching mockup proportions exactly
  const logoTop = screenHeight * 0.38;
  const buttonGap = screenHeight * 0.11;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Main Content Area */}
      <View style={[styles.content, { paddingTop: logoTop }]}>
        {/* Cosmic Bricks Title Logo */}
        <Image
          source={GAME_ASSETS.ui.homeLogo}
          style={{
            width: logoWidth,
            height: logoHeight,
          }}
          resizeMode="contain"
        />

        {/* Play Button */}
        <Animated.View
          style={{
            marginTop: buttonGap,
            transform: [{ scale: Animated.multiply(scaleAnim, pulseAnim) }],
          }}
        >
          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePlay}
            style={styles.buttonTouch}
            accessibilityRole="button"
            accessibilityLabel="Play Game"
          >
            <Image
              source={GAME_ASSETS.ui.homePlayButton}
              style={{
                width: buttonWidth,
                height: buttonHeight,
              }}
              resizeMode="contain"
            />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#081021',
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  buttonTouch: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
