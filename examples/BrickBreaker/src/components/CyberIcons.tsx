import React from 'react';
import { View, StyleSheet } from 'react-native';

interface IconProps {
  color?: string;
  size?: number;
}

// 1. Pause Icon: Dual glowing vertical cyber bars
export const PauseCyberIcon: React.FC<IconProps> = ({ color = '#00F0FF', size = 16 }) => {
  const barWidth = Math.max(3, Math.round(size * 0.22));
  const barHeight = Math.round(size * 0.85);
  const gap = Math.max(3, Math.round(size * 0.25));

  return (
    <View style={[styles.centerRow, { width: size, height: size }]}>
      <View
        style={{
          width: barWidth,
          height: barHeight,
          backgroundColor: color,
          borderRadius: 1,
          marginRight: gap,
        }}
      />
      <View
        style={{
          width: barWidth,
          height: barHeight,
          backgroundColor: color,
          borderRadius: 1,
        }}
      />
    </View>
  );
};

// 2. Audio Icon: Tech Speaker Cone + Stepped Equalizer Bars
export const AudioCyberIcon: React.FC<IconProps & { isMuted?: boolean }> = ({
  color = '#00F0FF',
  size = 16,
  isMuted = false,
}) => {
  if (isMuted) {
    return (
      <View style={[styles.center, { width: size, height: size, position: 'relative' }]}>
        <View style={{ width: size * 0.35, height: size * 0.5, backgroundColor: color, opacity: 0.4 }} />
        {/* Slashed line */}
        <View
          style={{
            position: 'absolute',
            width: size * 0.9,
            height: 2,
            backgroundColor: '#FF0055',
            transform: [{ rotate: '-45deg' }],
          }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.centerRow, { width: size, height: size, gap: 2 }]}>
      <View style={{ width: 3, height: size * 0.4, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: 3, height: size * 0.75, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: 3, height: size * 0.55, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: 3, height: size * 0.9, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
};

// 3. Theme/Palette Icon: 3 Staggered Glowing Chroma Slits
export const ThemeCyberIcon: React.FC<IconProps> = ({ color = '#00F0FF', size = 16 }) => {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View
        style={{
          width: size * 0.75,
          height: size * 0.75,
          borderWidth: 1.5,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: size * 0.3,
            height: size * 0.3,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
};

// 4. Trophy/Rank Icon: Angular Chevron Crest
export const TrophyCyberIcon: React.FC<IconProps> = ({ color = '#FFD60A', size = 16 }) => {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View
        style={{
          width: size * 0.8,
          height: size * 0.5,
          borderWidth: 1.5,
          borderColor: color,
          borderBottomLeftRadius: size * 0.4,
          borderBottomRightRadius: size * 0.4,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: 3, height: 3, backgroundColor: color, borderRadius: 1.5 }} />
      </View>
      <View style={{ width: size * 0.25, height: 2, backgroundColor: color, marginTop: 1 }} />
      <View style={{ width: size * 0.5, height: 2, backgroundColor: color, marginTop: 1 }} />
    </View>
  );
};

// 5. Laser Icon: Dual elevated railguns
export const LaserCyberIcon: React.FC<IconProps> = ({ color = '#00F0FF', size = 18 }) => {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-end' }}>
        <View style={{ width: 3, height: size * 0.7, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ width: 2, height: size * 0.9, backgroundColor: '#FFFFFF', borderRadius: 1 }} />
        <View style={{ width: 3, height: size * 0.7, backgroundColor: color, borderRadius: 1 }} />
      </View>
      <View style={{ width: size * 0.7, height: 2, backgroundColor: color, marginTop: 1 }} />
    </View>
  );
};

// 6. Shield Icon: Angular Hexagonal Deflector
export const ShieldCyberIcon: React.FC<IconProps> = ({ color = '#39FF14', size = 18 }) => {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View
        style={{
          width: size * 0.75,
          height: size * 0.85,
          borderWidth: 1.5,
          borderColor: color,
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
          borderBottomLeftRadius: size * 0.45,
          borderBottomRightRadius: size * 0.45,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: 4, height: 4, backgroundColor: color, transform: [{ rotate: '45deg' }] }} />
      </View>
    </View>
  );
};

// 7. Tri-Ball Icon: Delta Formation of 3 Glowing Quantum Nodes
export const TriBallCyberIcon: React.FC<IconProps> = ({ color = '#FF00AA', size = 18 }) => {
  const nodeSize = 4;
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      {/* Top Node */}
      <View
        style={{
          width: nodeSize,
          height: nodeSize,
          borderRadius: nodeSize / 2,
          backgroundColor: color,
          marginBottom: 3,
        }}
      />
      {/* Bottom Pair */}
      <View style={{ flexDirection: 'row', gap: 7 }}>
        <View
          style={{
            width: nodeSize,
            height: nodeSize,
            borderRadius: nodeSize / 2,
            backgroundColor: color,
          }}
        />
        <View
          style={{
            width: nodeSize,
            height: nodeSize,
            borderRadius: nodeSize / 2,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
};

// 8. Wide Paddle Icon: Expanding Lateral Chevrons
export const WideCyberIcon: React.FC<IconProps> = ({ color = '#FFD60A', size = 18 }) => {
  return (
    <View style={[styles.centerRow, { width: size, height: size, gap: 2 }]}>
      <View
        style={{
          width: 0,
          height: 0,
          borderTopWidth: 4,
          borderBottomWidth: 4,
          borderRightWidth: 5,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderRightColor: color,
        }}
      />
      <View style={{ width: size * 0.4, height: 3, backgroundColor: color, borderRadius: 1 }} />
      <View
        style={{
          width: 0,
          height: 0,
          borderTopWidth: 4,
          borderBottomWidth: 4,
          borderLeftWidth: 5,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: color,
        }}
      />
    </View>
  );
};

// 9. Chrono Icon: Quantum Dial Ring with Crosshair
export const ChronoCyberIcon: React.FC<IconProps> = ({ color = '#BF5AF2', size = 18 }) => {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View
        style={{
          width: size * 0.8,
          height: size * 0.8,
          borderRadius: (size * 0.8) / 2,
          borderWidth: 1.5,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: 1.5, height: size * 0.35, backgroundColor: color, position: 'absolute', top: 2 }} />
        <View style={{ width: size * 0.3, height: 1.5, backgroundColor: color, position: 'absolute', right: 2 }} />
        <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#FFFFFF' }} />
      </View>
    </View>
  );
};

// 10. Star / Rank Glyph: Diamond Star
export const StarCyberIcon: React.FC<IconProps & { filled?: boolean }> = ({
  color = '#FFD60A',
  size = 20,
  filled = true,
}) => {
  return (
    <View style={[styles.center, { width: size, height: size, position: 'relative' }]}>
      {/* Outer Diamond */}
      <View
        style={{
          width: size * 0.7,
          height: size * 0.7,
          borderWidth: 1.5,
          borderColor: color,
          backgroundColor: filled ? color + '33' : 'transparent',
          transform: [{ rotate: '45deg' }],
        }}
      />
      {/* Core Specular Dot */}
      <View
        style={{
          position: 'absolute',
          width: size * 0.25,
          height: size * 0.25,
          backgroundColor: filled ? color : color + '88',
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
};

// 11. Close Icon: Tech Cross
export const CloseCyberIcon: React.FC<IconProps> = ({ color = '#8E9BB0', size = 16 }) => {
  return (
    <View style={[styles.center, { width: size, height: size, position: 'relative' }]}>
      <View
        style={{
          position: 'absolute',
          width: size * 0.8,
          height: 1.8,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: size * 0.8,
          height: 1.8,
          backgroundColor: color,
          transform: [{ rotate: '-45deg' }],
        }}
      />
    </View>
  );
};

export const SettingsCyberIcon: React.FC<IconProps> = ({ color = '#00F0FF', size = 16 }) => {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View
        style={{
          width: size * 0.75,
          height: size * 0.75,
          borderWidth: 1.8,
          borderColor: color,
          borderRadius: 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: size * 0.25, height: size * 0.25, backgroundColor: color }} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
