import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { ColorTheme, ThemeId } from '../types/game';
import { THEMES } from '../theme/themes';
import { CloseCyberIcon } from './CyberIcons';

interface ThemeSelectorModalProps {
  visible: boolean;
  currentThemeId: ThemeId;
  onSelectTheme: (themeId: ThemeId) => void;
  onClose: () => void;
}

export const ThemeSelectorModal: React.FC<ThemeSelectorModalProps> = ({
  visible,
  currentThemeId,
  onSelectTheme,
  onClose,
}) => {
  const currentTheme = THEMES[currentThemeId];
  const themeList = Object.values(THEMES);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={[styles.dialogCard, { borderColor: currentTheme.accent, backgroundColor: '#070B1CFC' }]}>
          {/* Cyber Corner Notches */}
          <View style={[styles.cornerTL, { borderColor: currentTheme.accent }]} />
          <View style={[styles.cornerTR, { borderColor: currentTheme.accent }]} />
          <View style={[styles.cornerBL, { borderColor: currentTheme.accent }]} />
          <View style={[styles.cornerBR, { borderColor: currentTheme.accent }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.headerBeacon, { backgroundColor: currentTheme.accent }]} />
              <Text style={[styles.headerTitle, { color: currentTheme.accent }]}>
                CHROMA MATRIX // PALETTE DECK
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <CloseCyberIcon color="#8E9BB0" size={14} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subPrompt}>
            SELECT OPTICAL FREQUENCY PRESET:
          </Text>

          {/* Theme Palette Modules */}
          <View style={styles.themeList}>
            {themeList.map((item: ColorTheme, index: number) => {
              const isSelected = item.id === currentThemeId;
              const idxCode = String(index + 1).padStart(2, '0');

              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.8}
                  onPress={() => onSelectTheme(item.id)}
                  style={[
                    styles.themeRow,
                    {
                      borderColor: isSelected ? item.accent : 'rgba(255, 255, 255, 0.08)',
                      backgroundColor: isSelected
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(255, 255, 255, 0.02)',
                    },
                  ]}
                >
                  <View style={styles.themeInfo}>
                    <Text style={[styles.themeCode, { color: isSelected ? item.accent : '#566275' }]}>
                      PALETTE-{idxCode}
                    </Text>
                    <Text style={[styles.themeName, { color: isSelected ? item.accent : '#FFFFFF' }]}>
                      {item.name.toUpperCase()}
                    </Text>

                    {/* Color Swatch Bars */}
                    <View style={styles.swatchGroup}>
                      <View style={[styles.swatchBar, { backgroundColor: item.accent }]} />
                      <View style={[styles.swatchBar, { backgroundColor: item.secondary }]} />
                      <View style={[styles.swatchBar, { backgroundColor: item.backgroundStart }]} />
                    </View>
                  </View>

                  {/* High-tech Selector Diamond */}
                  <View
                    style={[
                      styles.indicatorDiamond,
                      {
                        borderColor: isSelected ? item.accent : '#414B5C',
                        backgroundColor: isSelected ? item.accent + '22' : 'transparent',
                      },
                    ]}
                  >
                    {isSelected && (
                      <View style={[styles.diamondCore, { backgroundColor: item.accent }]} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onClose}
            style={[styles.confirmBtn, { backgroundColor: currentTheme.accent }]}
          >
            <Text style={styles.confirmBtnText}>
              [ CONFIRM OPTICAL MATRIX ]
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 4, 12, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 8,
    borderWidth: 1.5,
    padding: 20,
    position: 'relative',
  },
  cornerTL: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 10,
    height: 10,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  cornerTR: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderTopWidth: 2,
    borderRightWidth: 2,
  },
  cornerBL: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 10,
    height: 10,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
  },
  cornerBR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 10,
    height: 10,
    borderBottomWidth: 2,
    borderRightWidth: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBeacon: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headerTitle: {
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subPrompt: {
    fontFamily: 'Courier',
    fontSize: 8,
    fontWeight: '700',
    color: '#8E9BB0',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  themeList: {
    gap: 8,
    marginBottom: 16,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 4,
    borderWidth: 1.2,
  },
  themeInfo: {
    gap: 3,
  },
  themeCode: {
    fontFamily: 'Courier',
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  themeName: {
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  swatchGroup: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  swatchBar: {
    width: 22,
    height: 4,
    borderRadius: 1,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  indicatorDiamond: {
    width: 20,
    height: 20,
    borderRadius: 2,
    borderWidth: 1.2,
    transform: [{ rotate: '45deg' }],
    justifyContent: 'center',
    alignItems: 'center',
  },
  diamondCore: {
    width: 8,
    height: 8,
    borderRadius: 1,
  },
  confirmBtn: {
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontFamily: 'Courier',
    color: '#000000',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1.2,
  },
});
