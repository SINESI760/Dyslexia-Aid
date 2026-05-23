import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useUser } from '@/context/UserContext';
import { StatsCard } from '@/components/StatsCard';
import { WeeklyChart } from '@/components/WeeklyChart';
import { DYSLEXIA_TYPES, DYSLEXIA_LEVELS } from '@/constants/games';

export default function ProgressScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, getWeeklySessions, getAverageAccuracy } = useUser();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  if (!profile) return null;

  const weeklySessions = getWeeklySessions();
  const avgAccuracy = getAverageAccuracy();
  const totalSessions = profile.gameSessions.length;
  const streak = profile.streak;

  const xpToNextLevel = 300 - (profile.totalXP % 300);
  const xpPercent = ((profile.totalXP % 300) / 300) * 100;

  const typeInfo = profile.dyslexiaType ? DYSLEXIA_TYPES[profile.dyslexiaType] : null;
  const levelInfo = DYSLEXIA_LEVELS[profile.dyslexiaLevel];

  const getWeeklyImprovement = () => {
    if (weeklySessions.length < 2) return 0;
    const firstHalf = weeklySessions.slice(0, Math.floor(weeklySessions.length / 2));
    const secondHalf = weeklySessions.slice(Math.floor(weeklySessions.length / 2));
    const firstAvg = firstHalf.reduce((s, g) => s + g.accuracy, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, g) => s + g.accuracy, 0) / secondHalf.length;
    return Math.round(secondAvg - firstAvg);
  };

  const improvement = getWeeklyImprovement();

  const gameTypeCounts: Record<string, number> = {};
  profile.gameSessions.forEach((s) => {
    gameTypeCounts[s.gameType] = (gameTypeCounts[s.gameType] ?? 0) + 1;
  });
  const topGame = Object.entries(gameTypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 8, paddingBottom: botPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>My Progress</Text>

        <View style={styles.statsRow}>
          <StatsCard
            value={`${avgAccuracy}%`}
            label="Avg Accuracy"
            icon="target"
            color={colors.primary}
            subtitle={improvement > 0 ? `+${improvement}% this week` : undefined}
          />
          <StatsCard
            value={streak}
            label="Day Streak"
            icon="zap"
            color={colors.warning}
            subtitle={streak > 0 ? 'Keep going!' : undefined}
          />
          <StatsCard
            value={totalSessions}
            label="Games Played"
            icon="play-circle"
            color={colors.success}
          />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: 22 }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Level Progress</Text>
            <Text style={[styles.levelBadgeText, { color: colors.primary }]}>
              Level {profile.currentLevel}
            </Text>
          </View>
          <View style={[styles.xpTrack, { backgroundColor: colors.muted }]}>
            <View
              style={[
                styles.xpFill,
                { width: `${xpPercent}%` as any, backgroundColor: colors.primary },
              ]}
            />
          </View>
          <Text style={[styles.xpText, { color: colors.mutedForeground }]}>
            {profile.totalXP} XP · {xpToNextLevel} XP to Level {profile.currentLevel + 1}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: 22 }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Weekly Accuracy</Text>
          <WeeklyChart sessions={weeklySessions} />
        </View>

        {typeInfo && (
          <View style={[styles.card, { backgroundColor: colors.card, borderRadius: 22 }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Learning Profile</Text>
            <View style={styles.profileRow}>
              <View style={[styles.profileBadge, { backgroundColor: `${typeInfo.color}18` }]}>
                <Feather name="book" size={16} color={typeInfo.color} />
                <Text style={[styles.profileBadgeText, { color: typeInfo.color }]}>
                  {typeInfo.label} Dyslexia
                </Text>
              </View>
              <View style={[styles.profileBadge, { backgroundColor: `${levelInfo.color}18` }]}>
                <Feather name="bar-chart-2" size={16} color={levelInfo.color} />
                <Text style={[styles.profileBadgeText, { color: levelInfo.color }]}>
                  {levelInfo.label}
                </Text>
              </View>
            </View>
            <Text style={[styles.profileDesc, { color: colors.mutedForeground }]}>
              {typeInfo.description}
            </Text>
          </View>
        )}

        {weeklySessions.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderRadius: 22 }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>This Week</Text>
            <View style={styles.summaryRows}>
              <SummaryRow
                icon="check-circle"
                label="Games completed"
                value={`${weeklySessions.length}`}
                color={colors.success}
                colors={colors}
              />
              <SummaryRow
                icon="trending-up"
                label="Improvement"
                value={improvement >= 0 ? `+${improvement}%` : `${improvement}%`}
                color={improvement >= 0 ? colors.success : colors.destructive}
                colors={colors}
              />
              {topGame && (
                <SummaryRow
                  icon="star"
                  label="Favourite game"
                  value={topGame.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  color={colors.warning}
                  colors={colors}
                />
              )}
            </View>
          </View>
        )}

        {totalSessions === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: colors.muted, borderRadius: 20 }]}>
            <Feather name="bar-chart-2" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No data yet</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Play some games to see your progress here!
            </Text>
            <Pressable
              onPress={() => router.push('/(tabs)/games')}
              style={[styles.emptyBtn, { backgroundColor: colors.primary, borderRadius: 14 }]}
            >
              <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>Play Now</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function SummaryRow({
  icon, label, value, color, colors,
}: {
  icon: string; label: string; value: string; color: string;
  colors: any;
}) {
  return (
    <View style={rowStyles.row}>
      <View style={[rowStyles.iconBox, { backgroundColor: `${color}18` }]}>
        <Feather name={icon as any} size={16} color={color} />
      </View>
      <Text style={[rowStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[rowStyles.value, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  value: { fontSize: 15, fontFamily: 'Inter_700Bold' },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 16 },
  pageTitle: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  statsRow: { flexDirection: 'row', gap: 10 },
  card: {
    padding: 20, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  levelBadgeText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  xpTrack: { height: 10, borderRadius: 5, overflow: 'hidden' },
  xpFill: { height: 10, borderRadius: 5 },
  xpText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  profileRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  profileBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  profileBadgeText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  profileDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  summaryRows: { gap: 12 },
  emptyCard: {
    padding: 32, alignItems: 'center', gap: 12,
  },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  emptySub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  emptyBtn: { paddingVertical: 12, paddingHorizontal: 24, marginTop: 8 },
  emptyBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
});
