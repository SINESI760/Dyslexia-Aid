import React, { useState, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View, Platform, ScrollView } from 'react-native';
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

function scramble(word: string): string {
  let s = shuffle(word.split('')).join('');
  while (s === word && word.length > 1) s = shuffle(word.split('')).join('');
  return s;
}

interface LetterBtn {
  id: string;
  letter: string;
  used: boolean;
}

export default function WordScrambleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ gameId: string; level: string }>();
  const level = Math.min(5, Math.max(1, parseInt(params.level ?? '1')));
  const gameId = params.gameId ?? 'word-scramble-default';
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const wordPool = WORDS_BY_LEVEL[level] ?? WORDS_BY_LEVEL[1];
  const wordsToPlay = shuffle(wordPool).slice(0, 5);

  const [wordIdx, setWordIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [startTime] = useState(Date.now());
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  const currentWord = wordsToPlay[wordIdx];
  const scrambled = scramble(currentWord);

  const makeButtons = (word: string): LetterBtn[] =>
    word.split('').map((l, i) => ({ id: `${i}-${Date.now()}`, letter: l, used: false }));

  const [buttons, setButtons] = useState<LetterBtn[]>(() => makeButtons(scrambled));
  const [selected, setSelected] = useState<string[]>([]);

  const goNext = useCallback((incCorrect: number, incScore: number) => {
    const next = wordIdx + 1;
    if (next >= wordsToPlay.length) {
      const timeSpent = Math.round((Date.now() - startTime) / 1000);
      const totalCorrect = correct + incCorrect;
      const accuracy = Math.round((totalCorrect / wordsToPlay.length) * 100);
      const finalScore = score + incScore;
      const xpEarned = Math.round(finalScore / 5) + 10;
      setTimeout(() => {
        router.replace(
          `/games/complete?gameId=${gameId}&gameType=word-scramble&score=${finalScore}&accuracy=${accuracy}&timeSpent=${timeSpent}&level=${level}&xpEarned=${xpEarned}`
        );
      }, 800);
    } else {
      setTimeout(() => {
        const nextWord = wordsToPlay[next];
        setWordIdx(next);
        setButtons(makeButtons(scramble(nextWord)));
        setSelected([]);
        setFeedback(null);
      }, 900);
    }
  }, [wordIdx, wordsToPlay, correct, score, startTime, gameId, level]);

  const tapButton = (btn: LetterBtn) => {
    if (btn.used || feedback) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newSelected = [...selected, btn.letter];
    setSelected(newSelected);
    setButtons((prev) => prev.map((b) => b.id === btn.id ? { ...b, used: true } : b));

    if (newSelected.length === currentWord.length) {
      const formed = newSelected.join('');
      if (formed === currentWord) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setFeedback('correct');
        setScore((s) => s + 20);
        setCorrect((c) => c + 1);
        goNext(1, 20);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setFeedback('wrong');
        setTimeout(() => {
          setButtons(makeButtons(scramble(currentWord)));
          setSelected([]);
          setFeedback(null);
        }, 1200);
      }
    }
  };

  const clearSelected = () => {
    setButtons(makeButtons(scramble(currentWord)));
    setSelected([]);
    setFeedback(null);
  };

  const feedbackBg =
    feedback === 'correct' ? `${colors.success}22` :
    feedback === 'wrong' ? `${colors.destructive}22` :
    colors.muted;

  const feedbackBorder =
    feedback === 'correct' ? colors.success :
    feedback === 'wrong' ? colors.destructive :
    colors.border;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Feather name="x" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Word Scramble</Text>
        <View style={[styles.badge, { backgroundColor: colors.muted }]}>
          <Text style={[styles.badgeText, { color: colors.foreground }]}>
            {wordIdx + 1}/{wordsToPlay.length}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 20 }]}>
        <View style={[styles.infoBox, { backgroundColor: colors.muted, borderRadius: 14 }]}>
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Tap the letters in the correct order to spell the word
          </Text>
        </View>

        <View style={[styles.scrambledDisplay, { backgroundColor: colors.card, borderRadius: 20 }]}>
          <Text style={[styles.scrambledLabel, { color: colors.mutedForeground }]}>Scrambled word:</Text>
          <Text style={[styles.scrambledWord, { color: colors.primary }]}>{scrambled}</Text>
        </View>

        <View style={[styles.answerBox, { backgroundColor: feedbackBg, borderColor: feedbackBorder }]}>
          {selected.length === 0 ? (
            <Text style={[styles.answerPlaceholder, { color: colors.mutedForeground }]}>
              Tap letters below...
            </Text>
          ) : (
            <Text style={[styles.answerWord, { color: colors.foreground }]}>
              {selected.join('')}
            </Text>
          )}
          {feedback && (
            <Feather
              name={feedback === 'correct' ? 'check-circle' : 'x-circle'}
              size={22}
              color={feedback === 'correct' ? colors.success : colors.destructive}
            />
          )}
        </View>

        {feedback === 'wrong' && (
          <Text style={[styles.hint, { color: colors.destructive }]}>
            The word is: {currentWord}
          </Text>
        )}

        <View style={styles.letterPool}>
          {buttons.map((btn) => (
            <Pressable
              key={btn.id}
              onPress={() => tapButton(btn)}
              style={({ pressed }) => [
                styles.letterBtn,
                {
                  backgroundColor: btn.used ? colors.muted : colors.card,
                  borderColor: btn.used ? colors.muted : colors.primary,
                  opacity: btn.used ? 0.35 : pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={[styles.letterBtnText, { color: btn.used ? colors.mutedForeground : colors.primary }]}>
                {btn.letter}
              </Text>
            </Pressable>
          ))}
        </View>

        {selected.length > 0 && !feedback && (
          <Pressable onPress={clearSelected} style={styles.clearBtn}>
            <Feather name="refresh-ccw" size={16} color={colors.mutedForeground} />
            <Text style={[styles.clearText, { color: colors.mutedForeground }]}>Clear</Text>
          </Pressable>
        )}

        <View style={styles.scoreRow}>
          <Feather name="zap" size={16} color={colors.warning} />
          <Text style={[styles.scoreText, { color: colors.foreground }]}>Score: {score}</Text>
        </View>
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
  content: { padding: 24, gap: 20, alignItems: 'center' },
  infoBox: { padding: 12, width: '100%', alignItems: 'center' },
  infoText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  scrambledDisplay: {
    width: '100%', padding: 24, alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  scrambledLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  scrambledWord: { fontSize: 36, fontFamily: 'Inter_700Bold', letterSpacing: 4 },
  answerBox: {
    width: '100%', minHeight: 64, borderRadius: 16, borderWidth: 2,
    padding: 16, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  answerPlaceholder: { fontSize: 16, fontFamily: 'Inter_400Regular' },
  answerWord: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  hint: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  letterPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  letterBtn: {
    width: 54, height: 54, borderRadius: 12, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  letterBtnText: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 16,
  },
  clearText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scoreText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
