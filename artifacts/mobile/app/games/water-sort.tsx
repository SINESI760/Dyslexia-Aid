import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Animated, Pressable, StyleSheet, Text, View, Platform, ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';

// ── Constants ──────────────────────────────────────────────────────────────
const CAPACITY = 4;
const SEGMENT_H = 48;
const TUBE_W = 62;
const TUBE_INNER_H = CAPACITY * SEGMENT_H; // 192

const COLOR_MAP: Record<string, { bg: string; dark: string }> = {
  R: { bg: '#EF4444', dark: '#B91C1C' },
  B: { bg: '#3B82F6', dark: '#1D4ED8' },
  G: { bg: '#10B981', dark: '#047857' },
  Y: { bg: '#FBBF24', dark: '#B45309' },
  P: { bg: '#8B5CF6', dark: '#6D28D9' },
  O: { bg: '#F97316', dark: '#C2410C' },
};

type Color = keyof typeof COLOR_MAP;
type Tube = Color[];

// ── Helpers ─────────────────────────────────────────────────────────────────
function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function topColor(tube: Tube): Color | null {
  return tube.length > 0 ? tube[tube.length - 1] : null;
}

function topRunLen(tube: Tube): number {
  if (tube.length === 0) return 0;
  const top = tube[tube.length - 1];
  let n = 0;
  for (let i = tube.length - 1; i >= 0 && tube[i] === top; i--) n++;
  return n;
}

function canPour(tubes: Tube[], src: number, dst: number): boolean {
  if (src === dst || tubes[src].length === 0 || tubes[dst].length >= CAPACITY) return false;
  const st = topColor(tubes[src])!;
  const dt = topColor(tubes[dst]);
  return dt === null || dt === st;
}

function doPour(tubes: Tube[], src: number, dst: number): Tube[] {
  const next = tubes.map(t => [...t]);
  const color = next[src][next[src].length - 1];
  const run = topRunLen(next[src]);
  const space = CAPACITY - next[dst].length;
  const toMove = Math.min(run, space);
  for (let i = 0; i < toMove; i++) { next[src].pop(); next[dst].push(color); }
  return next;
}

function isUniform(tube: Tube): boolean {
  return tube.length === 0 || (tube.length === CAPACITY && tube.every(c => c === tube[0]));
}

function isWon(tubes: Tube[]): boolean {
  return tubes.every(t => t.length === 0 || (t.length === CAPACITY && t.every(c => c === t[0])));
}

// ── Puzzle generation ────────────────────────────────────────────────────────
function getLevelConfig(lvl: number) {
  const numColors = Math.min(6, 3 + Math.floor((lvl - 1) / 2));
  const numEmpty = 2;
  const scrambleMoves = 20 + lvl * 10;
  return { numColors, numEmpty, scrambleMoves };
}

function makePuzzle(level: number): Tube[] {
  const { numColors, numEmpty, scrambleMoves } = getLevelConfig(level);
  const colorKeys = (['R', 'B', 'G', 'Y', 'P', 'O'] as Color[]).slice(0, numColors);

  let tubes: Tube[] = [
    ...colorKeys.map(c => [c, c, c, c] as Tube),
    ...Array(numEmpty).fill(null).map(() => [] as Tube),
  ];

  const rng = seededRng(level * 9973 + 54321);
  let done = 0, tries = 0;
  while (done < scrambleMoves && tries < scrambleMoves * 40) {
    tries++;
    const s = Math.floor(rng() * tubes.length);
    const d = Math.floor(rng() * tubes.length);
    if (canPour(tubes, s, d)) { tubes = doPour(tubes, s, d); done++; }
  }
  return tubes;
}

// ── Daily levels ─────────────────────────────────────────────────────────────
function getDailyLevels(): [number, number, number] {
  const start = new Date('2025-01-01').getTime();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - start) / 86400000);
  const base = (Math.abs(days) % 8) + 1; // cycles 1–8
  return [base, base + 1, base + 2];
}

function diffLabel(lvl: number): string {
  if (lvl <= 2) return 'Easy';
  if (lvl <= 4) return 'Medium';
  if (lvl <= 6) return 'Hard';
  return 'Expert';
}
function diffColor(lvl: number): string {
  if (lvl <= 2) return '#10B981';
  if (lvl <= 4) return '#F59E0B';
  if (lvl <= 6) return '#EF4444';
  return '#8B5CF6';
}

