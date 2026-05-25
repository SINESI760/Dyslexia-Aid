import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';

// ── Fruits & colors ─────────────────────────────────────────────────────────
const FRUITS = ['🍎', '🍊', '🍋', '🍇', '🍓', '🍑', '🫐'];
const FRUIT_BG = [
  '#FCA5A5', '#FED7AA', '#FEF08A', '#E9D5FF',
  '#FECACA', '#FBCFE8', '#BFDBFE',
];

const ROWS = 6;
const COLS = 7;

// ── Daily level system ───────────────────────────────────────────────────────
function getDailyLevel(): number {
  const start = new Date('2025-01-01').getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - start) / 86400000);
  return (Math.abs(days) % 30) + 1; // 1–30, cycles
}

function getLevelConfig(lvl: number) {
  const numFruits = Math.min(7, 4 + Math.floor(lvl / 7));
  const maxMoves = Math.max(12, 30 - lvl);
  const targetScore = 200 + lvl * 30;
  return { numFruits, maxMoves, targetScore };
}

// ── Seeded RNG (for reproducible daily grids) ────────────────────────────────
function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

// ── Grid helpers ─────────────────────────────────────────────────────────────
function makeGrid(numFruits: number, rng: () => number): number[][] {
  let grid: number[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => Math.floor(rng() * numFruits))
  );
  // Clear initial matches so the game starts fresh
  for (let pass = 0; pass < 5; pass++) {
    const m = findMatches(grid);
    if (m.size === 0) break;
    grid = grid.map((row, r) =>
      row.map((cell, c) => {
        if (m.has(`${r},${c}`)) return Math.floor(rng() * numFruits);
        return cell;
      })
    );
  }
  return grid;
}

function findMatches(grid: number[][]): Set<string> {
  const matched = new Set<string>();
  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 2; c++) {
      const v = grid[r][c];
      if (v >= 0 && grid[r][c + 1] === v && grid[r][c + 2] === v) {
        let len = 3;
        while (c + len < COLS && grid[r][c + len] === v) len++;
        for (let k = 0; k < len; k++) matched.add(`${r},${c + k}`);
      }
    }
  }
  // Vertical
  for (let r = 0; r < ROWS - 2; r++) {
    for (let c = 0; c < COLS; c++) {
      const v = grid[r][c];
      if (v >= 0 && grid[r + 1][c] === v && grid[r + 2][c] === v) {
        let len = 3;
        while (r + len < ROWS && grid[r + len][c] === v) len++;
        for (let k = 0; k < len; k++) matched.add(`${r + k},${c}`);
      }
    }
  }
  return matched;
}

function applyGravity(grid: number[][], matches: Set<string>, numFruits: number, rng: () => number): number[][] {
  const next = grid.map(row => [...row]);
  matches.forEach(key => {
    const [r, c] = key.split(',').map(Number);
    next[r][c] = -1;
  });
  // Gravity: each column — empty cells float to top
  for (let c = 0; c < COLS; c++) {
    const col: number[] = [];
    for (let r = 0; r < ROWS; r++) {
      if (next[r][c] >= 0) col.push(next[r][c]);
    }
    const newCells = Math.floor(rng() * numFruits);
    const pad = ROWS - col.length;
    for (let r = 0; r < pad; r++) next[r][c] = Math.floor(rng() * numFruits);
    for (let r = pad; r < ROWS; r++) next[r][c] = col[r - pad];
  }
  return next;
}

function swapCells(grid: number[][], r1: number, c1: number, r2: number, c2: number): number[][] {
  const next = grid.map(row => [...row]);
  [next[r1][c1], next[r2][c2]] = [next[r2][c2], next[r1][c1]];
  return next;
}

