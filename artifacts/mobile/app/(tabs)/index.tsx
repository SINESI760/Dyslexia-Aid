import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, Platform } from 'react-native';
import { router, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useUser } from '@/context/UserContext';
import { useGame } from '@/context/GameContext';
import { ProgressBar } from '@/components/ProgressBar';
import { DYSLEXIA_TYPES, DYSLEXIA_LEVELS, GAME_INFO } from '@/constants/games';
import * as Haptics from 'expo-haptics';

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, isLoading } = useUser();
  const { dailyProgress, initializeDailyGames, getDailyCompletionPercent, getNextGame } = useGame();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  useEffect(() => {
    if (isLoading || !profile || !profile.assessmentComplete) return;
    initializeDailyGames(profile.dyslexiaType, profile.currentLevel);
  }, [profile, isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9F8FF', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (!profile) return <Redirect href="/onboarding" />;
  if (!profile.assessmentComplete) return <Redirect href="/games/assessment" />;

  const completionPercent = getDailyCompletionPercent();
  const nextGame = getNextGame();
  const today = new Date().toDateString();
  const todaySessions = profile.gameSessions.filter(
    (s) => new Date(s.date).toDateString() === today
  );
  const dailyGames = dailyProgress?.games ?? [];
  const completedToday = dailyProgress?.completedCount ?? 0;
  const totalToday = dailyGames.length;
  const isAllDone = completedToday >= totalToday && totalToday > 0;

  const typeInfo = profile.dyslexiaType ? DYSLEXIA_TYPES[profile.dyslexiaType] : null;
  const levelInfo = DYSLEXIA_LEVELS[profile.dyslexiaLevel];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handlePlayNext = () => {
    if (!nextGame) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/games/${nextGame.gameType}?gameId=${nextGame.id}&level=${nextGame.level}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 8, paddingBottom: botPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{getGreeting()},</Text>
            <Text style={[styles.name, { color: colors.foreground }]}>{profile.name}</Text>
          </View>
          <View style={[styles.levelBadge, { backgroundColor: colors.primary }]}>
            <Feather name="zap" size={14} color="#fff" />
            <Text style={styles.levelText}>Lv.{profile.currentLevel}</Text>
          </View>
        </View>

        {profile.streak > 0 && (
          <View style={[styles.streakBanner, { backgroundColor: `${colors.warning}20`, borderRadius: 16 }]}>
            <Feather name="zap" size={18} color={colors.warning} />
            <Text style={[styles.streakText, { color: colors.warning }]}>
              {profile.streak} day streak — keep it up!
            </Text>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: 22 }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Today's Progress</Text>
            <Text style={[styles.cardCount, { color: colors.primary }]}>
              {completedToday}/{totalToday}
            </Text>
          </View>
          <ProgressBar
            percent={completionPercent}
            showLabel={false}
            height={14}
            color={isAllDone ? colors.success : colors.primary}
          />
          {isAllDone ? (
            <View style={styles.allDoneRow}>
              <Feather name="check-circle" size={16} color={colors.success} />
              <Text style={[styles.allDoneText, { color: colors.success }]}>
                All daily games complete!
              </Text>
            </View>
          ) : (
            <Text style={[styles.remainingText, { color: colors.mutedForeground }]}>
              {totalToday - completedToday} games remaining today
            </Text>
          )}
        </View>

        {!isAllDone && nextGame && (
          <Pressable
            onPress={handlePlayNext}
            style={({ pressed }) => [
              styles.playCard,
              {
                backgroundColor: colors.primary,
                borderRadius: 22,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <View style={styles.playCardContent}>
              <View>
                <Text style={styles.playCardLabel}>Up next</Text>
                <Text style={styles.playCardTitle}>
                  {GAME_INFO[nextGame.gameType]?.title ?? nextGame.gameType}
                </Text>
                <Text style={styles.playCardSub}>
                  Level {nextGame.level} · {GAME_INFO[nextGame.gameType]?.description}
                </Text>
              </View>
              <View style={styles.playBtn}>
                <Feather name="play" size={22} color={colors.primary} />
              </View>
            </View>
          </Pressable>
        )}

        {isAllDone && (
          <View style={[styles.completedCard, { backgroundColor: `${colors.success}15`, borderRadius: 22, borderColor: colors.success, borderWidth: 1 }]}>
            <Feather name="award" size={32} color={colors.success} />
            <Text style={[styles.completedTitle, { color: colors.success }]}>
              Daily goal achieved!
            </Text>
            <Text style={[styles.completedSub, { color: colors.mutedForeground }]}>
              Come back tomorrow for a new set of games
            </Text>
          </View>
        )}

        <View style={styles.row}>
          <View style={[styles.statMini, { backgroundColor: colors.card, borderRadius: 18 }]}>
            <Feather name="award" size={20} color={colors.warning} />
            <Text style={[styles.statMiniVal, { color: colors.foreground }]}>{profile.totalXP}</Text>
            <Text style={[styles.statMiniLabel, { color: colors.mutedForeground }]}>XP earned</Text>
          </View>
          <View style={[styles.statMini, { backgroundColor: colors.card, borderRadius: 18 }]}>
            <Feather name="target" size={20} color={colors.success} />
            <Text style={[styles.statMiniVal, { color: colors.foreground }]}>
              {profile.gameSessions.length}
            </Text>
            <Text style={[styles.statMiniLabel, { color: colors.mutedForeground }]}>Games played</Text>
          </View>
        </View>

        {typeInfo && (
          <View style={[styles.profileCard, { backgroundColor: colors.card, borderRadius: 20 }]}>
            <Text style={[styles.profileCardTitle, { color: colors.mutedForeground }]}>
              Your Learning Profile
            </Text>
            <View style={styles.profileRow}>
              <View style={[styles.typeBadge, { backgroundColor: `${typeInfo.color}18` }]}>
                <Text style={[styles.typeText, { color: typeInfo.color }]}>
                  {typeInfo.label} Dyslexia
                </Text>
              </View>
              <View style={[styles.levelBadgeSmall, { backgroundColor: `${levelInfo.color}18` }]}>
                <Text style={[styles.levelSmallText, { color: levelInfo.color }]}>
                  {levelInfo.label}
                </Text>
              </View>
            </View>
            <Text style={[styles.profileDesc, { color: colors.mutedForeground }]}>
              {typeInfo.description}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  name: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  levelBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  levelText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
  streakBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  streakText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  card: {
    padding: 20, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  cardCount: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  allDoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  allDoneText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  remainingText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  playCard: {
    padding: 20,
    shadowColor: '#6366F1', shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  playCardContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  playCardLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: 'Inter_500Medium' },
  playCardTitle: { color: '#fff', fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 2 },
  playCardSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 4 },
  playBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  completedCard: {
    padding: 24, alignItems: 'center', gap: 8,
  },
  completedTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  completedSub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  row: { flexDirection: 'row', gap: 12 },
  statMini: {
    flex: 1, padding: 16, alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 2,
  },
  statMiniVal: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  statMiniLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  profileCard: {
    padding: 18, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, elevation: 2,
  },
  profileCardTitle: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  profileRow: { flexDirection: 'row', gap: 10 },
  typeBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  typeText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  levelBadgeSmall: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  levelSmallText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  profileDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
});
