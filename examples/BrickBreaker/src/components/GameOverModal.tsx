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
import { CloseCyberIcon } from './CyberIcons';

interface GameOverModalProps {
  visible: boolean;
  theme: ColorTheme;
  level: number;
  score: number;
  highScore: number;
  bricksLeft: number;
  totalBricks: number;
  onRetry: () => void;
  onRevive?: () => void;
  onClose: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  visible,
  level,
  score,
  highScore,
  bricksLeft,
  totalBricks,
  onRetry,
  onClose,
}) => {
  const bricksCleared = Math.max(0, totalBricks - bricksLeft);
  const progressPercent = Math.round((bricksCleared / Math.max(1, totalBricks)) * 100);

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

          {/* Header Banner */}
          <View style={styles.header}>
            <Text style={styles.title}>GAME OVER</Text>
            <Text style={styles.subtitle}>Level {level} • Good Effort</Text>
          </View>

          {/* Score Box */}
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>FINAL SCORE</Text>
            <Text style={styles.scoreValue}>{score.toLocaleString()}</Text>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statLabel}>BEST RECORD</Text>
              <Text style={styles.statValue}>{highScore.toLocaleString()}</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statLabel}>CLEARED</Text>
              <Text style={styles.statValue}>{progressPercent}%</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onRetry}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>TRY AGAIN</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onClose}
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryBtnText}>MAIN MENU</Text>
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
    marginTop: 6,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#EF4444',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
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
