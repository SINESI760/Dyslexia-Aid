import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useUser } from '@/context/UserContext';
import { useGame } from '@/context/GameContext';
import { GAME_INFO } from '@/constants/games';
import * as Haptics from 'expo-haptics';

export default function CompleteScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, addGameSession } = useUser();
  const { completeGame, getNextGame, dailyProgress } = useGame();
  const params = useLocalSearchParams<{
    gameId: string;
    gameType: string;
    score: string;
    accuracy: string;
    timeSpent: string;
    level: string;
    xpEarned: string;
  }>();

  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const saved = useRef(false);

  const score = parseInt(params.score ?? '0');
  const accuracy = parseInt(params.accuracy ?? '0');
  const timeSpent = parseInt(params.timeSpent ?? '0');
  const level = parseInt(params.level ?? '1');
  const xpEarned = parseInt(params.xpEarned ?? '10');
  const gameType = params.gameType ?? '';
  const gameId = params.gameId ?? '';

  const info = GAME_INFO[gameType];

  useEffect(() => {
    if (!saved.current) {
      saved.current = true;
      completeGame(gameId, score, accuracy, xpEarned);
      addGameSession({ gameId, gameType, score, accuracy, timeSpent, level, xpEarned });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const nextGame = getNextGame();
  const completedCount = dailyProgress?.completedCount ?? 0;
  const totalCount = dailyProgress?.games.length ?? 7;

  const handleNext = () => {
    if (nextGame) {
      router.replace(`/games/${nextGame.gameType}?gameId=${nextGame.id}&level=${nextGame.level}`);
    } else {
      router.replace('/(tabs)/');
    }
  };

  const getAccuracyLabel = () => {
    if (accuracy >= 90) return { label: 'Outstanding!', color: colors.success };
    if (accuracy >= 70) return { label: 'Great job!', color: colors.primary };
    if (accuracy >= 50) return { label: 'Good effort!', color: colors.warning };
    return { label: 'Keep trying!', color: colors.destructive };
  };

  const { label, color } = getAccuracyLabel();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      <Animated.View style={[styles.inner, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={[styles.badge, { backgroundColor: `${color}18` }]}>
          <Feather name="star" size={40} color={color} />
        </View>

        <Text style={[styles.title, { color }]}>{label}</Text>
        <Text style={[styles.gameName, { color: colors.foreground }]}>
          {info?.title ?? gameType}
        </Text>

        <View style={[styles.statsRow, { backgroundColor: colors.card, borderRadius: 20 }]}>
          <View style={styles.stat}>
            <Text style={[styles.statVal, { color: colors.primary }]}>{score}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Score</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text style={[styles.statVal, { color: colors.success }]}>{accuracy}%</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Accuracy</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text style={[styles.statVal, { color: colors.warning }]}>+{xpEarned}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>XP</Text>
          </View>
        </View>

        <View style={[styles.progressInfo, { backgroundColor: colors.muted, borderRadius: 14 }]}>
          <Feather name="check-circle" size={16} color={colors.success} />
          <Text style={[styles.progressText, { color: colors.foreground }]}>
            {completedCount} of {totalCount} daily games done
          </Text>
        </View>

        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1, borderRadius: 16 },
          ]}
        >
          <Text style={[styles.btnText, { color: colors.primaryForeground }]}>
            {nextGame ? 'Next Game' : 'Back to Home'}
          </Text>
          <Feather name={nextGame ? 'arrow-right' : 'home'} size={18} color={colors.primaryForeground} />
        </Pressable>

        <Pressable onPress={() => router.replace('/(tabs)/')} style={styles.skipBtn}>
          <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Go to Home</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  inner: { alignItems: 'center', gap: 20 },
  badge: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  gameName: { fontSize: 18, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  statsRow: {
    flexDirection: 'row', padding: 20, width: '100%',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
  },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statVal: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  divider: { width: 1, marginHorizontal: 8 },
  progressInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, width: '100%',
  },
  progressText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 16, paddingHorizontal: 32, width: '100%',
    justifyContent: 'center',
    shadowColor: '#6366F1', shadowOpacity: 0.3, shadowRadius: 12, elevation: 5,
  },
  btnText: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  skipBtn: { paddingVertical: 8 },
  skipText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
});
