import React, { useState, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View, Platform, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';

// ── Constants ──────────────────────────────────────────────────────────────
const CAPACITY = 4;
const SEGMENT_H = 44;
const TUBE_W = 56;
const TUBE_INNER_H = CAPACITY * SEGMENT_H;

const COLOR_MAP: Record<string, { bg: string; dark: string; label: string }> = {
  R: { bg: '#EF4444', dark: '#B91C1C', label: 'Red' },
  B: { bg: '#3B82F6', dark: '#1D4ED8', label: 'Blue' },
  G: { bg: '#10B981', dark: '#047857', label: 'Green' },
  Y: { bg: '#FBBF24', dark: '#B45309', label: 'Yellow' },
  P: { bg: '#8B5CF6', dark: '#6D28D9', label: 'Purple' },
  O: { bg: '#F97316', dark: '#C2410C', label: 'Orange' },
};

type Color = keyof typeof COLOR_MAP;
type Tube = Color[];

// ── Seeded RNG ──────────────────────────────────────────────────────────────
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

// ── Tube helpers ─────────────────────────────────────────────────────────────
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
  if (src === dst) return false;
  if (tubes[src].length === 0) return false;
  if (tubes[dst].length >= CAPACITY) return false;
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
  for (let i = 0; i < toMove; i++) {
    next[src].pop();
    next[dst].push(color);
  }
  return next;
}

function isWon(tubes: Tube[]): boolean {
  return tubes.every(t => t.length === 0 || (t.length === CAPACITY && t.every(c => c === t[0])));
}

function isUniform(tube: Tube): boolean {
  return tube.length === 0 || (tube.length === CAPACITY && tube.every(c => c === tube[0]));
}

// ── Puzzle generation ────────────────────────────────────────────────────────
function makePuzzle(level: number): Tube[] {
  const numColors: number = level <= 1 ? 3 : level <= 3 ? 4 : 5;
  const colorKeys: Color[] = (['R', 'B', 'G', 'Y', 'P'] as Color[]).slice(0, numColors);

  // Start solved
  let tubes: Tube[] = [
    ...colorKeys.map(c => [c, c, c, c] as Tube),
    [],
    [],
  ];

  const rng = seededRng(level * 7331 + 1337);
  const targetMoves = 12 + level * 10;
  let done = 0;
  let tries = 0;

  while (done < targetMoves && tries < targetMoves * 40) {
    tries++;
    const s = Math.floor(rng() * tubes.length);
    const d = Math.floor(rng() * tubes.length);
    if (canPour(tubes, s, d)) {
      tubes = doPour(tubes, s, d);
      done++;
    }
  }
  return tubes;
}

