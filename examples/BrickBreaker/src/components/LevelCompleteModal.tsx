import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
} from 'react-native';
import { ColorTheme } from '../types/game';
import { CloseCyberIcon, StarCyberIcon } from './CyberIcons';

interface LevelCompleteModalProps {
  visible: boolean;
  theme: ColorTheme;
  level: number;
  score: number;
  highScore: number;
  maxCombo: number;
  onNextLevel: () => void;
  onReplay: () => void;
  onClose: () => void;
}

export const LevelCompleteModal: React.FC<LevelCompleteModalProps> = ({
  visible,
  level,
  score,
  highScore,
  maxCombo,
  onNextLevel,
  onReplay,
  onClose,
}) => {
  const isNewRecord = score >= highScore && score > 0;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Close button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <CloseCyberIcon color="#94A3B8" size={16} />
          </TouchableOpacity>

          {/* 3 Shiny Gold Game Stars (Transparent Background Arc) */}
          <View style={styles.starsRow}>
            <Image
              source={require('../assets/ui/icon_star.png')}
              style={styles.starIconLeft}
              resizeMode="contain"
            />
            <Image
              source={require('../assets/ui/icon_star.png')}
              style={styles.starIconCenter}
              resizeMode="contain"
            />
            <Image
              source={require('../assets/ui/icon_star.png')}
              style={styles.starIconRight}
              resizeMode="contain"
            />
          </View>

          {/* Celebration Header */}
          <View style={styles.header}>
            <Text style={styles.title}>LEVEL COMPLETE!</Text>
            <Text style={styles.subtitle}>Level {level} Cleared</Text>
          </View>

          {/* Score Card */}
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>SCORE</Text>
            <Text style={styles.scoreValue}>{score.toLocaleString()}</Text>
            {isNewRecord && (
              <View style={styles.newRecordBadge}>
                <Text style={styles.newRecordText}>NEW BEST SCORE</Text>
              </View>
            )}
          </View>

          {/* Quick Stats Pill Row */}
          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statLabel}>MAX COMBO</Text>
              <Text style={styles.statValue}>x{maxCombo}</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statLabel}>HIGH SCORE</Text>
              <Text style={styles.statValue}>{highScore.toLocaleString()}</Text>
            </View>
          </View>

          {/* Clean Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onNextLevel}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>NEXT LEVEL</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onReplay}
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryBtnText}>PLAY AGAIN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: '#0F172A',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#38BDF8',
    marginTop: 2,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 8,
    marginBottom: 16,
  },
  starIconLeft: {
    width: 54,
    height: 54,
    transform: [{ translateY: 4 }, { rotate: '-10deg' }],
  },
  starIconCenter: {
    width: 72,
    height: 72,
    transform: [{ translateY: -8 }],
  },
  starIconRight: {
    width: 54,
    height: 54,
    transform: [{ translateY: 4 }, { rotate: '10deg' }],
  },
  scoreCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  scoreValue: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  newRecordBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 6,
  },
  newRecordText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginBottom: 16,
  },
  statPill: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F1F5F9',
    marginTop: 2,
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  primaryBtn: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
