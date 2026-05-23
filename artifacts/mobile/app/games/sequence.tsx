import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';

const TILE_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const TILE_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#6366F1', '#EC4899', '#F97316'];

function getSequence(length: number): number[] {
  return Array.from({ length }, () => Math.floor(Math.random() * TILE_LETTERS.length));
}

type GamePhase = 'intro' | 'show' | 'input' | 'feedback' | 'done';

export default function SequenceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ gameId: string; level: string }>();
  const level = Math.min(5, Math.max(1, parseInt(params.level ?? '1')));
  const gameId = params.gameId ?? 'sequence-default';
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const seqLength = Math.min(3 + level, 7);
  const totalRounds = 5;

  const [round, setRound] = useState(0);
  const [sequence, setSequence] = useState<number[]>([]);
  const [userSeq, setUserSeq] = useState<number[]>([]);
  const [phase, setPhase] = useState<GamePhase>('intro');
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [score, setScore] = useState(0);
  const [startTime] = useState(Date.now());
  const [flashResult, setFlashResult] = useState<boolean | null>(null);

  const tileAnims = useRef(TILE_LETTERS.map(() => new Animated.Value(1))).current;

  const flashTile = useCallback((tileIdx: number) => {
    Animated.sequence([
      Animated.timing(tileAnims[tileIdx], { toValue: 1.2, duration: 200, useNativeDriver: false }),
      Animated.timing(tileAnims[tileIdx], { toValue: 1, duration: 200, useNativeDriver: false }),
    ]).start();
  }, [tileAnims]);

  const playSequence = useCallback((seq: number[]) => {
    setPhase('show');
    setActiveIdx(null);
    let delay = 400;
    seq.forEach((tileIdx, i) => {
      setTimeout(() => {
        setActiveIdx(tileIdx);
        flashTile(tileIdx);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTimeout(() => setActiveIdx(null), 350);
      }, delay);
      delay += 700;
    });
    setTimeout(() => {
      setPhase('input');
      setUserSeq([]);
    }, delay + 200);
  }, [flashTile]);

  const startRound = useCallback((r: number) => {
    const seq = getSequence(seqLength + Math.floor(r / 2));
    setSequence(seq);
    setUserSeq([]);
    setTimeout(() => playSequence(seq), 600);
  }, [seqLength, playSequence]);

  useEffect(() => {
    if (phase === 'intro') return;
    startRound(round);
  }, [round]);

  const handleTileTap = (tileIdx: number) => {
    if (phase !== 'input') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    flashTile(tileIdx);
    const newUserSeq = [...userSeq, tileIdx];
    setUserSeq(newUserSeq);

    const expected = sequence[newUserSeq.length - 1];
    if (tileIdx !== expected) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFlashResult(false);
      setPhase('feedback');
      setTimeout(() => {
        setFlashResult(null);
        if (round + 1 >= totalRounds) finishGame(correct, score);
        else {
          setRound((r) => r + 1);
        }
      }, 1000);
      return;
    }

    if (newUserSeq.length === sequence.length) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const pts = 20 + sequence.length * 5;
      setScore((s) => s + pts);
      setCorrect((c) => c + 1);
      setFlashResult(true);
      setPhase('feedback');
      setTimeout(() => {
        setFlashResult(null);
        if (round + 1 >= totalRounds) finishGame(correct + 1, score + pts);
        else setRound((r) => r + 1);
      }, 1000);
    }
  };

  const finishGame = (totalCorrect: number, finalScore: number) => {
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const accuracy = Math.round((totalCorrect / totalRounds) * 100);
    const xpEarned = Math.round(finalScore / 5) + 10;
    setPhase('done');
    setTimeout(() => {
      router.replace(
        `/games/complete?gameId=${gameId}&gameType=sequence&score=${finalScore}&accuracy=${accuracy}&timeSpent=${timeSpent}&level=${level}&xpEarned=${xpEarned}`
      );
    }, 500);
  };

  const getPhaseLabel = () => {
    switch (phase) {
      case 'intro': return 'Get ready!';
      case 'show': return 'Watch the sequence...';
      case 'input': return 'Repeat the sequence!';
      case 'feedback': return flashResult ? 'Correct!' : 'Wrong! Try next...';
      case 'done': return 'Calculating...';
    }
  };

  const phaseLabelColor =
    phase === 'feedback'
      ? flashResult ? colors.success : colors.destructive
      : colors.primary;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Feather name="x" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Memory Sequence</Text>
        <View style={[styles.badge, { backgroundColor: colors.muted }]}>
          <Text style={[styles.badgeText, { color: colors.foreground }]}>
            {round + 1}/{totalRounds}
          </Text>
        </View>
      </View>

      <View style={[styles.content, { paddingBottom: botPad + 20 }]}>
        <Text style={[styles.phaseLabel, { color: phaseLabelColor }]}>{getPhaseLabel()}</Text>

        <View style={styles.seqTrack}>
          {sequence.map((tileIdx, i) => {
            const revealed = phase === 'show';
            const correct = i < userSeq.length;
            return (
              <View
                key={i}
                style={[
                  styles.seqDot,
                  {
                    backgroundColor: correct
                      ? colors.success
                      : revealed && activeIdx !== null
                        ? colors.muted : colors.muted,
                  },
                ]}
              />
            );
          })}
        </View>

        <View style={styles.tilesGrid}>
          {TILE_LETTERS.map((letter, i) => {
            const isActive = activeIdx === i;
            const isUserInput = phase === 'input' || phase === 'feedback';
            return (
              <Animated.View
                key={i}
                style={{ transform: [{ scale: tileAnims[i] }] }}
              >
                <Pressable
                  onPress={() => isUserInput && handleTileTap(i)}
                  style={[
                    styles.tile,
                    {
                      backgroundColor: isActive ? TILE_COLORS[i] : `${TILE_COLORS[i]}44`,
                      borderColor: TILE_COLORS[i],
                      borderWidth: isActive ? 3 : 1.5,
                    },
                  ]}
                >
                  <Text style={[styles.tileLetter, { color: isActive ? '#fff' : TILE_COLORS[i] }]}>
                    {letter}
                  </Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        <View style={[styles.userSeqDisplay, { backgroundColor: colors.muted, borderRadius: 14 }]}>
          <Text style={[styles.userSeqLabel, { color: colors.mutedForeground }]}>Your answer:</Text>
          <View style={styles.userSeqRow}>
            {userSeq.map((tileIdx, i) => (
              <View key={i} style={[styles.userDot, { backgroundColor: TILE_COLORS[tileIdx] }]}>
                <Text style={styles.userDotText}>{TILE_LETTERS[tileIdx]}</Text>
              </View>
            ))}
            {sequence.length > userSeq.length && phase === 'input' && (
              <View style={[styles.userDot, { backgroundColor: colors.border }]}>
                <Text style={[styles.userDotText, { color: colors.mutedForeground }]}>?</Text>
              </View>
            )}
          </View>
        </View>

        {phase === 'intro' && (
          <Pressable
            onPress={() => startRound(0)}
            style={({ pressed }) => [styles.startBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[styles.startBtnText, { color: colors.primaryForeground }]}>Start</Text>
            <Feather name="play" size={18} color={colors.primaryForeground} />
          </Pressable>
        )}

        <View style={styles.scoreRow}>
          <Feather name="star" size={16} color={colors.warning} />
          <Text style={[styles.scoreText, { color: colors.foreground }]}>Score: {score}</Text>
          <Text style={[styles.correctText, { color: colors.success }]}>
            {correct}/{totalRounds} correct
          </Text>
        </View>
      </View>
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
  content: { flex: 1, padding: 24, alignItems: 'center', gap: 28, justifyContent: 'center' },
  phaseLabel: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  seqTrack: { flexDirection: 'row', gap: 8 },
  seqDot: { width: 10, height: 10, borderRadius: 5 },
  tilesGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 16,
    justifyContent: 'center', maxWidth: 280,
  },
  tile: {
    width: 80, height: 80, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  tileLetter: { fontSize: 32, fontFamily: 'Inter_700Bold' },
  userSeqDisplay: {
    width: '100%', padding: 16, alignItems: 'center', gap: 8,
  },
  userSeqLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  userSeqRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  userDot: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  userDotText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 16, paddingHorizontal: 40, borderRadius: 16,
  },
  startBtnText: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scoreText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  correctText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
});
