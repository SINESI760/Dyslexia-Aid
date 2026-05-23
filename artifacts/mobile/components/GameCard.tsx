import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { DailyGame } from '@/context/GameContext';
import { GAME_INFO } from '@/constants/games';

interface GameCardProps {
  game: DailyGame;
  index: number;
  onPress: () => void;
  isNext?: boolean;
}

export function GameCard({ game, index, onPress, isNext }: GameCardProps) {
  const colors = useColors();
  const info = GAME_INFO[game.gameType] ?? {
    title: game.gameType,
    description: '',
    color: colors.primary,
    icon: 'circle',
    benefit: '',
  };

  const isCompleted = game.completed;

  return (
    <Pressable
      onPress={!isCompleted ? onPress : undefined}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderRadius: 16,
          borderWidth: isNext ? 2 : 1,
          borderColor: isNext ? info.color : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: isCompleted ? colors.muted : `${info.color}18` }]}>
        <Feather
          name={isCompleted ? 'check-circle' : (info.icon as any)}
          size={22}
          color={isCompleted ? colors.success : info.color}
        />
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: isCompleted ? colors.mutedForeground : colors.foreground }]}>
          {index + 1}. {info.title}
        </Text>
        <Text style={[styles.desc, { color: colors.mutedForeground }]}>{info.description}</Text>
        {isNext && !isCompleted && (
          <View style={[styles.badge, { backgroundColor: info.color }]}>
            <Text style={styles.badgeText}>Up next</Text>
          </View>
        )}
        {isCompleted && game.score !== undefined && (
          <Text style={[styles.score, { color: colors.success }]}>
            Score: {game.score} · {game.accuracy}% accuracy
          </Text>
        )}
      </View>
      {!isCompleted && (
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  desc: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  score: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
});