// ── Screen ──────────────────────────────────────────────────────────────────
export default function WaterSortScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ gameId: string }>();
  const gameId = params.gameId ?? 'water-sort-default';
  const topPad = Platform.OS === 'web' ? 60 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const [dailyLevels] = useState<[number, number, number]>(() => getDailyLevels());
  const [playingLevel, setPlayingLevel] = useState<number | null>(null);

  // ── Game state ─────────────────────────────────────────────────────────────
  const [tubes, setTubes] = useState<Tube[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [animating, setAnimating] = useState(false);
  const [pourState, setPourState] = useState<{ src: number; dst: number } | null>(null);
  const [pendingTubes, setPendingTubes] = useState<Tube[] | null>(null);
  const [completedTubes, setCompletedTubes] = useState<Set<number>>(new Set());
  const [won, setWon] = useState(false);
  const [pours, setPours] = useState(0);
  const [score, setScore] = useState(0);
  const [undoStack, setUndoStack] = useState<Tube[][]>([]);
  const [startTime, setStartTime] = useState(Date.now());
  const initTubes = useRef<Tube[]>([]);

  // ── Animation refs ─────────────────────────────────────────────────────────
  const hoverAnims = useRef<Animated.Value[]>([]);
  const tubeAnims = useRef<Animated.Value[]>([]);
  const starAnims = useRef<{ scale: Animated.Value; opacity: Animated.Value }[]>([]);

  // ── Start game ─────────────────────────────────────────────────────────────
  const startGame = useCallback((lvl: number) => {
    const newTubes = makePuzzle(lvl);
    initTubes.current = newTubes.map(t => [...t]);
    hoverAnims.current = newTubes.map(() => new Animated.Value(0));
    tubeAnims.current = newTubes.map(t => new Animated.Value(t.length * SEGMENT_H));
    starAnims.current = newTubes.map(() => ({
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }));
    setTubes(newTubes);
    setSelected(null);
    setAnimating(false);
    setPourState(null);
    setPendingTubes(null);
    setCompletedTubes(new Set());
    setWon(false);
    setPours(0);
    setScore(0);
    setUndoStack([]);
    setStartTime(Date.now());
    setPlayingLevel(lvl);
  }, []);

  // ── Get display tube (pending for dst during animation) ───────────────────
  const getDisplayTube = useCallback((i: number): Tube => {
    if (pourState && pendingTubes) {
      if (i === pourState.dst) return pendingTubes[i];
    }
    return tubes[i];
  }, [pourState, pendingTubes, tubes]);

  // ── Stars burst ────────────────────────────────────────────────────────────
  const burstStar = useCallback((i: number) => {
    const anim = starAnims.current[i];
    if (!anim) return;
    anim.scale.setValue(0.3);
    anim.opacity.setValue(1);
    Animated.sequence([
      Animated.spring(anim.scale, { toValue: 1.6, useNativeDriver: false, speed: 20 }),
      Animated.delay(500),
      Animated.timing(anim.opacity, { toValue: 0, duration: 600, useNativeDriver: false }),
    ]).start();
  }, []);

  // ── Check completions ─────────────────────────────────────────────────────
  const checkCompletions = useCallback((nextTubes: Tube[], dstIdx: number) => {
    const newCompleted = new Set(completedTubes);
    nextTubes.forEach((tube, i) => {
      if (!completedTubes.has(i) && isUniform(tube) && tube.length === CAPACITY) {
        newCompleted.add(i);
        burstStar(i);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    });
    setCompletedTubes(newCompleted);
    if (isWon(nextTubes)) setTimeout(() => setWon(true), 600);
  }, [completedTubes, burstStar]);

  // ── Animate pour ──────────────────────────────────────────────────────────
  const animatePour = useCallback((src: number, dst: number) => {
    const nextTubes = doPour(tubes, src, dst);
    const srcOldH = tubes[src].length * SEGMENT_H;
    const dstOldH = tubes[dst].length * SEGMENT_H;
    const srcNewH = nextTubes[src].length * SEGMENT_H;
    const dstNewH = nextTubes[dst].length * SEGMENT_H;

    setAnimating(true);
    setPourState({ src, dst });
    setPendingTubes(nextTubes);
    setUndoStack(prev => [...prev.slice(-9), tubes]);
    setPours(p => p + 1);
    setScore(s => s + 15);

    // Hover back down
    Animated.spring(hoverAnims.current[src], { toValue: 0, useNativeDriver: false }).start();

    // Set heights to old, then animate to new
    tubeAnims.current[src].setValue(srcOldH);
    tubeAnims.current[dst].setValue(dstOldH);

    Animated.parallel([
      Animated.timing(tubeAnims.current[src], {
        toValue: srcNewH, duration: 420, useNativeDriver: false,
      }),
      Animated.timing(tubeAnims.current[dst], {
        toValue: dstNewH, duration: 420, useNativeDriver: false,
      }),
    ]).start(() => {
      setTubes(nextTubes);
      setPourState(null);
      setPendingTubes(null);
      setAnimating(false);
      setSelected(null);
      checkCompletions(nextTubes, dst);
    });
  }, [tubes, checkCompletions]);

  // ── Handle tube tap ───────────────────────────────────────────────────────
  const handleTap = useCallback((idx: number) => {
    if (animating || won) return;

    if (selected === null) {
      if (tubes[idx].length > 0) {
        setSelected(idx);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Animated.spring(hoverAnims.current[idx], {
          toValue: -18, useNativeDriver: false, speed: 40,
        }).start();
      }
      return;
    }

    if (selected === idx) {
      // Deselect
      Animated.spring(hoverAnims.current[idx], { toValue: 0, useNativeDriver: false }).start();
      setSelected(null);
      return;
    }

    if (canPour(tubes, selected, idx)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      animatePour(selected, idx);
    } else {
      // Invalid — bounce back and switch selection
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      Animated.sequence([
        Animated.timing(hoverAnims.current[selected], { toValue: -22, duration: 80, useNativeDriver: false }),
        Animated.spring(hoverAnims.current[selected], { toValue: 0, useNativeDriver: false }),
      ]).start();
      setSelected(null);
      // Auto-select new tube if tapped one has content
      if (tubes[idx].length > 0) {
        setTimeout(() => {
          setSelected(idx);
          Animated.spring(hoverAnims.current[idx], { toValue: -18, useNativeDriver: false, speed: 40 }).start();
        }, 150);
      }
    }
  }, [animating, won, selected, tubes, animatePour]);

  // ── Undo ───────────────────────────────────────────────────────────────────
  const handleUndo = () => {
    if (undoStack.length === 0 || animating) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    prev.forEach((tube, i) => {
      if (tubeAnims.current[i]) tubeAnims.current[i].setValue(tube.length * SEGMENT_H);
    });
    setTubes(prev);
    setSelected(null);
    setCompletedTubes(new Set());
    setPours(p => Math.max(0, p - 1));
    setScore(s => Math.max(0, s - 10));
  };

  // ── Restart ────────────────────────────────────────────────────────────────
  const handleRestart = () => {
    if (animating) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const restored = initTubes.current.map(t => [...t]);
    restored.forEach((tube, i) => {
      if (hoverAnims.current[i]) hoverAnims.current[i].setValue(0);
      if (tubeAnims.current[i]) tubeAnims.current[i].setValue(tube.length * SEGMENT_H);
    });
    setTubes(restored);
    setSelected(null);
    setCompletedTubes(new Set());
    setWon(false);
    setPours(0);
    setScore(0);
    setUndoStack([]);
  };

  const handleFinish = () => {
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const accuracy = Math.min(100, Math.round((score / Math.max(1, pours)) * 10));
    const xpEarned = Math.round(score / 5) + 10;
    router.replace(
      `/games/complete?gameId=${gameId}&gameType=water-sort&score=${score}&accuracy=${accuracy}&timeSpent=${timeSpent}&level=${playingLevel}&xpEarned=${xpEarned}`
    );
  };

  // ── Level picker ───────────────────────────────────────────────────────────
  if (playingLevel === null) {
    return (
      <View style={[pickerStyles.container, { paddingTop: topPad, paddingBottom: botPad }]}>
        <View style={pickerStyles.header}>
          <Pressable onPress={() => router.back()} style={pickerStyles.backBtn}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>
          <Text style={pickerStyles.title}>Water Sort</Text>
        </View>

        <Text style={pickerStyles.sub}>Choose today's challenge</Text>

        <View style={pickerStyles.cards}>
          {dailyLevels.map((lvl, i) => {
            const { numColors, numEmpty } = getLevelConfig(lvl);
            const label = diffLabel(lvl);
            const dc = diffColor(lvl);
            const previewColors = (['R', 'B', 'G', 'Y', 'P', 'O'] as Color[]).slice(0, numColors);
            return (
              <Pressable key={lvl} onPress={() => startGame(lvl)} style={pickerStyles.card}>
                {/* Difficulty badge */}
                <View style={[pickerStyles.badge, { backgroundColor: dc + '22', borderColor: dc }]}>
                  <Text style={[pickerStyles.badgeText, { color: dc }]}>{label}</Text>
                </View>
                <Text style={pickerStyles.levelNum}>Level {lvl}</Text>
                {/* Mini tube preview */}
                <View style={pickerStyles.preview}>
                  {previewColors.map(c => (
                    <View key={c} style={[pickerStyles.colorDot, { backgroundColor: COLOR_MAP[c].bg }]} />
                  ))}
                </View>
                <Text style={pickerStyles.tubeCount}>{numColors + numEmpty} tubes</Text>
                {i === 1 && (
                  <View style={pickerStyles.todayBadge}>
                    <Text style={pickerStyles.todayText}>TODAY</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={pickerStyles.hint}>Difficulty increases each day</Text>
      </View>
    );
  }

  // ── Game ──────────────────────────────────────────────────────────────────
  const { numColors, numEmpty } = getLevelConfig(playingLevel);
  const totalTubes = tubes.length;
  const doneCount = [...completedTubes].filter(i => tubes[i]?.length > 0).length;

  return (
    <View style={[styles.container, { backgroundColor: '#0d1117', paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="x" size={22} color="#fff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Level {playingLevel}</Text>
          <Text style={styles.subtitle}>{diffLabel(playingLevel)} · {pours} pours</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={handleUndo} style={styles.iconBtn} disabled={undoStack.length === 0 || animating}>
            <Feather name="rotate-ccw" size={20} color={undoStack.length > 0 ? '#6366F1' : '#333'} />
          </Pressable>
          <Pressable onPress={handleRestart} style={styles.iconBtn} disabled={animating}>
            <Feather name="refresh-cw" size={20} color="#F59E0B" />
          </Pressable>
        </View>
      </View>

      {/* Progress */}
      <View style={styles.progressRow}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(doneCount / numColors) * 100}%` as any }]} />
        </View>
        <Text style={styles.progressText}>{doneCount}/{numColors} sorted</Text>
        <Text style={styles.scoreText}>⚡ {score}</Text>
      </View>

      <Text style={styles.hint}>
        {selected !== null ? 'Tap another tube to pour' : 'Tap a tube to select'}
      </Text>

      {/* Tubes */}
      <ScrollView
        contentContainerStyle={[styles.tubesScroll, { paddingBottom: botPad + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.tubesGrid}>
          {tubes.map((tube, i) => {
            const isSelected = selected === i;
            const isDone = completedTubes.has(i) && tube.length === CAPACITY;
            const borderColor = isSelected ? '#6366F1' : isDone ? '#10B981' : '#2a2a3e';
            const borderWidth = isSelected || isDone ? 2.5 : 1.5;
            const displayTube = getDisplayTube(i);
            const hover = hoverAnims.current[i];
            const fillH = tubeAnims.current[i];
            const star = starAnims.current[i];

            return (
              <Animated.View
                key={i}
                style={[styles.tubeWrapper, hover ? { transform: [{ translateY: hover }] } : {}]}
              >
                <Pressable onPress={() => handleTap(i)} style={styles.tubePressable}>
                  {/* Glass tube */}
                  <View style={[styles.tubeGlass, { borderColor, borderWidth }]}>
                    {/* Liquid area — fills from bottom, height animated */}
                    {fillH ? (
                      <Animated.View style={[styles.liquidArea, { height: fillH }]}>
                        {/* Segments anchored to bottom via flex-end, overflow clips top */}
                        <View style={styles.segmentStack}>
                          {Array.from({ length: CAPACITY }).map((_, si) => {
                            const c = displayTube[si] ?? null;
                            return (
                              <View
                                key={si}
                                style={[
                                  styles.segment,
                                  {
                                    backgroundColor: c ? COLOR_MAP[c].bg : 'transparent',
                                    borderTopLeftRadius: si === displayTube.length - 1 && c ? 4 : 0,
                                    borderTopRightRadius: si === displayTube.length - 1 && c ? 4 : 0,
                                  },
                                ]}
                              />
                            );
                          })}
                        </View>
                      </Animated.View>
                    ) : (
                      <View style={{ height: TUBE_INNER_H }} />
                    )}
                  </View>

                  {/* Done checkmark */}
                  {isDone && !animating && (
                    <View style={styles.doneIcon}>
                      <Feather name="check" size={12} color="#10B981" />
                    </View>
                  )}
                </Pressable>

                {/* Star burst overlay */}
                {star ? (
                  <Animated.View
                    style={[
                      styles.starBurst,
                      {
                        opacity: star.opacity,
                        transform: [{ scale: star.scale }],
                      },
                    ]}
                    pointerEvents="none"
                  >
                    <Text style={styles.starText}>⭐</Text>
                  </Animated.View>
                ) : null}
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>

      {/* Win overlay */}
      {won && (
        <View style={styles.overlay}>
          <View style={styles.winCard}>
            <Text style={styles.winEmoji}>💧</Text>
            <Text style={styles.winTitle}>All Sorted!</Text>
            <Text style={styles.winScore}>Score: {score}</Text>
            <Text style={styles.winSub}>{pours} pours · Level {playingLevel}</Text>
            <View style={styles.winBtns}>
              {playingLevel < dailyLevels[2] && (
                <Pressable
                  onPress={() => startGame(playingLevel + 1)}
                  style={[styles.winBtn, { backgroundColor: '#1a1a3e', borderWidth: 1, borderColor: '#6366F1' }]}
                >
                  <Feather name="arrow-up-circle" size={18} color="#6366F1" />
                  <Text style={[styles.winBtnText, { color: '#6366F1' }]}>Next Level</Text>
                </Pressable>
              )}
              <Pressable onPress={handleFinish} style={styles.winBtn}>
                <Text style={styles.winBtnText}>Continue</Text>
                <Feather name="arrow-right" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const pickerStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 },
  backBtn: { padding: 6 },
  title: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold' },
  sub: { color: '#666', fontSize: 14, fontFamily: 'Inter_400Regular', marginBottom: 24 },
  cards: { flexDirection: 'row', gap: 12 },
  card: {
    flex: 1, backgroundColor: '#161626', borderRadius: 20, padding: 14,
    alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#2a2a3e',
    position: 'relative', overflow: 'hidden',
  },
  badge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  levelNum: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold' },
  preview: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, justifyContent: 'center', width: 60 },
  colorDot: { width: 14, height: 14, borderRadius: 7 },
  tubeCount: { color: '#555', fontSize: 11, fontFamily: 'Inter_400Regular' },
  todayBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: '#6366F1', paddingHorizontal: 8, paddingVertical: 3,
    borderBottomLeftRadius: 12,
  },
  todayText: { color: '#fff', fontSize: 9, fontFamily: 'Inter_700Bold' },
  hint: { color: '#444', fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 32 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingVertical: 12, justifyContent: 'space-between',
  },
  iconBtn: { padding: 6 },
  headerCenter: { alignItems: 'center' },
  title: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold' },
  subtitle: { color: '#555', fontSize: 12, fontFamily: 'Inter_400Regular' },
  headerActions: { flexDirection: 'row', gap: 4 },
  progressRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingBottom: 8,
  },
  progressBar: { flex: 1, height: 6, backgroundColor: '#1a1a2e', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  progressText: { color: '#10B981', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  scoreText: { color: '#F59E0B', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  hint: { color: '#444', fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingBottom: 12 },
  tubesScroll: { paddingHorizontal: 16, paddingTop: 8 },
  tubesGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', gap: 18, rowGap: 32,
  },
  tubeWrapper: { alignItems: 'center', gap: 8, position: 'relative' },
  tubePressable: { alignItems: 'center', gap: 8 },
  tubeGlass: {
    width: TUBE_W,
    height: TUBE_INNER_H,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111827',
    justifyContent: 'flex-end',
  },
  liquidArea: {
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  segmentStack: {
    height: TUBE_INNER_H,
    flexDirection: 'column-reverse',
  },
  segment: { height: SEGMENT_H, width: '100%' },
  doneIcon: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#10B98122',
    alignItems: 'center', justifyContent: 'center',
  },
  starBurst: {
    position: 'absolute', top: -10,
    alignItems: 'center', justifyContent: 'center',
  },
  starText: { fontSize: 28 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  winCard: {
    backgroundColor: '#13132a', borderRadius: 28, padding: 32,
    alignItems: 'center', gap: 12, width: '85%',
    borderWidth: 1, borderColor: '#6366F1',
  },
  winEmoji: { fontSize: 52 },
  winTitle: { color: '#fff', fontSize: 28, fontFamily: 'Inter_700Bold' },
  winScore: { color: '#6366F1', fontSize: 22, fontFamily: 'Inter_700Bold' },
  winSub: { color: '#555', fontSize: 14, fontFamily: 'Inter_400Regular' },
  winBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  winBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#6366F1', paddingVertical: 12, paddingHorizontal: 22, borderRadius: 14,
  },
  winBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
});
