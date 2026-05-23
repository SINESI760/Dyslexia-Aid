import React, { useState, useCallback, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, Platform, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { WORDS_BY_LEVEL } from '@/constants/games';
import * as Haptics from 'expo-haptics';

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeScramble(word: string): string {
  if (word.length <= 1) return word;
  let s = shuffleArr(word.split('')).join('');
  let attempts = 0;
  while (s === word && attempts < 10) {
    s = shuffleArr(word.split('')).join('');
    attempts++;
  }
  return s;
}

interface LetterBtn {
  id: string;
  letter: string;
  used: boolean;
}

function makeButtons(scrambled: string): LetterBtn[] {
  return scrambled.split('').map((letter, i) => ({
    id: `${i}-${scrambled}-${Math.random()}`,
    letter,
    used: false,
  }));
}

export default function WordScrambleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ gameId: string; level: string }>();
  const level = Math.min(5, Math.max(1, parseInt(params.level ?? '1')));
  const gameId = params.gameId ?? 'word-scramble-default';
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  // Stable word list — computed once, never changes on re-render
  const [wordsToPlay] = useState<string[]>(() => {
    const pool = WORDS_BY_LEVEL[level] ?? WORDS_BY_LEVEL[1];
    return shuffleArr(pool).slice(0, 5);
  });

  const [wordIdx, setWordIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [startTime] = useState(Date.now());
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  // Stable scramble per word — stored in state, not recomputed on every render
  const [scrambled, setScrambled] = useState<string>(() => makeScramble(wordsToPlay[0]));
  const [buttons, setButtons] = useState<LetterBtn[]>(() => makeButtons(makeScramble(wordsToPlay[0])));
  const [selected, setSelected] = useState<string[]>([]);

  // Use a ref to track pending timeouts so we can clear them on fast navigation
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadWord = useCallback((idx: number) => {
    const word = wordsToPlay[idx];
    const sc = makeScramble(word);
    setScrambled(sc);
    setButtons(makeButtons(sc));
    setSelected([]);
    setFeedback(null);
    setWordIdx(idx);
  }, [wordsToPlay]);

  const finishGame = useCallback((totalCorrect: number, totalScore: number) => {
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const accuracy = Math.round((totalCorrect / wordsToPlay.length) * 100);
    const xpEarned = Math.round(totalScore / 5) + 10;
    router.replace(
      `/games/complete?gameId=${gameId}&gameType=word-scramble&score=${totalScore}&accuracy=${accuracy}&timeSpent=${timeSpent}&level=${level}&xpEarned=${xpEarned}`
    );
  }, [startTime, wordsToPlay.length, gameId, level]);

  const tapLetter = (btn: LetterBtn) => {
    if (btn.used || feedback) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const newSelected = [...selected, btn.letter];
    setSelected(newSelected);
    setButtons((prev) => prev.map((b) => b.id === btn.id ? { ...b, used: true } : b));

    const currentWord = wordsToPlay[wordIdx];

    if (newSelected.length === currentWord.length) {
      const formed = newSelected.join('');

      if (formed === currentWord) {
        // Correct!
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setFeedback('correct');
        const newScore = score + 20;
        const newCorrect = correctCount + 1;
        setScore(newScore);
        setCorrectCount(newCorrect);

        timeoutRef.current = setTimeout(() => {
          const nextIdx = wordIdx + 1;
          if (nextIdx >= wordsToPlay.length) {
            finishGame(newCorrect, newScore);
          } else {
            loadWord(nextIdx);
          }
        }, 900);
      } else {
        // Wrong — show answer, then reset
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setFeedback('wrong');

        timeoutRef.current = setTimeout(() => {
          // Keep same word but re-scramble
          const newSc = makeScramble(currentWord);
          setScrambled(newSc);
          setButtons(makeButtons(newSc));
          setSelected([]);
          setFeedback(null);
        }, 1400);
      }
    }
  };

  const resetCurrent = () => {
    if (feedback) return;
    const currentWord = wordsToPlay[wordIdx];
    const newSc = makeScramble(currentWord);
    setScrambled(newSc);
    setButtons(makeButtons(newSc));
    setSelected([]);
  };

  const skipWord = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const nextIdx = wordIdx + 1;
    if (nextIdx >= wordsToPlay.length) {
      finishGame(correctCount, score);
    } else {
      loadWord(nextIdx);
    }
  };

  const currentWord = wordsToPlay[wordIdx];

  const answerBg =
    feedback === 'correct' ? `${colors.success}22` :
    feedback === 'wrong' ? `${colors.destructive}22` :
    colors.muted;

  const answerBorder =
    feedback === 'correct' ? colors.success :
    feedback === 'wrong' ? colors.destructive :
    colors.border;

  // Progress dots
  const progressDots = wordsToPlay.map((_, i) => {
    if (i < wordIdx) return 'done';
    if (i === wordIdx) return 'current';
    return 'pending';
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="x" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Word Scramble</Text>
        <View style={[styles.badge, { backgroundColor: colors.muted }]}>
          <Text style={[styles.badgeText, { color: colors.foreground }]}>
            {wordIdx + 1}/{wordsToPlay.length}
          </Text>
        </View>
      </View>

      {/* Progress dots */}
      <View style={styles.progressRow}>
        {progressDots.map((state, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor:
                  state === 'done' ? colors.success :
                  state === 'current' ? colors.primary :
                  colors.muted,
                width: state === 'current' ? 20 : 10,
              },
            ]}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Instruction */}
        <View style={[styles.infoBox, { backgroundColor: colors.muted }]}>
          <Feather name="shuffle" size={14} color={colors.mutedForeground} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Tap the letters below in the correct order
          </Text>
        </View>

        {/* Scrambled word display */}
        <View style={[styles.scrambledCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.scrambledLabel, { color: colors.mutedForeground }]}>
            Unscramble this word:
          </Text>
          <View style={styles.scrambledLetters}>
            {scrambled.split('').map((letter, i) => (
              <View
                key={i}
                style={[styles.scrambledTile, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}40` }]}
              >
                <Text style={[styles.scrambledTileLetter, { color: colors.primary }]}>{letter}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Answer area */}
        <View style={[styles.answerBox, { backgroundColor: answerBg, borderColor: answerBorder }]}>
          <View style={styles.answerSlots}>
            {Array.from({ length: currentWord.length }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.answerSlot,
                  {
                    borderColor: i < selected.length
                      ? feedback === 'correct' ? colors.success
                        : feedback === 'wrong' ? colors.destructive
                        : colors.primary
                      : colors.border,
                    backgroundColor: i < selected.length
                      ? feedback === 'correct' ? `${colors.success}18`
                        : feedback === 'wrong' ? `${colors.destructive}18`
                        : `${colors.primary}10`
                      : colors.background,
                  },
                ]}
              >
                <Text style={[
                  styles.answerSlotText,
                  {
                    color: feedback === 'correct' ? colors.success
                      : feedback === 'wrong' ? colors.destructive
                      : colors.foreground,
                  },
                ]}>
                  {selected[i] ?? ''}
                </Text>
              </View>
            ))}
          </View>
          {feedback && (
            <Feather
              name={feedback === 'correct' ? 'check-circle' : 'x-circle'}
              size={24}
              color={feedback === 'correct' ? colors.success : colors.destructive}
              style={{ marginTop: 8 }}
            />
          )}
        </View>

        {/* Feedback hint */}
        {feedback === 'wrong' && (
          <View style={[styles.hintBox, { backgroundColor: `${colors.destructive}12` }]}>
            <Feather name="info" size={14} color={colors.destructive} />
            <Text style={[styles.hintText, { color: colors.destructive }]}>
              The correct word is: <Text style={{ fontFamily: 'Inter_700Bold' }}>{currentWord}</Text>
            </Text>
          </View>
        )}
        {feedback === 'correct' && (
          <View style={[styles.hintBox, { backgroundColor: `${colors.success}12` }]}>
            <Feather name="star" size={14} color={colors.success} />
            <Text style={[styles.hintText, { color: colors.success }]}>
              Correct! +20 points
            </Text>
          </View>
        )}

        {/* Letter buttons */}
        <View style={styles.letterPool}>
          {buttons.map((btn) => (
            <Pressable
              key={btn.id}
              onPress={() => tapLetter(btn)}
              disabled={btn.used || !!feedback}
              style={({ pressed }) => [
                styles.letterBtn,
                {
                  backgroundColor: btn.used ? colors.muted : colors.card,
                  borderColor: btn.used ? colors.muted : colors.primary,
                  opacity: btn.used ? 0.3 : pressed ? 0.75 : 1,
                  transform: [{ scale: pressed && !btn.used ? 0.93 : 1 }],
                },
              ]}
            >
              <Text style={[
                styles.letterBtnText,
                { color: btn.used ? colors.mutedForeground : colors.primary },
              ]}>
                {btn.letter}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Action row */}
        <View style={styles.actionRow}>
          {!feedback && selected.length > 0 && (
            <Pressable onPress={resetCurrent} style={[styles.actionBtn, { borderColor: colors.border }]}>
              <Feather name="refresh-ccw" size={15} color={colors.mutedForeground} />
              <Text style={[styles.actionBtnText, { color: colors.mutedForeground }]}>Reset</Text>
            </Pressable>
          )}
          {!feedback && (
            <Pressable onPress={skipWord} style={[styles.actionBtn, { borderColor: colors.border }]}>
              <Feather name="skip-forward" size={15} color={colors.mutedForeground} />
              <Text style={[styles.actionBtnText, { color: colors.mutedForeground }]}>Skip</Text>
            </Pressable>
          )}
        </View>

        {/* Score */}
        <View style={styles.scoreRow}>
          <Feather name="zap" size={16} color={colors.warning} />
          <Text style={[styles.scoreText, { color: colors.foreground }]}>Score: {score}</Text>
          <Text style={[styles.correctText, { color: colors.success }]}>
            {correctCount}/{wordIdx + (feedback === 'correct' ? 1 : 0)} correct
          </Text>
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
  headerBtn: { padding: 4 },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  progressRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8,
  },
  dot: { height: 8, borderRadius: 4 },
  content: { padding: 24, gap: 18, alignItems: 'center' },
  infoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderRadius: 12, width: '100%', justifyContent: 'center',
  },
  infoText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  scrambledCard: {
    width: '100%', padding: 20, borderRadius: 20, alignItems: 'center', gap: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  scrambledLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  scrambledLetters: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  scrambledTile: {
    width: 44, height: 48, borderRadius: 10, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  scrambledTileLetter: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  answerBox: {
    width: '100%', borderRadius: 16, borderWidth: 2,
    padding: 16, alignItems: 'center', gap: 4, minHeight: 80,
  },
  answerSlots: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  answerSlot: {
    width: 40, height: 44, borderRadius: 10, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  answerSlotText: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  hintBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, width: '100%',
  },
  hintText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  letterPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  letterBtn: {
    width: 52, height: 52, borderRadius: 12, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  letterBtnText: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  actionRow: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1,
  },
  actionBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scoreText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  correctText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
});
