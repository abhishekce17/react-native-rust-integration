import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { ColorTheme } from '../types/game';
import {
  PauseCyberIcon,
  AudioCyberIcon,
  ThemeCyberIcon,
  TrophyCyberIcon,
} from './CyberIcons';

interface GameHUDProps {
  theme: ColorTheme;
  score: number;
  highScore: number;
  combo: number;
  lives: number;
  maxLives: number;
  level: number;
  levelName: string;
  progressPercent: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenPause: () => void;
  onOpenThemes: () => void;
  onOpenVictory: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  theme,
  score,
  highScore,
  combo,
  lives,
  maxLives,
  level,
  levelName,
  progressPercent,
  isMuted,
  onToggleMute,
  onOpenPause,
  onOpenThemes,
  onOpenVictory,
}) => {
  // Segmented progress bars (10 segments)
  const totalSegments = 10;
  const activeSegments = Math.round((progressPercent / 100) * totalSegments);

  // Combo tier bars (up to 5 segments)
  const comboTier = Math.min(5, Math.max(1, Math.floor(combo)));

  return (
    <View style={styles.container}>
      {/* 1. Header Bar: Sector Telemetry and Hardware Controls */}
      <View style={styles.topBar}>
        {/* Sector Callout with Corner Brackets */}
        <View style={[styles.sectorContainer, { borderColor: theme.accent, backgroundColor: theme.hudCardBg }]}>
          <View style={[styles.pulseBeacon, { backgroundColor: theme.accent }]} />
          <Text style={[styles.sectorCode, { color: theme.accent }]}>
            SYS.SEC-{String(level).padStart(2, '0')} // {levelName.toUpperCase()}
          </Text>
        </View>

        {/* Vector Cyber Buttons (NO EMOJIS) */}
        <View style={styles.actionCluster}>
          {/* Victory Modal Preview */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onOpenVictory}
            style={[styles.cyberBtn, { borderColor: '#FFD60A66', backgroundColor: theme.hudCardBg }]}
          >
            <TrophyCyberIcon color="#FFD60A" size={13} />
          </TouchableOpacity>

          {/* Theme Palette Switcher */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onOpenThemes}
            style={[styles.cyberBtn, { borderColor: theme.hudBorder, backgroundColor: theme.hudCardBg }]}
          >
            <ThemeCyberIcon color={theme.accent} size={13} />
          </TouchableOpacity>

          {/* Audio Equalizer Toggle */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onToggleMute}
            style={[
              styles.cyberBtn,
              {
                borderColor: isMuted ? '#FF005588' : theme.hudBorder,
                backgroundColor: theme.hudCardBg,
              },
            ]}
          >
            <AudioCyberIcon color={isMuted ? '#FF0055' : theme.accent} size={13} isMuted={isMuted} />
          </TouchableOpacity>

          {/* Tactical Pause */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onOpenPause}
            style={[
              styles.cyberBtn,
              styles.pauseBtn,
              { borderColor: theme.accent, backgroundColor: theme.hudCardBg },
            ]}
          >
            <PauseCyberIcon color={theme.accent} size={13} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Segmented Stage Clearance Meter */}
      <View style={styles.clearanceContainer}>
        <View style={styles.clearanceMetaRow}>
          <Text style={[styles.clearanceLabel, { color: theme.accent }]}>
            TARGET MATRIX PURGE
          </Text>
          <Text style={[styles.clearanceValue, { color: '#FFFFFF' }]}>
            {Math.round(progressPercent)}%
          </Text>
        </View>
        <View style={styles.segmentedTrack}>
          {Array.from({ length: totalSegments }).map((_, idx) => {
            const isFilled = idx < activeSegments;
            return (
              <View
                key={`seg_${idx}`}
                style={[
                  styles.segmentBlock,
                  {
                    backgroundColor: isFilled ? theme.accent : 'rgba(255, 255, 255, 0.08)',
                    borderColor: isFilled ? theme.accent : 'rgba(255, 255, 255, 0.04)',
                    shadowColor: isFilled ? theme.accent : 'transparent',
                    shadowOpacity: isFilled ? 0.8 : 0,
                    shadowRadius: 4,
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* 3. Main Telemetry Deck: Score, Combo Surge, Shield Cores */}
      <View style={[styles.mainDeck, { backgroundColor: theme.hudCardBg, borderColor: theme.hudBorder }]}>
        {/* Score Readout */}
        <View style={styles.scoreModule}>
          <View style={styles.tagLine}>
            <Text style={styles.tagPrefix}>[</Text>
            <Text style={[styles.tagText, { color: theme.accent }]}>SCORE READOUT</Text>
            <Text style={styles.tagPrefix}>]</Text>
          </View>
          <Text
            style={[
              styles.scoreDigits,
              {
                color: '#FFFFFF',
                textShadowColor: theme.accent,
                textShadowRadius: 8,
              },
            ]}
          >
            {score.toLocaleString()}
          </Text>
          <Text style={styles.highRecordText}>
            ALL-TIME // {highScore.toLocaleString()}
          </Text>
        </View>

        {/* Combo Multiplier Surge Gauge */}
        <View style={styles.comboModule}>
          <Text style={[styles.comboTag, { color: theme.secondary }]}>
            COMBO SURGE
          </Text>
          <Text style={[styles.comboDigits, { color: combo > 1 ? theme.secondary : '#8E9BB0' }]}>
            {combo.toFixed(1)}x
          </Text>
          {/* 5-Block Surge Indicator */}
          <View style={styles.surgeBlocksRow}>
            {Array.from({ length: 5 }).map((_, i) => {
              const active = i < comboTier;
              return (
                <View
                  key={`surge_${i}`}
                  style={[
                    styles.surgeCell,
                    {
                      backgroundColor: active ? theme.secondary : 'rgba(255, 255, 255, 0.1)',
                      borderColor: active ? theme.secondary : 'transparent',
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>

        {/* Shield Cores Matrix */}
        <View style={styles.shieldModule}>
          <Text style={styles.shieldTag}>AEGIS CORES</Text>
          <View style={styles.coresRow}>
            {Array.from({ length: maxLives }).map((_, idx) => {
              const isCharged = idx < lives;
              return (
                <View
                  key={`core_node_${idx}`}
                  style={[
                    styles.coreFrame,
                    {
                      borderColor: isCharged ? theme.accent : 'rgba(255, 255, 255, 0.15)',
                      backgroundColor: isCharged
                        ? 'rgba(0, 240, 255, 0.18)'
                        : 'rgba(0, 0, 0, 0.4)',
                      shadowColor: isCharged ? theme.accent : 'transparent',
                      shadowOpacity: isCharged ? 0.9 : 0,
                      shadowRadius: 6,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.coreCenterDot,
                      {
                        backgroundColor: isCharged ? '#FFFFFF' : '#454C5C',
                      },
                    ]}
                  />
                </View>
              );
            })}
          </View>
          <Text style={[styles.shieldStatusText, { color: theme.accent }]}>
            {lives} / {maxLives} ONLINE
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 4,
    zIndex: 10,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    gap: 7,
  },
  pulseBeacon: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  sectorCode: {
    fontFamily: 'Courier',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  actionCluster: {
    flexDirection: 'row',
    gap: 6,
  },
  cyberBtn: {
    width: 32,
    height: 32,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseBtn: {
    borderWidth: 1.5,
  },
  clearanceContainer: {
    marginTop: 6,
    gap: 3,
  },
  clearanceMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  clearanceLabel: {
    fontFamily: 'Courier',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },
  clearanceValue: {
    fontFamily: 'Courier',
    fontSize: 9,
    fontWeight: '800',
  },
  segmentedTrack: {
    flexDirection: 'row',
    gap: 3,
    height: 4,
  },
  segmentBlock: {
    flex: 1,
    borderRadius: 1,
    borderWidth: 0.5,
  },
  mainDeck: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  scoreModule: {
    flex: 1.3,
  },
  tagLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagPrefix: {
    fontFamily: 'Courier',
    fontSize: 8,
    color: '#657285',
  },
  tagText: {
    fontFamily: 'Courier',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    marginHorizontal: 2,
  },
  scoreDigits: {
    fontFamily: 'Courier',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  highRecordText: {
    fontFamily: 'Courier',
    fontSize: 8,
    color: '#717E94',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  comboModule: {
    alignItems: 'center',
    paddingHorizontal: 10,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  comboTag: {
    fontFamily: 'Courier',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1,
  },
  comboDigits: {
    fontFamily: 'Courier',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginVertical: 1,
  },
  surgeBlocksRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  surgeCell: {
    width: 5,
    height: 3,
    borderRadius: 1,
  },
  shieldModule: {
    alignItems: 'flex-end',
    flex: 1.1,
  },
  shieldTag: {
    fontFamily: 'Courier',
    fontSize: 8,
    fontWeight: '800',
    color: '#8E9BB0',
    letterSpacing: 1,
  },
  coresRow: {
    flexDirection: 'row',
    gap: 5,
    marginVertical: 3,
  },
  coreFrame: {
    width: 18,
    height: 18,
    borderRadius: 2,
    borderWidth: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '45deg' }],
  },
  coreCenterDot: {
    width: 5,
    height: 5,
    borderRadius: 1,
  },
  shieldStatusText: {
    fontFamily: 'Courier',
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