// ── Screen ──────────────────────────────────────────────────────────────────
export default function WaterSortScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ gameId: string; level: string }>();
  const level = Math.min(5, Math.max(1, parseInt(params.level ?? '1')));
  const gameId = params.gameId ?? 'water-sort-default';
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const [tubes, setTubes] = useState<Tube[]>(() => makePuzzle(level));
  const [initialTubes] = useState<Tube[]>(() => makePuzzle(level));
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [pours, setPours] = useState(0);
  const [won, setWon] = useState(false);
  const [startTime] = useState(Date.now());
  const [flashTube, setFlashTube] = useState<number | null>(null);
  const [undoStack, setUndoStack] = useState<Tube[][]>([]);

  const handleTap = useCallback((idx: number) => {
    if (won) return;

    if (selected === null) {
      if (tubes[idx].length > 0) {
        setSelected(idx);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      return;
    }

    if (selected === idx) {
      setSelected(null);
      return;
    }

    if (canPour(tubes, selected, idx)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setUndoStack(prev => [...prev.slice(-9), tubes]);
      const next = doPour(tubes, selected, idx);
      setTubes(next);
      setPours(p => p + 1);
      setScore(s => s + 15);
      setSelected(null);
      setFlashTube(idx);
      setTimeout(() => setFlashTube(null), 400);
      if (isWon(next)) {
        setTimeout(() => setWon(true), 300);
      }
    } else {
      // Invalid pour — flash the source tube
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setFlashTube(selected);
      setTimeout(() => setFlashTube(null), 400);
      if (tubes[idx].length > 0) setSelected(idx);
      else setSelected(null);
    }
  }, [tubes, selected, won]);

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    setTubes(prev);
    setSelected(null);
    setPours(p => Math.max(0, p - 1));
    setScore(s => Math.max(0, s - 5));
  };

  const handleRestart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTubes(initialTubes.map(t => [...t]));
    setSelected(null);
    setPours(0);
    setScore(0);
    setUndoStack([]);
    setWon(false);
  };

  const handleFinish = () => {
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const accuracy = Math.min(100, Math.round((score / Math.max(1, pours)) * 10));
    const xpEarned = Math.round(score / 5) + 10;
    router.replace(
      `/games/complete?gameId=${gameId}&gameType=water-sort&score=${score}&accuracy=${accuracy}&timeSpent=${timeSpent}&level=${level}&xpEarned=${xpEarned}`
    );
  };

  // Layout: 3 tubes per row
  const tubeRows: Tube[][] = [];
  for (let i = 0; i < tubes.length; i += 3) {
    tubeRows.push(tubes.slice(i, i + 3));
  }
  const tubeOffsets: number[] = tubes.map((_, i) => i);

  const numColors = level <= 1 ? 3 : level <= 3 ? 4 : 5;
  const colorKeys = (['R', 'B', 'G', 'Y', 'P'] as Color[]).slice(0, numColors);

  return (
    <View style={[styles.container, { backgroundColor: '#0d1117', paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="x" size={22} color="#fff" />
        </Pressable>
        <View>
          <Text style={styles.title}>Water Sort</Text>
          <Text style={styles.subtitle}>Level {level} · {pours} pours</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable onPress={handleUndo} style={styles.iconBtn} disabled={undoStack.length === 0}>
            <Feather name="rotate-ccw" size={20} color={undoStack.length > 0 ? '#6366F1' : '#333'} />
          </Pressable>
          <Pressable onPress={handleRestart} style={styles.iconBtn}>
            <Feather name="refresh-cw" size={20} color="#F59E0B" />
          </Pressable>
        </View>
      </View>

      {/* Hint row */}
      <View style={styles.hintRow}>
        <Text style={styles.hintText}>
          Sort each tube so all colors match · Tap a tube to select, tap another to pour
        </Text>
      </View>

      {/* Color legend */}
      <View style={styles.legend}>
        {colorKeys.map(k => (
          <View key={k} style={[styles.legendDot, { backgroundColor: COLOR_MAP[k].bg }]} />
        ))}
        <Text style={styles.legendText}>{numColors} colors to sort</Text>
        <Text style={styles.scoreText}>⚡ {score}</Text>
      </View>

      {/* Tubes */}
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: botPad + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {tubeRows.map((row, ri) => (
          <View key={ri} style={styles.tubeRow}>
            {row.map((tube, ti) => {
              const globalIdx = ri * 3 + ti;
              const isSelected = selected === globalIdx;
              const isDone = isUniform(tube);
              const isFlashing = flashTube === globalIdx;
              const borderColor = isFlashing ? '#fff'
                : isSelected ? '#6366F1'
                : isDone && tube.length > 0 ? '#10B981'
                : '#2a2a3a';
              const lift = isSelected ? -12 : 0;

              return (
                <Pressable
                  key={globalIdx}
                  onPress={() => handleTap(globalIdx)}
                  style={[styles.tubeWrap, { marginTop: lift }]}
                >
                  {/* Selected glow */}
                  {isSelected && (
                    <View style={[styles.glow, { shadowColor: '#6366F1' }]} />
                  )}

                  {/* Glass tube */}
                  <View style={[styles.tubeOuter, { borderColor, borderWidth: isSelected || isDone ? 2.5 : 1.5 }]}>
                    <View style={styles.tubeInner}>
                      {/* Render segments bottom-to-top using column-reverse */}
                      <View style={styles.segments}>
                        {Array.from({ length: CAPACITY }).map((_, si) => {
                          const color = tube[si] ?? null;
                          const isTopLiquid = si === tube.length - 1 && color !== null;
                          return (
                            <View
                              key={si}
                              style={[
                                styles.segment,
                                {
                                  backgroundColor: color ? COLOR_MAP[color].bg : 'transparent',
                                  borderTopLeftRadius: isTopLiquid ? 6 : 0,
                                  borderTopRightRadius: isTopLiquid ? 6 : 0,
                                },
                              ]}
                            />
                          );
                        })}
                      </View>
                    </View>
                  </View>

                  {/* Done checkmark */}
                  {isDone && tube.length > 0 && (
                    <View style={styles.doneCheck}>
                      <Feather name="check" size={14} color="#10B981" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* Win overlay */}
      {won && (
        <View style={styles.overlay}>
          <View style={styles.winCard}>
            <Text style={styles.winEmoji}>💧</Text>
            <Text style={styles.winTitle}>Sorted!</Text>
            <Text style={styles.winScore}>Score: {score}</Text>
            <Text style={styles.winSub}>{pours} pours · Level {level}</Text>
            <Pressable onPress={handleFinish} style={styles.winBtn}>
              <Text style={styles.winBtnText}>Continue</Text>
              <Feather name="arrow-right" size={18} color="#fff" />
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
  iconBtn: { padding: 6 },
  title: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  subtitle: { color: '#666', fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  headerRight: { flexDirection: 'row', gap: 4 },
  hintRow: { paddingHorizontal: 20, paddingBottom: 6 },
  hintText: { color: '#555', fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  legend: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingBottom: 10,
  },
  legendDot: { width: 14, height: 14, borderRadius: 7 },
  legendText: { color: '#888', fontSize: 12, fontFamily: 'Inter_400Regular', marginRight: 'auto' as any },
  scoreText: { color: '#F59E0B', fontSize: 14, fontFamily: 'Inter_700Bold' },
  scroll: { padding: 20, gap: 20 },
  tubeRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 20, alignItems: 'flex-end',
  },
  tubeWrap: { alignItems: 'center', gap: 8, position: 'relative' },
  glow: {
    position: 'absolute', top: -4, left: -4, right: -4, bottom: -4,
    borderRadius: 20, shadowOpacity: 0.8, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
  },
  tubeOuter: {
    width: TUBE_W, borderRadius: 14, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tubeInner: { height: TUBE_INNER_H },
  segments: {
    flex: 1, flexDirection: 'column-reverse',
  },
  segment: {
    height: SEGMENT_H, width: '100%',
  },
  doneCheck: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(16,185,129,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center', justifyContent: 'center',
  },
  winCard: {
    backgroundColor: '#1a1a2e', borderRadius: 24, padding: 32,
    alignItems: 'center', gap: 12, width: '80%',
    borderWidth: 1, borderColor: '#6366F1',
  },
  winEmoji: { fontSize: 48 },
  winTitle: { color: '#fff', fontSize: 28, fontFamily: 'Inter_700Bold' },
  winScore: { color: '#6366F1', fontSize: 22, fontFamily: 'Inter_700Bold' },
  winSub: { color: '#666', fontSize: 14, fontFamily: 'Inter_400Regular' },
  winBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#6366F1', paddingVertical: 14, paddingHorizontal: 32,
    borderRadius: 16, marginTop: 8,
  },
  winBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
});