function isAdjacent(r1: number, c1: number, r2: number, c2: number) {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function FruitCrushScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ gameId: string; level: string }>();
  const gameId = params.gameId ?? 'fruit-crush-default';
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  // Use daily level for the "daily challenge" feel
  const [dailyLevel] = useState(getDailyLevel);
  const { numFruits, maxMoves, targetScore } = getLevelConfig(dailyLevel);

  const rngRef = useRef(seededRng(dailyLevel * 77777 + new Date().setHours(0, 0, 0, 0)));

  const [grid, setGrid] = useState<number[][]>(() => makeGrid(numFruits, rngRef.current));
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(maxMoves);
  const [combo, setCombo] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'resolving' | 'done'>('idle');
  const [gameResult, setGameResult] = useState<'win' | 'lose' | null>(null);
  const [startTime] = useState(Date.now());

  const resolveRef = useRef<((g: number[][], c: number) => void) | null>(null);

  resolveRef.current = (g: number[][], currentCombo: number) => {
    const m = findMatches(g);
    if (m.size === 0) {
      setMatched(new Set());
      setCombo(0);
      setPhase('idle');
      return;
    }

    setMatched(m);
    const pts = m.size * 10 * (1 + currentCombo * 0.5);
    setScore(s => s + Math.round(pts));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setTimeout(() => {
      const next = applyGravity(g, m, numFruits, rngRef.current);
      setGrid(next);
      setMatched(new Set());
      setTimeout(() => resolveRef.current?.(next, currentCombo + 1), 200);
    }, 350);
  };

  const trySwap = useCallback((r2: number, c2: number) => {
    if (!selected || phase !== 'idle') return;
    const { r: r1, c: c1 } = selected;
    setSelected(null);

    if (!isAdjacent(r1, c1, r2, c2)) {
      setSelected({ r: r2, c: c2 });
      return;
    }

    const swapped = swapCells(grid, r1, c1, r2, c2);
    const m = findMatches(swapped);

    if (m.size === 0) {
      // No match — don't swap, don't deduct move
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setGrid(swapped);
    setMoves(mv => {
      const next = mv - 1;
      if (next <= 0 && score < targetScore) {
        setTimeout(() => setGameResult('lose'), 800);
      }
      return next;
    });
    setPhase('resolving');
    setTimeout(() => resolveRef.current?.(swapped, 0), 100);
  }, [selected, phase, grid, score, targetScore]);

  // Check win condition
  useEffect(() => {
    if (score >= targetScore && phase !== 'done') {
      setPhase('done');
      setTimeout(() => setGameResult('win'), 500);
    }
  }, [score, targetScore, phase]);

  const handleCellPress = (r: number, c: number) => {
    if (phase !== 'idle') return;
    if (!selected) {
      setSelected({ r, c });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (selected.r === r && selected.c === c) {
      setSelected(null);
    } else {
      trySwap(r, c);
    }
  };

  const handleFinish = () => {
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const accuracy = Math.min(100, Math.round((score / targetScore) * 100));
    const xpEarned = Math.round(score / 10) + 10;
    router.replace(
      `/games/complete?gameId=${gameId}&gameType=fruit-crush&score=${score}&accuracy=${accuracy}&timeSpent=${timeSpent}&level=${dailyLevel}&xpEarned=${xpEarned}`
    );
  };

  const scorePercent = Math.min(100, (score / targetScore) * 100);

  return (
    <View style={[styles.container, { backgroundColor: '#0a0a1a', paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="x" size={22} color="#fff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Fruit Crush</Text>
          <Text style={styles.dailyBadge}>Day {dailyLevel} Challenge</Text>
        </View>
        <View style={styles.movesBox}>
          <Text style={styles.movesNum}>{moves}</Text>
          <Text style={styles.movesLabel}>moves</Text>
        </View>
      </View>

      {/* Score progress */}
      <View style={styles.scoreArea}>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreText}>⭐ {score}</Text>
          <Text style={styles.targetText}>/ {targetScore}</Text>
          {combo > 1 && (
            <View style={styles.comboBadge}>
              <Text style={styles.comboText}>x{combo} COMBO!</Text>
            </View>
          )}
        </View>
        <View style={[styles.progressTrack, { backgroundColor: '#1a1a2e' }]}>
          <View style={[styles.progressFill, { width: `${scorePercent}%` as any }]} />
        </View>
      </View>

      {/* Grid */}
      <View style={styles.gridWrap}>
        {grid.map((row, r) => (
          <View key={r} style={styles.row}>
            {row.map((fruit, c) => {
              const isSelected = selected?.r === r && selected?.c === c;
              const isMatched = matched.has(`${r},${c}`);
              return (
                <Pressable
                  key={c}
                  onPress={() => handleCellPress(r, c)}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: isMatched
                        ? '#ffffff44'
                        : isSelected
                          ? `${FRUIT_BG[fruit]}dd`
                          : `${FRUIT_BG[fruit]}55`,
                      borderColor: isSelected ? '#fff' : 'transparent',
                      borderWidth: isSelected ? 2 : 0,
                      transform: [{ scale: isMatched ? 1.1 : isSelected ? 1.05 : 1 }],
                      opacity: isMatched ? 0.5 : 1,
                    },
                  ]}
                >
                  <Text style={styles.fruitEmoji}>{FRUITS[fruit]}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {/* Instruction */}
      <View style={styles.instruction}>
        <Text style={styles.instructionText}>
          {selected ? 'Tap an adjacent fruit to swap' : 'Tap a fruit to select'}
        </Text>
        <Text style={styles.levelInfo}>{numFruits} fruits · {maxMoves} moves</Text>
      </View>

      {/* Bottom padding */}
      <View style={{ height: botPad + 20 }} />

      {/* Result overlay */}
      {gameResult && (
        <View style={styles.overlay}>
          <View style={styles.resultCard}>
            <Text style={styles.resultEmoji}>
              {gameResult === 'win' ? '🏆' : '💔'}
            </Text>
            <Text style={styles.resultTitle}>
              {gameResult === 'win' ? 'You Crushed It!' : 'Out of Moves!'}
            </Text>
            <Text style={styles.resultScore}>Score: {score}</Text>
            <Text style={styles.resultSub}>
              {gameResult === 'win'
                ? `Goal reached! (${score}/${targetScore})`
                : `Try again tomorrow! Day ${dailyLevel + 1} unlocks a new challenge.`}
            </Text>
            <Pressable onPress={handleFinish} style={styles.resultBtn}>
              <Text style={styles.resultBtnText}>Continue</Text>
              <Feather name="arrow-right" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const CELL_SIZE = Math.floor((350 - 6 * 4) / COLS);

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingVertical: 12, justifyContent: 'space-between',
  },
  iconBtn: { padding: 6 },
  headerCenter: { alignItems: 'center' },
  title: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold' },
  dailyBadge: {
    color: '#F59E0B', fontSize: 11, fontFamily: 'Inter_600SemiBold',
    backgroundColor: '#F59E0B22', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 10, marginTop: 2,
  },
  movesBox: { alignItems: 'center', minWidth: 44 },
  movesNum: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold' },
  movesLabel: { color: '#666', fontSize: 10, fontFamily: 'Inter_400Regular' },
  scoreArea: { paddingHorizontal: 20, paddingBottom: 10, gap: 6 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scoreText: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold' },
  targetText: { color: '#555', fontSize: 14, fontFamily: 'Inter_400Regular' },
  comboBadge: {
    backgroundColor: '#F59E0B', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 3, marginLeft: 'auto' as any,
  },
  comboText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold' },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: {
    height: 8, borderRadius: 4,
    backgroundColor: '#F59E0B',
  },
  gridWrap: {
    alignSelf: 'center',
    gap: 4, paddingHorizontal: 16,
  },
  row: { flexDirection: 'row', gap: 4 },
  cell: {
    width: CELL_SIZE, height: CELL_SIZE,
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  fruitEmoji: { fontSize: CELL_SIZE * 0.55, lineHeight: CELL_SIZE },
  instruction: { alignItems: 'center', paddingTop: 12, gap: 4 },
  instructionText: { color: '#555', fontSize: 13, fontFamily: 'Inter_400Regular' },
  levelInfo: { color: '#333', fontSize: 11, fontFamily: 'Inter_400Regular' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center', justifyContent: 'center',
  },
  resultCard: {
    backgroundColor: '#0f1020', borderRadius: 24, padding: 32,
    alignItems: 'center', gap: 12, width: '84%',
    borderWidth: 1, borderColor: '#2a2a4a',
  },
  resultEmoji: { fontSize: 56 },
  resultTitle: { color: '#fff', fontSize: 26, fontFamily: 'Inter_700Bold' },
  resultScore: { color: '#F59E0B', fontSize: 22, fontFamily: 'Inter_700Bold' },
  resultSub: {
    color: '#666', fontSize: 13, fontFamily: 'Inter_400Regular',
    textAlign: 'center', lineHeight: 20,
  },
  resultBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#6366F1', paddingVertical: 14, paddingHorizontal: 32,
    borderRadius: 16, marginTop: 8,
  },
  resultBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
});
