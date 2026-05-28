import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useUser } from '@/context/UserContext';
import { useGame } from '@/context/GameContext';
import { GameCard } from '@/components/GameCard';
import { GAME_INFO, GAME_ROTATIONS } from '@/constants/games';
import * as Haptics from 'expo-haptics';

export default function GamesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useUser();
  const { dailyProgress, initializeDailyGames } = useGame();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const games = dailyProgress?.games ?? [];
  const completedCount = dailyProgress?.completedCount ?? 0;
  const nextGameIdx = games.findIndex((g) => !g.completed);

  const handlePlay = (gameId: string, gameType: string, level: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/games/${gameType}?gameId=${gameId}&level=${level}`);
  };

  const allDone = completedCount >= games.length && games.length > 0;

  // Sort All Games by relevance to the user's dyslexia type
  const typeRotation = GAME_ROTATIONS[profile?.dyslexiaType ?? 'default'] || GAME_ROTATIONS.default;
  const gameLibrary = Object.entries(GAME_INFO).sort(([a], [b]) => {
    const ai = typeRotation.indexOf(a);
    const bi = typeRotation.indexOf(b);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 8, paddingBottom: botPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>Today's Games</Text>
        <Text style={[styles.pageSub, { color: colors.mutedForeground }]}>
          {completedCount}/{games.length} complete
        </Text>

        {games.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderRadius: 20 }]}>
            <Feather name="calendar" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No games yet</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Complete your assessment to get your personalized daily games
            </Text>
            <Pressable
              onPress={() => router.push('/games/assessment')}
              style={[styles.emptyBtn, { backgroundColor: colors.primary, borderRadius: 14 }]}
            >
              <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>Take Assessment</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.gameList}>
            {games.map((game, idx) => (
              <GameCard
                key={game.id}
                game={game}
                index={idx}
                isNext={idx === nextGameIdx}
                onPress={() => handlePlay(game.id, game.gameType, game.level)}
              />
            ))}
          </View>
        )}

        {allDone && (
          <View style={[styles.allDoneBanner, { backgroundColor: `${colors.success}15`, borderRadius: 18, borderColor: colors.success, borderWidth: 1 }]}>
            <Feather name="award" size={24} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.allDoneTitle, { color: colors.success }]}>Daily goal complete!</Text>
              <Text style={[styles.allDoneSub, { color: colors.mutedForeground }]}>
                See your progress in the Progress tab
              </Text>
            </View>
          </View>
        )}

        <View style={styles.divider}>
          <View style={[styles.divLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.divText, { color: colors.mutedForeground }]}>All Games</Text>
          <View style={[styles.divLine, { backgroundColor: colors.border }]} />
        </View>

        <View style={styles.libraryGrid}>
          {gameLibrary.map(([key, info]) => (
            <Pressable
              key={key}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/games/${key}?gameId=free-play-${Date.now()}&level=${profile?.currentLevel ?? 1}`);
              }}
              style={({ pressed }) => [
                styles.libraryCard,
                {
                  backgroundColor: colors.card,
                  borderRadius: 18,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={[styles.libIcon, { backgroundColor: `${info.color}18` }]}>
                <Feather name={info.icon as any} size={22} color={info.color} />
              </View>
              <Text style={[styles.libTitle, { color: colors.foreground }]}>{info.title}</Text>
              <Text style={[styles.libBenefit, { color: colors.mutedForeground }]}>{info.benefit}</Text>
              <View style={[styles.libPlayBtn, { backgroundColor: info.color }]}>
                <Feather name="play" size={12} color="#fff" />
                <Text style={styles.libPlayText}>Free Play</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 16 },
  pageTitle: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  pageSub: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: -8 },
  emptyCard: {
    padding: 32, alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, elevation: 3,
  },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  emptySub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  emptyBtn: { paddingVertical: 12, paddingHorizontal: 24, marginTop: 8 },
  emptyBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  gameList: { gap: 0 },
  allDoneBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
  },
  allDoneTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  allDoneSub: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  divLine: { flex: 1, height: 1 },
  divText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  libraryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  libraryCard: {
    width: '47%', padding: 16, gap: 8, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  libIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  libTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  libBenefit: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  libPlayBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20,
    alignSelf: 'flex-start', marginTop: 4,
  },
  libPlayText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
});
