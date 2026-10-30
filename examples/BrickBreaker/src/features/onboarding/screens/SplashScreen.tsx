import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  Animated,
  TouchableOpacity,
  StatusBar,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SCREENS } from '../../../constant/screens';
import { GAME_ASSETS } from '../../../assets';
import { preloadGameAssets } from '../../../utils/assetPreloader';

export const SplashScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [percent, setPercent] = useState(0);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Subtle smooth fade in and kick off asset preloading
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Preload all Skia game sprites into GPU cache in background
    preloadGameAssets();

    // 2. Realistic Loading Simulation (0% -> 100% in ~2.4s)
    let currentPct = 0;
    const interval = setInterval(() => {
      currentPct += Math.floor(Math.random() * 7) + 5;

      if (currentPct >= 100) {
        currentPct = 100;
        setPercent(100);
        clearInterval(interval);

        // Auto transition to Home once assets are confirmed preloaded in GPU memory
        preloadGameAssets().then(() => {
          setTimeout(() => {
            navigation.replace(SCREENS.HOME);
          }, 400);
        });
      } else {
        setPercent(currentPct);
      }
    }, 110);

    return () => clearInterval(interval);
  }, [fadeAnim, navigation]);

  const handleSkipOrProceed = () => {
    navigation.replace(SCREENS.HOME);
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={handleSkipOrProceed}
      style={styles.root}
    >
      <StatusBar barStyle="light-content" />

      {/* Exact Reference Artwork Backdrop */}
      <ImageBackground
        source={GAME_ASSETS.environment.splashArt}
        style={[styles.backdrop, { width: screenWidth, height: screenHeight }]}
        resizeMode="cover"
      >
        <Animated.View
          style={[
            styles.container,
            {
              paddingBottom: Math.max(insets.bottom, 24) + 65,
              opacity: fadeAnim,
            },
          ]}
        >
          {/* Bottom Live Interactive Loading Bar & Percentage */}
          <View style={styles.loadingSection}>
            <View style={styles.barRow}>
              {/* Rounded Progress Track */}
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${percent}%` },
                  ]}
                />
              </View>

              {/* Percentage Indicator */}
              <Text style={styles.percentText}>{percent}%</Text>
            </View>

            {/* Spaced LOADING text */}
            <Text style={styles.loadingLabel}>L O A D I N G . . .</Text>
          </View>
        </Animated.View>
      </ImageBackground>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#040817',
  },
  backdrop: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingSection: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarTrack: {
    width: 200,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1E293B',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#38BDF8',
    borderRadius: 5,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 3,
  },
  percentText: {
    marginLeft: 14,
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
    minWidth: 38,
  },
  loadingLabel: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 4,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
});
