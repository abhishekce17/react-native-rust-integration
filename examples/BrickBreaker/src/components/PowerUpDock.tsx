import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { ColorTheme, PowerUp, PowerUpType } from '../types/game';
import {
  LaserCyberIcon,
  ShieldCyberIcon,
  TriBallCyberIcon,
  WideCyberIcon,
  ChronoCyberIcon,
} from './CyberIcons';

interface PowerUpDockProps {
  theme: ColorTheme;
  powerUps: PowerUp[];
  onTogglePowerUp: (id: PowerUpType) => void;
}

export const PowerUpDock: React.FC<PowerUpDockProps> = ({
  theme,
  powerUps,
  onTogglePowerUp,
}) => {
  const renderPowerUpIcon = (id: PowerUpType, color: string) => {
    switch (id) {
      case 'triball':
        return <TriBallCyberIcon color={color} size={16} />;
      case 'wide':
        return <WideCyberIcon color={color} size={16} />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Tactical Sub-header */}
      <View style={styles.dockHeader}>
        <View style={[styles.headerRule, { backgroundColor: theme.hudBorder }]} />
        <Text style={[styles.dockLabel, { color: theme.accent }]}>
          OVERDRIVE MODULE RACK // SELECT BUFF
        </Text>
        <View style={[styles.headerRule, { backgroundColor: theme.hudBorder }]} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {powerUps.map((item, index) => {
          const isActive = item.active;
          const displayColor = isActive ? item.color : '#6E7A91';
          const modNumber = String(index + 1).padStart(2, '0');

          // 6-segment countdown bar
          const totalCells = 6;
          const filledCells = isActive
            ? Math.ceil((item.remaining / item.duration) * totalCells)
            : 0;

          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.8}
              onPress={() => onTogglePowerUp(item.id)}
              style={[
                styles.moduleCard,
                {
                  backgroundColor: isActive
                    ? 'rgba(12, 22, 48, 0.92)'
                    : 'rgba(8, 12, 24, 0.75)',
                  borderColor: isActive ? item.color : 'rgba(255, 255, 255, 0.1)',
                  shadowColor: item.color,
                  shadowOpacity: isActive ? 0.7 : 0,
                  shadowRadius: 10,
                },
              ]}
            >
              {/* Corner tech ticks */}
              <View
                style={[
                  styles.cornerTickTL,
                  { borderColor: isActive ? item.color : 'rgba(255,255,255,0.2)' },
                ]}
              />

              {/* Module Header Row */}
              <View style={styles.moduleHeaderRow}>
                <Text style={[styles.moduleCode, { color: isActive ? item.color : '#5F6B80' }]}>
                  MOD-{modNumber}
                </Text>
                <View
                  style={[
                    styles.statusPill,
                    {
                      borderColor: isActive ? item.color : 'rgba(255, 255, 255, 0.1)',
                      backgroundColor: isActive ? item.color + '22' : 'transparent',
                    },
                  ]}
                >
                  <Text style={[styles.statusPillText, { color: isActive ? item.color : '#5F6B80' }]}>
                    {isActive ? 'ONLINE' : 'STBY'}
                  </Text>
                </View>
              </View>

              {/* Vector Icon Housing */}
              <View
                style={[
                  styles.iconHousing,
                  {
                    borderColor: isActive ? item.color : 'rgba(255, 255, 255, 0.08)',
                    backgroundColor: isActive
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(0, 0, 0, 0.3)',
                  },
                ]}
              >
                {renderPowerUpIcon(item.id, displayColor)}
              </View>

              {/* Module Name */}
              <Text style={[styles.moduleName, { color: isActive ? '#FFFFFF' : '#8A97AD' }]}>
                {item.name}
              </Text>
              <Text style={[styles.moduleSubtitle, { color: isActive ? item.color : '#586375' }]}>
                {item.subtitle}
              </Text>

              {/* Segmented discharge gauge */}
              <View style={styles.gaugeContainer}>
                <View style={styles.gaugeSegments}>
                  {Array.from({ length: totalCells }).map((_, cIdx) => (
                    <View
                      key={`gauge_${cIdx}`}
                      style={[
                        styles.gaugeBlock,
                        {
                          backgroundColor:
                            cIdx < filledCells ? item.color : 'rgba(255, 255, 255, 0.08)',
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.gaugeTimeText, { color: isActive ? item.color : '#586375' }]}>
                  {isActive ? `${item.remaining.toFixed(1)}S` : 'ARMED'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 2,
    paddingBottom: 6,
  },
  dockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 5,
    gap: 8,
  },
  headerRule: {
    flex: 1,
    height: 1,
  },
  dockLabel: {
    fontFamily: 'Courier',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  scrollContent: {
    paddingHorizontal: 14,
    gap: 7,
  },
  moduleCard: {
    width: 110,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1.2,
    position: 'relative',
    shadowOffset: { width: 0, height: 0 },
  },
  cornerTickTL: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 4,
    height: 4,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
  },
  moduleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  moduleCode: {
    fontFamily: 'Courier',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  statusPill: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    borderWidth: 0.8,
  },
  statusPillText: {
    fontFamily: 'Courier',
    fontSize: 6.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  iconHousing: {
    width: '100%',
    height: 28,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  moduleName: {
    fontFamily: 'Courier',
    fontSize: 8.5,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  moduleSubtitle: {
    fontFamily: 'Courier',
    fontSize: 7,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 1,
  },
  gaugeContainer: {
    width: '100%',
    marginTop: 5,
    gap: 2,
  },
  gaugeSegments: {
    flexDirection: 'row',
    gap: 2,
    height: 3,
  },
  gaugeBlock: {
    flex: 1,
    borderRadius: 0.5,
  },
  gaugeTimeText: {
    fontFamily: 'Courier',
    fontSize: 7,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
