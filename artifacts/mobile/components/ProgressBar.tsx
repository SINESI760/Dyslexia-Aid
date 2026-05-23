import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface ProgressBarProps {
  percent: number;
  label?: string;
  height?: number;
  showLabel?: boolean;
  color?: string;
}

export function ProgressBar({
  percent,
  label,
  height = 12,
  showLabel = true,
  color,
}: ProgressBarProps) {
  const colors = useColors();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: Math.min(100, Math.max(0, percent)),
      useNativeDriver: false,
      tension: 40,
      friction: 8,
    }).start();
  }, [percent]);

  const barColor = color || colors.primary;

  const width = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View>
      {showLabel && label && (
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      )}
      <View
        style={[
          styles.track,
          { height, backgroundColor: colors.muted, borderRadius: height / 2 },
        ]}
      >
        <Animated.View
          style={[
            styles.fill,
            {
              width,
              height,
              backgroundColor: barColor,
              borderRadius: height / 2,
            },
          ]}
        />
      </View>
      {showLabel && (
        <Text style={[styles.percent, { color: colors.mutedForeground }]}>
          {Math.round(percent)}%
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    marginBottom: 4,
    fontFamily: 'Inter_500Medium',
  },
  track: {
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  percent: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'right',
    fontFamily: 'Inter_400Regular',
  },
});
