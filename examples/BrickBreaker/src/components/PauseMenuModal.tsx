import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { ColorTheme } from '../types/game';
import { CloseCyberIcon } from './CyberIcons';

interface PauseMenuModalProps {
  visible: boolean;
  theme: ColorTheme;
  score: number;
  bricksLeft: number;
  totalBricks: number;
  onResume: () => void;
  onRestart: () => void;
  onHome?: () => void;
}

export const PauseMenuModal: React.FC<PauseMenuModalProps> = ({
  visible,
  score,
  bricksLeft,
  totalBricks,
  onResume,
  onRestart,
  onHome,
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
            onPress={onResume}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <CloseCyberIcon color="#94A3B8" size={16} />
          </TouchableOpacity>

          {/* Header */}
          <Text style={styles.title}>PAUSED</Text>

          {/* Score & Progress Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>CURRENT SCORE</Text>
              <Text style={styles.summaryValue}>{score.toLocaleString()}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>PROGRESS</Text>
              <Text style={styles.summaryValue}>{progressPercent}%</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onResume}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>RESUME</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onRestart}
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryBtnText}>RESTART</Text>
            </TouchableOpacity>

            {onHome && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onHome}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>QUIT TO MENU</Text>
              </TouchableOpacity>
            )}
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
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom : 10
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
    marginBottom: 16,
  },
  summaryCard: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  actions: {
    width: '100%',
    gap: 10,
    marginTop: 4,
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
