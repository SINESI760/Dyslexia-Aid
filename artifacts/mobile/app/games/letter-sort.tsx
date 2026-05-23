import React, { useState, useCallback } from 'react';
import {
  Pressable, StyleSheet, Text, View, Platform, ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { WORDS_BY_LEVEL } from '@/constants/games';
import * as Haptics from 'expo-haptics';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface LetterTile {
  id: string;
  letter: string;
  used: boolean;
}

export default function LetterSortScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ gameId: string; level: string }>();
  const level = Math.min(5, Math.max(1, parseInt(params.level ?? '1')));
  const gameId = params.gameId ?? 'letter-sort-default';
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const wordPool = WORDS_BY_LEVEL[level] ?? WORDS_BY_LEVEL[1];
  const wordsToPlay = shuffle(wordPool).slice(0, 3);

  const [wordIdx, setWordIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [startTime] = useState(Date.now());
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  const currentWord = wordsToPlay[wordIdx];

  const makeTiles = (word: string): LetterTile[] =>
    shuffle(word.split('')).map((l, i) => ({
      id: `${i}-${l}-${Date.now()}`,
      letter: l,
      used: false,
    }));

  const [tiles, setTiles] = useState<LetterTile[]>(() => makeTiles(currentWord));
  const [userAnswer, setUserAnswer] = useState<string[]>([]);

  const nextWord = useCallback((inc: number) => {
    const next = wordIdx + 1;
    if (next >= wordsToPlay.length) {
      const timeSpent = Math.round((Date.now() - startTime) / 1000);
      const accuracy = Math.round(((correct + inc) / wordsToPlay.length) * 100);
      const finalScore = score + inc * 30;
      const xpEarned = Math.round(finalScore / 5) + 10;
      setTimeout(() => {
        router.replace(
          `/games/complete?gameId=${gameId}&gameType=letter-sort&score=${finalScore}&accuracy=${accuracy}&timeSpent=${timeSpent}&level=${level}&xpEarned=${xpEarned}`
        );
      }, 800);
    } else {
      setTimeout(() => {
        setWordIdx(next);
        setTiles(makeTiles(wordsToPlay[next]));
        setUserAnswer([]);
        setFeedback(null);
      }, 800);
    }
  }, [wordIdx, wordsToPlay, correct, score, startTime, gameId, level]);

  const tapTile = (tile: LetterTile) => {
    if (tile.used || feedback) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newAnswer = [...userAnswer, tile.letter];
    setUserAnswer(newAnswer);
    setTiles((prev) => prev.map((t) => t.id === tile.id ? { ...t, used: true } : t));

    if (newAnswer.length === currentWord.length) {
      const formed = newAnswer.join('');
      if (formed === currentWord) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setFeedback('correct');
        setScore((s) => s + 30);
        setCorrect((c) => c + 1);
        nextWord(1);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setFeedback('wrong');
        setTimeout(() => {
          setTiles(makeTiles(currentWord));
          setUserAnswer([]);
          setFeedback(null);
        }, 1000);
      }
    }
  };

  const clearAnswer = () => {
    setTiles(makeTiles(currentWord));
    setUserAnswer([]);
    setFeedback(null);
  };

  const feedbackColor =
    feedback === 'correct' ? colors.success :
    feedback === 'wrong' ? colors.destructive :
    colors.border;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Feather name="x" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Letter Sort</Text>
        <View style={[styles.badge, { backgroundColor: colors.muted }]}>
          <Text style={[styles.badgeText, { color: colors.foreground }]}>
            {wordIdx + 1}/{wordsToPlay.length}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 20 }]}>
        <View style={[styles.wordBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.wordHint, { color: colors.mutedForeground }]}>
            Arrange letters to spell:
          </Text>
          <Text style={[styles.wordDots, { color: colors.muted }]}>
            {Array.from({ length: currentWord.length }).map(() => '_ ').join('').trim()}
          </Text>
          <Text style={[styles.wordLength, { color: colors.mutedForeground }]}>
            {currentWord.length} letters
          </Text>
        </View>

        <View style={[styles.answerArea, { borderColor: feedbackColor }]}>
          {userAnswer.map((l, i) => (
            <View key={i} style={[styles.answerTile, { backgroundColor: feedbackColor === colors.border ? colors.primary : feedbackColor }]}>
              <Text style={[styles.tileLetter, { color: '#fff' }]}>{l}</Text>
            </View>
          ))}
          {Array.from({ length: currentWord.length - userAnswer.length }).map((_, i) => (
            <View key={`empty-${i}`} style={[styles.emptySlot, { borderColor: colors.border }]}>
            </View>
          ))}
        </View>

        {feedback && (
          <View style={styles.feedbackRow}>
            <Feather
              name={feedback === 'correct' ? 'check-circle' : 'x-circle'}
              size={20}
              color={feedback === 'correct' ? colors.success : colors.destructive}
            />
            <Text style={[styles.feedbackText, { color: feedback === 'correct' ? colors.success : colors.destructive }]}>
              {feedback === 'correct' ? 'Correct!' : `Try again! The word is: ${currentWord}`}
            </Text>
          </View>
        )}

        <View style={styles.tilePool}>
          {tiles.map((tile) => (
            <Pressable
              key={tile.id}
              onPress={() => tapTile(tile)}
              style={({ pressed }) => [
                styles.tile,
                {
                  backgroundColor: tile.used ? colors.muted : colors.card,
                  borderColor: tile.used ? colors.muted : colors.primary,
                  opacity: tile.used ? 0.4 : pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={[styles.tileLetter, { color: tile.used ? colors.mutedForeground : colors.primary }]}>
                {tile.letter}
              </Text>
            </Pressable>
          ))}
        </View>

        {userAnswer.length > 0 && !feedback && (
          <Pressable onPress={clearAnswer} style={styles.clearBtn}>
            <Feather name="refresh-ccw" size={16} color={colors.mutedForeground} />
            <Text style={[styles.clearText, { color: colors.mutedForeground }]}>Clear</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingVertical: 12, justifyContent: 'space-between',
  },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  content: { padding: 24, gap: 24, alignItems: 'center' },
  wordBox: {
    width: '100%', padding: 24, borderRadius: 20, borderWidth: 1.5,
    alignItems: 'center', gap: 8,
  },
  wordHint: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  wordDots: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: 8 },
  wordLength: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  answerArea: {
    flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center',
    borderWidth: 2, borderRadius: 16, padding: 16, minHeight: 70, width: '100%',
  },
  answerTile: {
    width: 44, height: 44, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  emptySlot: {
    width: 44, height: 44, borderRadius: 10, borderWidth: 2,
    borderStyle: 'dashed',
  },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  feedbackText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  tilePool: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  tile: {
    width: 52, height: 52, borderRadius: 12, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  tileLetter: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 16,
  },
  clearText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
});
