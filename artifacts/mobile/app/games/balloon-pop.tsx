import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BALLOON_TARGETS_BY_LEVEL } from '@/constants/games';
import * as Haptics from 'expo-haptics';

const BALLOON_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#6366F1', '#EC4899', '#F97316'];
const BALLOON_H = 90;
const BALLOON_W = 72;
const STRING_H = 22;
const TOTAL_H = BALLOON_H + STRING_H;

interface Balloon {
  id: string;
  value: string;
  xPct: number;
  color: string;
  animBottom: Animated.Value;
  isTarget: boolean;
  popped: boolean;
}

let _balloonId = 0;

export default function BalloonPopScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ gameId: string; level: string }>();
  const level = Math.min(3, Math.max(1, parseInt(params.level ?? '1')));
  const gameId = params.gameId ?? 'balloon-pop-default';
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const targets = BALLOON_TARGETS_BY_LEVEL[level] ?? BALLOON_TARGETS_BY_LEVEL[1];

  const [skyHeight, setSkyHeight] = useState(0);
  const skyReady = skyHeight > 100;

  const [roundIdx, setRoundIdx] = useState(0);
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [correctPops, setCorrectPops] = useState(0);
  const [totalPops, setTotalPops] = useState(0);
  const [gameActive, setGameActive] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [startTime] = useState(Date.now());
  const [roundComplete, setRoundComplete] = useState(false);
  const [poppedFlash, setPoppedFlash] = useState<{ id: string; x: number; y: number; correct: boolean } | null>(null);

  const spawnTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameActiveRef = useRef(true);
  const correctPopsRef = useRef(0);
  const livesRef = useRef(3);
  const roundIdxRef = useRef(0);

  const currentTarget = targets[roundIdx];

  const endGame = useCallback(() => {
    gameActiveRef.current = false;
    setGameActive(false);
    setGameOver(true);
    if (spawnTimer.current) clearInterval(spawnTimer.current);
    setBalloons([]);
  }, []);

  const spawnBalloon = useCallback(() => {
    if (!gameActiveRef.current || skyHeight < 100) return;

    const round = targets[roundIdxRef.current];
    if (!round) return;

    const allValues = [round.target, ...round.distractors];
    const value = allValues[Math.floor(Math.random() * allValues.length)];
    const xPct = 5 + Math.random() * 72; // 5% to 77% to stay on screen
    const color = BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)];

    // Start below screen, animate upward past the top
    const animBottom = new Animated.Value(-TOTAL_H);
    const speed = Math.max(3000, 6500 - level * 800 - Math.random() * 1000);
    const id = `b-${++_balloonId}`;
    const isTarget = value === round.target;

    const balloon: Balloon = { id, value, xPct, color, animBottom, isTarget, popped: false };
    setBalloons((prev) => [...prev.filter((b) => !b.popped), balloon]);

    Animated.timing(animBottom, {
      toValue: skyHeight + TOTAL_H,
      duration: speed,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && isTarget && gameActiveRef.current) {
        // Missed a target — lose a life
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        livesRef.current = Math.max(0, livesRef.current - 1);
        setLives(livesRef.current);
        if (livesRef.current <= 0) endGame();
      }
      setBalloons((prev) => prev.filter((b) => b.id !== id));
    });
  }, [skyHeight, level, targets, endGame]);

  useEffect(() => {
    // Don't spawn during the "round cleared" banner or when game is over
    if (!gameActive || !skyReady || roundComplete) return;
    const interval = Math.max(700, 1400 - level * 100);
    spawnTimer.current = setInterval(spawnBalloon, interval);
    return () => { if (spawnTimer.current) clearInterval(spawnTimer.current); };
    // roundIdx in deps so a new interval starts each time the round changes
  }, [gameActive, skyReady, spawnBalloon, roundIdx, roundComplete]);

  const popBalloon = (balloon: Balloon) => {
    if (balloon.popped || !gameActiveRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    balloon.animBottom.stopAnimation();
    setBalloons((prev) => prev.map((b) => b.id === balloon.id ? { ...b, popped: true } : b));
    setTotalPops((p) => p + 1);

    if (balloon.isTarget) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setScore((s) => s + 10);
      correctPopsRef.current += 1;
      setCorrectPops(correctPopsRef.current);

      if (correctPopsRef.current >= 5) {
        const nextRound = roundIdxRef.current + 1;
        if (nextRound < targets.length) {
          if (spawnTimer.current) clearInterval(spawnTimer.current);
          setRoundComplete(true);
          setBalloons([]);
          correctPopsRef.current = 0;
          setTimeout(() => {
            setRoundComplete(false);
            roundIdxRef.current = nextRound;
            setRoundIdx(nextRound);
            setCorrectPops(0);
          }, 1200);
        } else {
          endGame();
        }
      }
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      livesRef.current = Math.max(0, livesRef.current - 1);
      setLives(livesRef.current);
      if (livesRef.current <= 0) endGame();
    }
  };

  const handleFinish = () => {
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const accuracy = totalPops > 0 ? Math.round((correctPops / totalPops) * 100) : 50;
    const xpEarned = Math.round(score / 5) + 10;
    router.replace(
      `/games/complete?gameId=${gameId}&gameType=balloon-pop&score=${score}&accuracy=${accuracy}&timeSpent=${timeSpent}&level=${level}&xpEarned=${xpEarned}`
    );
  };

  const targetProgress = Math.min(correctPops, 5);

  return (
    <View style={[styles.container, { backgroundColor: '#0f0f2e', paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => { endGame(); setTimeout(() => router.back(), 100); }} style={styles.headerBtn}>
          <Feather name="x" size={22} color="#fff" />
        </Pressable>
        <View style={styles.targetBox}>
          <Text style={styles.targetLabel}>Pop all: </Text>
          <View style={[styles.targetBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.targetText}>{currentTarget?.target}</Text>
          </View>
        </View>
        <View style={styles.lives}>
          {[0, 1, 2].map((i) => (
            <Feather key={i} name="heart" size={18} color={i < lives ? '#EF4444' : '#333'} />
          ))}
        </View>
      </View>

      {/* Progress */}
      <View style={styles.progressRow}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View
            key={i}
            style={[styles.progressDot, { backgroundColor: i < targetProgress ? '#10B981' : '#222' }]}
          />
        ))}
        <View style={styles.progressLabel}>
          <Text style={styles.progressText}>{targetProgress}/5</Text>
          <Text style={styles.scoreText}>  ⚡ {score}</Text>
        </View>
      </View>

      {/* Sky — balloons float up through here */}
      <View
        style={styles.sky}
        onLayout={(e) => setSkyHeight(e.nativeEvent.layout.height)}
      >
        {/* Stars background */}
        {[...Array(20)].map((_, i) => (
          <View
            key={i}
            style={[
              styles.star,
              {
                left: `${(i * 37 + 11) % 95}%` as any,
                top: `${(i * 53 + 7) % 90}%` as any,
                width: i % 3 === 0 ? 3 : 2,
                height: i % 3 === 0 ? 3 : 2,
              },
            ]}
          />
        ))}

        {!skyReady && (
          <View style={styles.waitMsg}>
            <Text style={styles.waitText}>Loading...</Text>
          </View>
        )}

        {balloons.filter((b) => !b.popped).map((balloon) => (
          <Animated.View
            key={balloon.id}
            style={[
              styles.balloonWrap,
              {
                left: `${balloon.xPct}%` as any,
                bottom: balloon.animBottom,
              },
            ]}
          >
            <Pressable onPress={() => popBalloon(balloon)} hitSlop={12}>
              <View style={[styles.balloon, { backgroundColor: balloon.color }]}>
                {/* Shine */}
                <View style={styles.shine} />
                <Text style={styles.balloonText}>{balloon.value}</Text>
              </View>
              {/* String */}
              <View style={[styles.string, { backgroundColor: balloon.color }]} />
              {/* Knot */}
              <View style={[styles.knot, { backgroundColor: balloon.color }]} />
            </Pressable>
          </Animated.View>
        ))}

        {roundComplete && (
          <View style={styles.roundMsg}>
            <Text style={styles.roundMsgText}>Round cleared! 🎉</Text>
          </View>
        )}
      </View>

      {/* Ground */}
      <View style={[styles.ground, { paddingBottom: botPad + 8 }]}>
        <Text style={styles.groundText}>Round {roundIdx + 1}/{targets.length}</Text>
      </View>

      {gameOver && (
        <View style={styles.overlay}>
          <View style={[styles.doneCard, { backgroundColor: colors.card }]}>
            <Feather name="award" size={44} color={colors.primary} />
            <Text style={[styles.doneTitle, { color: colors.foreground }]}>
              {score >= 30 ? 'Great job!' : 'Game Over!'}
            </Text>
            <Text style={[styles.doneScore, { color: colors.primary }]}>Score: {score}</Text>
            <Text style={[styles.doneSub, { color: colors.mutedForeground }]}>
              {correctPops} balloons popped
            </Text>
            <Pressable
              onPress={handleFinish}
              style={[styles.doneBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.doneBtnText, { color: colors.primaryForeground }]}>Continue</Text>
              <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBtn: { padding: 4 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingVertical: 12, justifyContent: 'space-between',
  },
  targetBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  targetLabel: { color: '#aaa', fontSize: 14, fontFamily: 'Inter_400Regular' },
  targetBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  targetText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  lives: { flexDirection: 'row', gap: 6 },
  progressRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingBottom: 8,
  },
  progressDot: { width: 12, height: 12, borderRadius: 6 },
  progressLabel: { flexDirection: 'row', marginLeft: 'auto' as any },
  progressText: { color: '#10B981', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  scoreText: { color: '#F59E0B', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  sky: { flex: 1, overflow: 'hidden', position: 'relative' },
  star: { position: 'absolute', backgroundColor: '#ffffff44', borderRadius: 2 },
  waitMsg: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  waitText: { color: '#666', fontSize: 14 },
  balloonWrap: { position: 'absolute', alignItems: 'center' },
  balloon: {
    width: BALLOON_W,
    height: BALLOON_H,
    borderRadius: BALLOON_W / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
  },
  shine: {
    position: 'absolute', top: 12, left: 12,
    width: 16, height: 22, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.35)',
    transform: [{ rotate: '-30deg' }],
  },
  balloonText: {
    color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold',
    textAlign: 'center', paddingHorizontal: 6,
  },
  string: { width: 2, height: STRING_H, alignSelf: 'center' },
  knot: { width: 8, height: 8, borderRadius: 4, alignSelf: 'center' },
  roundMsg: {
    position: 'absolute', top: '35%', left: 0, right: 0, alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 16,
  },
  roundMsgText: { color: '#fff', fontSize: 26, fontFamily: 'Inter_700Bold' },
  ground: {
    backgroundColor: '#1a1a3e', paddingTop: 10,
    alignItems: 'center', borderTopWidth: 1, borderTopColor: '#333',
  },
  groundText: { color: '#555', fontSize: 13, fontFamily: 'Inter_400Regular' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center',
  },
  doneCard: {
    padding: 32, alignItems: 'center', gap: 12, width: '82%',
    borderRadius: 24,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 16,
  },
  doneTitle: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  doneScore: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  doneSub: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  doneBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 36, borderRadius: 16, marginTop: 8,
  },
  doneBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});
