import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Animated, Pressable, StyleSheet, Text, View, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BALLOON_TARGETS_BY_LEVEL } from '@/constants/games';
import * as Haptics from 'expo-haptics';

const BALLOON_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#6366F1', '#EC4899', '#F97316'];

interface Balloon {
  id: string;
  value: string;
  x: number;
  color: string;
  animY: Animated.Value;
  isTarget: boolean;
  popped: boolean;
}

let balloonIdCounter = 0;

export default function BalloonPopScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ gameId: string; level: string }>();
  const level = Math.min(3, Math.max(1, parseInt(params.level ?? '1')));
  const gameId = params.gameId ?? 'balloon-pop-default';
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const targets = BALLOON_TARGETS_BY_LEVEL[level] ?? BALLOON_TARGETS_BY_LEVEL[1];
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

  const spawnTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const screenHeight = 600;

  const currentTarget = targets[roundIdx];

  const spawnBalloon = useCallback(() => {
    if (!gameActive) return;
    const allValues = [currentTarget.target, ...currentTarget.distractors];
    const value = allValues[Math.floor(Math.random() * allValues.length)];
    const x = 20 + Math.random() * 60;
    const color = BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)];
    const animY = new Animated.Value(screenHeight);
    const speed = Math.max(2500, 5000 - level * 600 - Math.random() * 1000);
    const id = `balloon-${++balloonIdCounter}`;
    const isTarget = value === currentTarget.target;

    const balloon: Balloon = { id, value, x, color, animY, isTarget, popped: false };

    setBalloons((prev) => [...prev.filter((b) => !b.popped), balloon]);

    Animated.timing(animY, {
      toValue: -120, duration: speed, useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        setBalloons((prev) => prev.filter((b) => b.id !== id));
        if (isTarget) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setLives((l) => {
            const newLives = l - 1;
            if (newLives <= 0) endGame();
            return Math.max(0, newLives);
          });
        }
      }
    });
  }, [gameActive, currentTarget, level]);

  useEffect(() => {
    if (!gameActive) return;
    spawnTimer.current = setInterval(spawnBalloon, Math.max(800, 1500 - level * 100));
    return () => {
      if (spawnTimer.current) clearInterval(spawnTimer.current);
    };
  }, [gameActive, spawnBalloon, roundIdx]);

  const popBalloon = (balloon: Balloon) => {
    if (balloon.popped || !gameActive) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setBalloons((prev) => prev.map((b) => b.id === balloon.id ? { ...b, popped: true } : b));
    setTotalPops((p) => p + 1);

    if (balloon.isTarget) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setScore((s) => s + 10);
      setCorrectPops((p) => p + 1);

      const newCorrect = correctPops + 1;
      if (newCorrect >= 5) {
        if (roundIdx + 1 < targets.length) {
          if (spawnTimer.current) clearInterval(spawnTimer.current);
          setRoundComplete(true);
          setBalloons([]);
          setTimeout(() => {
            setRoundComplete(false);
            setRoundIdx((r) => r + 1);
            setCorrectPops(0);
          }, 1000);
        } else {
          endGame();
        }
      }
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setLives((l) => {
        const newLives = l - 1;
        if (newLives <= 0) endGame();
        return Math.max(0, newLives);
      });
    }
  };

  const endGame = () => {
    setGameActive(false);
    setGameOver(true);
    if (spawnTimer.current) clearInterval(spawnTimer.current);
    setBalloons([]);
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
    <View style={[styles.container, { backgroundColor: '#1a1a3e', paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable onPress={() => { endGame(); router.back(); }}>
          <Feather name="x" size={22} color="#fff" />
        </Pressable>
        <View style={styles.targetBox}>
          <Text style={styles.targetLabel}>Pop: </Text>
          <View style={[styles.targetBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.targetText}>{currentTarget?.target}</Text>
          </View>
        </View>
        <View style={styles.lives}>
          {[0, 1, 2].map((i) => (
            <Feather
              key={i}
              name="heart"
              size={18}
              color={i < lives ? '#EF4444' : '#555'}
            />
          ))}
        </View>
      </View>

      <View style={styles.progressRow}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View
            key={i}
            style={[styles.progressDot, { backgroundColor: i < targetProgress ? colors.success : '#333' }]}
          />
        ))}
        <Text style={styles.scoreText}>Score: {score}</Text>
      </View>

      <View style={styles.sky}>
        {balloons.filter((b) => !b.popped).map((balloon) => (
          <Animated.View
            key={balloon.id}
            style={[
              styles.balloonWrap,
              {
                left: `${balloon.x}%` as any,
                transform: [{ translateY: balloon.animY }],
              },
            ]}
          >
            <Pressable onPress={() => popBalloon(balloon)}>
              <View style={[styles.balloon, { backgroundColor: balloon.color }]}>
                <Text style={styles.balloonText}>{balloon.value}</Text>
              </View>
              <View style={[styles.string, { backgroundColor: balloon.color }]} />
            </Pressable>
          </Animated.View>
        ))}
        {roundComplete && (
          <View style={styles.roundMsg}>
            <Text style={styles.roundMsgText}>Round cleared!</Text>
          </View>
        )}
      </View>

      {gameOver && (
        <View style={styles.overlay}>
          <View style={[styles.doneCard, { backgroundColor: colors.card, borderRadius: 24 }]}>
            <Text style={[styles.doneTitle, { color: colors.foreground }]}>Game Over!</Text>
            <Text style={[styles.doneScore, { color: colors.primary }]}>Score: {score}</Text>
            <Pressable
              onPress={handleFinish}
              style={[styles.doneBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.doneBtnText, { color: colors.primaryForeground }]}>Continue</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingVertical: 12, justifyContent: 'space-between',
  },
  targetBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  targetLabel: { color: '#ccc', fontSize: 15, fontFamily: 'Inter_500Medium' },
  targetBadge: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
  },
  targetText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  lives: { flexDirection: 'row', gap: 6 },
  progressRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingBottom: 8,
  },
  progressDot: { width: 10, height: 10, borderRadius: 5 },
  scoreText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold', marginLeft: 'auto' },
  sky: { flex: 1, overflow: 'hidden' },
  balloonWrap: { position: 'absolute', bottom: 0, alignItems: 'center' },
  balloon: {
    width: 70, height: 85, borderRadius: 35,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8,
  },
  balloonText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold', textAlign: 'center', padding: 4 },
  string: { width: 2, height: 20, alignSelf: 'center' },
  roundMsg: {
    position: 'absolute', top: '40%', left: 0, right: 0, alignItems: 'center',
  },
  roundMsgText: { color: '#fff', fontSize: 28, fontFamily: 'Inter_700Bold' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000AA',
    alignItems: 'center', justifyContent: 'center',
  },
  doneCard: {
    padding: 32, alignItems: 'center', gap: 16, width: '80%',
  },
  doneTitle: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  doneScore: { fontSize: 20, fontFamily: 'Inter_600SemiBold' },
  doneBtn: { paddingVertical: 14, paddingHorizontal: 40, borderRadius: 16, marginTop: 8 },
  doneBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});
