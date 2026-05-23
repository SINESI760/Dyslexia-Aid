import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface StatsCardProps {
  value: string | number;
  label: string;
  icon: string;
  color?: string;
  subtitle?: string;
}

export function StatsCard({ value, label, icon, color, subtitle }: StatsCardProps) {
  const colors = useColors();
  const cardColor = color || colors.primary;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderRadius: 16 }]}>
      <View style={[styles.iconRow, { backgroundColor: `${cardColor}18` }]}>
        <Feather name={icon as any} size={18} color={cardColor} />
      </View>
      <Text style={[styles.value, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      {subtitle && (
        <Text style={[styles.subtitle, { color: cardColor }]}>{subtitle}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    alignItems: 'center',
    gap: 6,
    flex: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconRow: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
  },
  label: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
});
