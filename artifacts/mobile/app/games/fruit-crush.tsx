import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Animated, PanResponder, StyleSheet, Text, View, Platform, Pressable,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';

// ── Constants ──────────────────────────────────────────────────────────────
const FRUITS = ['🍎', '🍊', '🍋', '🍇', '🍓', '🍑', '🫐'];
const FRUIT_BG = ['#FCA5A5', '#FED7AA', '#FEF08A', '#E9D5FF', '#FECACA', '#FBCFE8', '#BFDBFE'];

const ROWS = 6;
const COLS = 7;
const CELL_SIZE = 44;
const GAP = 4;
const GRID_W = COLS * CELL_SIZE + (COLS - 1) * GAP;
const GRID_H = ROWS * CELL_SIZE + (ROWS - 1) * GAP;
const SWIPE_THRESHOLD = CELL_SIZE * 0.35;
const HINT_DELAY_MS = 4000; // show hint after 4s of no move

// ── Daily level ────────────────────────────────────────────────────────────
function getDailyLevel(): number {
  const start = new Date('2025-01-01').getTime();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - start) / 86400000);
  return (Math.abs(days) % 30) + 1;
}

function getLevelConfig(lvl: number) {
  return {
    numFruits: Math.min(7, 4 + Math.floor(lvl / 7)),
    maxMoves: Math.max(12, 30 - lvl),
    targetScore: 200 + lvl * 30,
  };
}

// ── Seeded RNG ─────────────────────────────────────────────────────────────
function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0xffffffff; };
}

// ── Grid helpers ─────────────────────────────────────────────────────────────
function makeGrid(numFruits: number, rng: () => number): number[][] {
  let grid = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => Math.floor(rng() * numFruits))
  );
  // Clear pre-existing matches
  for (let pass = 0; pass < 8; pass++) {
    const m = findMatches(grid);
    if (m.size === 0) break;
    grid = grid.map((row, r) =>
      row.map((cell, c) => m.has(`${r},${c}`) ? Math.floor(rng() * numFruits) : cell)
    );
  }
  // Ensure at least one valid move exists
  let attempts = 0;
  while (!hasPossibleMoves(grid) && attempts++ < 20) {
    grid = grid.map(row => row.map(() => Math.floor(rng() * numFruits)));
  }
  return grid;
}

function findMatches(grid: number[][]): Set<string> {
  const matched = new Set<string>();
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

function swapCells(grid: number[][], r1: number, c1: number, r2: number, c2: number) {
  const next = grid.map(row => [...row]);
  [next[r1][c1], next[r2][c2]] = [next[r2][c2], next[r1][c1]];
  return next;
}

function hasPossibleMoves(grid: number[][]): boolean {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c + 1 < COLS && findMatches(swapCells(grid, r, c, r, c + 1)).size > 0) return true;
      if (r + 1 < ROWS && findMatches(swapCells(grid, r, c, r + 1, c)).size > 0) return true;
    }
  }
  return false;
}

// Returns the two cells that form the first valid move, or null
function findFirstValidMove(grid: number[][]): { r1: number; c1: number; r2: number; c2: number } | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c + 1 < COLS && findMatches(swapCells(grid, r, c, r, c + 1)).size > 0)
        return { r1: r, c1: c, r2: r, c2: c + 1 };
      if (r + 1 < ROWS && findMatches(swapCells(grid, r, c, r + 1, c)).size > 0)
        return { r1: r, c1: c, r2: r + 1, c2: c };
    }
  }
  return null;
}

function applyGravity(
  grid: number[][], matches: Set<string>, numFruits: number, rng: () => number
): { next: number[][]; newKeys: Set<string> } {
  const next = grid.map(row => [...row]);
  matches.forEach(key => { const [r, c] = key.split(',').map(Number); next[r][c] = -1; });
  const newKeys = new Set<string>();
  for (let c = 0; c < COLS; c++) {
    const col: number[] = [];
    for (let r = 0; r < ROWS; r++) { if (next[r][c] >= 0) col.push(next[r][c]); }
    const pad = ROWS - col.length;
    for (let r = 0; r < pad; r++) { next[r][c] = Math.floor(rng() * numFruits); newKeys.add(`${r},${c}`); }
    for (let r = pad; r < ROWS; r++) next[r][c] = col[r - pad];
  }
  return { next, newKeys };
}

// ── Screen ─────────────────────────────────────────────────────────────────
export default function FruitCrushScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ gameId: string }>();
  const gameId = params.gameId ?? 'fruit-crush-default';
  const topPad = Platform.OS === 'web' ? 60 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const [dailyLevel] = useState(getDailyLevel);
  const { numFruits, maxMoves, targetScore } = getLevelConfig(dailyLevel);

  // Fully random seed each session so board is different every play
  const rngRef = useRef(seededRng(((Date.now() + Math.random() * 1e9) ^ 0xdeadbeef) >>> 0));

  const [grid, setGrid] = useState<number[][]>(() => makeGrid(numFruits, rngRef.current));
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(maxMoves);
  const [combo, setCombo] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'resolving' | 'shuffling' | 'done'>('idle');
  const [gameResult, setGameResult] = useState<'win' | 'lose' | null>(null);
  const [startTime] = useState(Date.now());

  // Hint state — highlight cells of the next valid move after inactivity
  const [hintCells, setHintCells] = useState<Set<string>>(new Set());
  const lastMoveTimeRef = useRef(Date.now());
  const hintAnim = useRef(new Animated.Value(1)).current;
  const hintLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Animated state
  const [matchedKeys, setMatchedKeys] = useState<Set<string>>(new Set());
  const [newCellKeys, setNewCellKeys] = useState<Set<string>>(new Set());
  const [draggingCell, setDraggingCell] = useState<{ r: number; c: number } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);

  const matchShrinkAnim = useRef(new Animated.Value(1)).current;
  const fallAnim = useRef(new Animated.Value(-CELL_SIZE - GAP)).current;
  const dragOffsetX = useRef(new Animated.Value(0)).current;
  const dragOffsetY = useRef(new Animated.Value(0)).current;
  const shuffleSpinAnim = useRef(new Animated.Value(0)).current;

  // Refs for stable PanResponder closures
  const gridRef = useRef(grid);
  const phaseRef = useRef(phase);
  const scoreRef = useRef(score);
  const movesRef = useRef(moves);
  const draggingRef = useRef<{ r: number; c: number } | null>(null);
  const selectedRef = useRef<{ r: number; c: number } | null>(null);
  const gridOrigin = useRef({ x: 0, y: 0 });
  const gridViewRef = useRef<View>(null);

  gridRef.current = grid;
  phaseRef.current = phase;
  scoreRef.current = score;
  movesRef.current = moves;
  selectedRef.current = selectedCell;

  // ── Hint timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'idle') {
      setHintCells(new Set());
      hintLoopRef.current?.stop();
      hintAnim.setValue(1);
      return;
    }
    const interval = setInterval(() => {
      if (Date.now() - lastMoveTimeRef.current >= HINT_DELAY_MS) {
        const move = findFirstValidMove(gridRef.current);
        if (move) {
          const cells = new Set([`${move.r1},${move.c1}`, `${move.r2},${move.c2}`]);
          setHintCells(cells);
          hintLoopRef.current?.stop();
          hintAnim.setValue(1);
          hintLoopRef.current = Animated.loop(
            Animated.sequence([
              Animated.timing(hintAnim, { toValue: 1.18, duration: 480, useNativeDriver: false }),
              Animated.timing(hintAnim, { toValue: 1, duration: 480, useNativeDriver: false }),
            ])
          );
          hintLoopRef.current.start();
        }
      } else {
        setHintCells(new Set());
        hintLoopRef.current?.stop();
        hintAnim.setValue(1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // ── Shuffle spinner animation ────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'shuffling') {
      shuffleSpinAnim.setValue(0);
      Animated.loop(
        Animated.timing(shuffleSpinAnim, { toValue: 1, duration: 700, useNativeDriver: false })
      ).start();
    } else {
      shuffleSpinAnim.setValue(0);
    }
  }, [phase]);

  // ── Auto-shuffle when no moves ───────────────────────────────────────────
  const shuffleBoard = useCallback((g: number[][]) => {
    setPhase('shuffling');
    phaseRef.current = 'shuffling';
    setHintCells(new Set());

    setTimeout(() => {
      const shuffleRng = seededRng(((Date.now() + Math.random() * 1e9) ^ 0xcafebabe) >>> 0);
      const flat = g.flat();
      for (let i = flat.length - 1; i > 0; i--) {
        const j = Math.floor(shuffleRng() * (i + 1));
        [flat[i], flat[j]] = [flat[j], flat[i]];
      }
      let newGrid = Array.from({ length: ROWS }, (_, r) => flat.slice(r * COLS, (r + 1) * COLS));
      // Clear accidental matches
      for (let pass = 0; pass < 8; pass++) {
        const m = findMatches(newGrid);
        if (m.size === 0) break;
        newGrid = newGrid.map((row, r) =>
          row.map((cell, c) => m.has(`${r},${c}`) ? Math.floor(shuffleRng() * numFruits) : cell)
        );
      }
      // Guarantee a valid move
      let attempts = 0;
      while (!hasPossibleMoves(newGrid) && attempts++ < 20) {
        newGrid = newGrid.map(row => row.map(() => Math.floor(shuffleRng() * numFruits)));
      }
      setGrid(newGrid);
      gridRef.current = newGrid;
      lastMoveTimeRef.current = Date.now();
      setPhase('idle');
      phaseRef.current = 'idle';
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 1400);
  }, [numFruits]);

  // ── Cascade resolver ────────────────────────────────────────────────────
  const resolveRef = useRef<((g: number[][], c: number) => void) | null>(null);

  resolveRef.current = (g: number[][], currentCombo: number) => {
    const m = findMatches(g);
    if (m.size === 0) {
      setMatchedKeys(new Set());
      setNewCellKeys(new Set());
      setCombo(0);
      if (!hasPossibleMoves(g)) {
        // Auto-shuffle with animation — no popup needed
        setTimeout(() => shuffleBoard(g), 300);
      } else {
        setPhase('idle');
        phaseRef.current = 'idle';
      }
      return;
    }

    setMatchedKeys(m);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    matchShrinkAnim.setValue(1);
    Animated.timing(matchShrinkAnim, { toValue: 0, duration: 240, useNativeDriver: false }).start(() => {
      const pts = m.size * 10 * (1 + currentCombo * 0.5);
      setScore(s => s + Math.round(pts));
      setCombo(currentCombo + 1);

      const { next, newKeys } = applyGravity(g, m, numFruits, rngRef.current);
      setGrid(next);
      gridRef.current = next;
      setMatchedKeys(new Set());

      setNewCellKeys(newKeys);
      fallAnim.setValue(-CELL_SIZE - GAP);
      Animated.spring(fallAnim, { toValue: 0, speed: 20, bounciness: 6, useNativeDriver: false }).start(() => {
        setNewCellKeys(new Set());
        setTimeout(() => resolveRef.current?.(next, currentCombo + 1), 80);
      });
    });
  };

  // ── Perform swap ─────────────────────────────────────────────────────────
  const performSwap = useCallback((r1: number, c1: number, r2: number, c2: number) => {
    if (phaseRef.current !== 'idle') return false;
    const g = gridRef.current;
    const swapped = swapCells(g, r1, c1, r2, c2);
    const m = findMatches(swapped);
    if (m.size === 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      return false;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Reset hint timer on a valid move
    lastMoveTimeRef.current = Date.now();
    setHintCells(new Set());
    hintLoopRef.current?.stop();
    hintAnim.setValue(1);

    const newMoves = movesRef.current - 1;
    setMoves(newMoves);
    movesRef.current = newMoves;
    setGrid(swapped);
    gridRef.current = swapped;
    setPhase('resolving');
    phaseRef.current = 'resolving';
    setSelectedCell(null);
    selectedRef.current = null;
    setTimeout(() => resolveRef.current?.(swapped, 0), 60);
    return true;
  }, []);

  // ── Win check ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (score >= targetScore && phase !== 'done' && phase !== 'shuffling') {
      setPhase('done');
      phaseRef.current = 'done';
      setTimeout(() => setGameResult('win'), 400);
    } else if (moves <= 0 && score < targetScore && phase === 'idle') {
      setPhase('done');
      phaseRef.current = 'done';
      setTimeout(() => setGameResult('lose'), 400);
    }
  }, [score, moves, targetScore, phase]);

  // ── Measure grid position on layout ──────────────────────────────────────
  const onGridLayout = useCallback(() => {
    gridViewRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
      gridOrigin.current = { x: pageX ?? 0, y: pageY ?? 0 };
    });
  }, []);

  // ── PanResponder ──────────────────────────────────────────────────────────
  const getCellFromPage = (px: number, py: number) => {
    const localX = px - gridOrigin.current.x;
    const localY = py - gridOrigin.current.y;
    const c = Math.min(COLS - 1, Math.max(0, Math.floor(localX / (CELL_SIZE + GAP))));
    const r = Math.min(ROWS - 1, Math.max(0, Math.floor(localY / (CELL_SIZE + GAP))));
    return { r, c };
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => phaseRef.current === 'idle',
      onMoveShouldSetPanResponder: (_, gs) =>
        phaseRef.current === 'idle' && (Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5),

      onPanResponderGrant: (evt) => {
        if (phaseRef.current !== 'idle') return;
        const { pageX, pageY } = evt.nativeEvent;
        const { r, c } = getCellFromPage(pageX, pageY);
        draggingRef.current = { r, c };
        setDraggingCell({ r, c });
        setSelectedCell(null);
        selectedRef.current = null;
        dragOffsetX.setValue(0);
        dragOffsetY.setValue(0);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },

      onPanResponderMove: (_, gs) => {
        if (!draggingRef.current) return;
        const absDx = Math.abs(gs.dx);
        const absDy = Math.abs(gs.dy);
        const maxSlide = CELL_SIZE + GAP;
        if (absDx >= absDy) {
          dragOffsetX.setValue(Math.max(-maxSlide, Math.min(maxSlide, gs.dx)));
          dragOffsetY.setValue(0);
        } else {
          dragOffsetX.setValue(0);
          dragOffsetY.setValue(Math.max(-maxSlide, Math.min(maxSlide, gs.dy)));
        }
      },

      onPanResponderRelease: (_, gs) => {
        const from = draggingRef.current;
        draggingRef.current = null;
        setDraggingCell(null);

        Animated.parallel([
          Animated.spring(dragOffsetX, { toValue: 0, speed: 40, useNativeDriver: false }),
          Animated.spring(dragOffsetY, { toValue: 0, speed: 40, useNativeDriver: false }),
        ]).start();

        if (!from || phaseRef.current !== 'idle') return;

        const absDx = Math.abs(gs.dx), absDy = Math.abs(gs.dy);
        const isTap = absDx < 8 && absDy < 8;

        if (isTap) {
          const prev = selectedRef.current;
          if (prev && Math.abs(prev.r - from.r) + Math.abs(prev.c - from.c) === 1) {
            const swapped = performSwap(prev.r, prev.c, from.r, from.c);
            if (!swapped) {
              setSelectedCell(gridRef.current[from.r][from.c] >= 0 ? { r: from.r, c: from.c } : null);
              selectedRef.current = gridRef.current[from.r][from.c] >= 0 ? { r: from.r, c: from.c } : null;
            }
          } else if (prev && prev.r === from.r && prev.c === from.c) {
            setSelectedCell(null);
            selectedRef.current = null;
          } else {
            setSelectedCell({ r: from.r, c: from.c });
            selectedRef.current = { r: from.r, c: from.c };
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          return;
        }

        let dr = 0, dc = 0;
        if (absDx >= absDy && absDx > SWIPE_THRESHOLD) dc = gs.dx > 0 ? 1 : -1;
        else if (absDy > absDx && absDy > SWIPE_THRESHOLD) dr = gs.dy > 0 ? 1 : -1;

        if (dr === 0 && dc === 0) return;
        const r2 = from.r + dr, c2 = from.c + dc;
        if (r2 >= 0 && r2 < ROWS && c2 >= 0 && c2 < COLS) {
          performSwap(from.r, from.c, r2, c2);
        }
      },

      onPanResponderTerminate: () => {
        draggingRef.current = null;
        setDraggingCell(null);
        Animated.parallel([
          Animated.spring(dragOffsetX, { toValue: 0, speed: 40, useNativeDriver: false }),
          Animated.spring(dragOffsetY, { toValue: 0, speed: 40, useNativeDriver: false }),
        ]).start();
      },
    })
  ).current;

  const handleFinish = () => {
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const accuracy = Math.min(100, Math.round((score / targetScore) * 100));
    router.replace(
      `/games/complete?gameId=${gameId}&gameType=fruit-crush&score=${score}&accuracy=${accuracy}&timeSpent=${timeSpent}&level=${dailyLevel}&xpEarned=${Math.round(score / 10) + 10}`
    );
  };

  const scorePercent = Math.min(100, (score / targetScore) * 100);
  const spinDeg = shuffleSpinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

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

      {/* Score bar */}
      <View style={styles.scoreArea}>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreText}>⭐ {score}</Text>
          <Text style={styles.targetText}>/ {targetScore}</Text>
          {combo > 1 && (
            <View style={styles.comboBadge}>
              <Text style={styles.comboText}>×{combo} COMBO!</Text>
            </View>
          )}
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${scorePercent}%` as any }]} />
        </View>
      </View>

      {/* Grid */}
      <View style={styles.gridContainer}>
        <View
          ref={gridViewRef}
          style={[styles.grid, { width: GRID_W, height: GRID_H }]}
          onLayout={onGridLayout}
          {...panResponder.panHandlers}
        >
          {grid.map((row, r) =>
            row.map((fruit, c) => {
              const isDragging = draggingCell?.r === r && draggingCell?.c === c;
              const isSelected = !isDragging && selectedCell?.r === r && selectedCell?.c === c;
              const isMatched = matchedKeys.has(`${r},${c}`);
              const isNew = newCellKeys.has(`${r},${c}`);
              const isHinted = hintCells.has(`${r},${c}`);
              const bgColor = FRUIT_BG[fruit] ?? '#eee';

              return (
                <Animated.View
                  key={`${r}-${c}`}
                  style={[
                    styles.cell,
                    {
                      left: c * (CELL_SIZE + GAP),
                      top: r * (CELL_SIZE + GAP),
                      backgroundColor: bgColor,
                      borderWidth: isHinted ? 2.5 : isSelected ? 2.5 : isDragging ? 2 : 0,
                      borderColor: isHinted ? '#FFD700' : isSelected ? '#fff' : isDragging ? '#FFD700' : 'transparent',
                      zIndex: isDragging ? 20 : isSelected ? 10 : isHinted ? 8 : isMatched ? 5 : 1,
                      opacity: isMatched ? undefined : 0.92,
                      transform: [
                        ...(isDragging
                          ? [{ translateX: dragOffsetX }, { translateY: dragOffsetY }]
                          : []),
                        ...(isNew ? [{ translateY: fallAnim }] : []),
                        {
                          scale: isMatched ? matchShrinkAnim
                            : isHinted ? hintAnim
                            : isDragging ? 1.14
                            : isSelected ? 1.1
                            : 1
                        },
                      ],
                      shadowColor: isHinted ? '#FFD700' : isDragging ? '#FFD700' : isSelected ? '#fff' : 'transparent',
                      shadowOpacity: (isHinted || isDragging || isSelected) ? 0.9 : 0,
                      shadowRadius: isHinted ? 14 : (isDragging || isSelected) ? 10 : 0,
                      elevation: isDragging ? 14 : isSelected ? 8 : isHinted ? 10 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.fruitEmoji, (isDragging || isSelected) && { fontSize: 28 }]}>
                    {FRUITS[fruit]}
                  </Text>
                </Animated.View>
              );
            })
          )}
        </View>
      </View>

      {/* Instruction */}
      <View style={styles.instruction}>
        <Text style={styles.instructionText}>
          {hintCells.size > 0
            ? '✨ Hint: swap the glowing fruits!'
            : selectedCell
            ? 'Tap an adjacent fruit to swap  ↔'
            : 'Tap to select · Swipe or tap neighbor to swap'}
        </Text>
        <Text style={styles.levelInfo}>{numFruits} fruits · {maxMoves} moves · target {targetScore}</Text>
      </View>

      <View style={{ height: botPad + 16 }} />

      {/* Shuffling overlay — auto-triggered, no button needed */}
      {phase === 'shuffling' && (
        <View style={styles.overlay}>
          <View style={styles.shufflingCard}>
            <Animated.Text style={[styles.shuffleEmoji, { transform: [{ rotate: spinDeg }] }]}>
              🔀
            </Animated.Text>
            <Text style={styles.shufflingTitle}>No More Moves!</Text>
            <Text style={styles.shufflingSub}>Shuffling the board…</Text>
            <View style={styles.shuffleDots}>
              {[0, 1, 2].map(i => (
                <View key={i} style={styles.shuffleDot} />
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Result overlay */}
      {gameResult && (
        <View style={styles.overlay}>
          <View style={styles.resultCard}>
            <Text style={styles.resultEmoji}>{gameResult === 'win' ? '🏆' : '💔'}</Text>
            <Text style={styles.resultTitle}>{gameResult === 'win' ? 'You Crushed It!' : 'Out of Moves!'}</Text>
            <Text style={styles.resultScore}>Score: {score}</Text>
            <Text style={styles.resultSub}>
              {gameResult === 'win'
                ? `Goal reached! ${score}/${targetScore}`
                : `Try again! Day ${dailyLevel + 1} unlocks tomorrow.`}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingVertical: 10, justifyContent: 'space-between',
  },
  iconBtn: { padding: 6 },
  headerCenter: { alignItems: 'center' },
  title: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold' },
  dailyBadge: {
    color: '#F59E0B', fontSize: 10, fontFamily: 'Inter_600SemiBold',
    backgroundColor: '#F59E0B22', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 10, marginTop: 2,
  },
  movesBox: { alignItems: 'center', minWidth: 44 },
  movesNum: { color: '#fff', fontSize: 24, fontFamily: 'Inter_700Bold' },
  movesLabel: { color: '#555', fontSize: 10, fontFamily: 'Inter_400Regular' },
  scoreArea: { paddingHorizontal: 20, paddingBottom: 8, gap: 6 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreText: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold' },
  targetText: { color: '#444', fontSize: 14, fontFamily: 'Inter_400Regular' },
  comboBadge: {
    backgroundColor: '#F59E0B', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 2, marginLeft: 'auto' as any,
  },
  comboText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_700Bold' },
  progressTrack: { height: 7, borderRadius: 4, backgroundColor: '#1a1a2e', overflow: 'hidden' },
  progressFill: { height: 7, borderRadius: 4, backgroundColor: '#F59E0B' },
  gridContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { position: 'relative' },
  cell: {
    position: 'absolute',
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fruitEmoji: { fontSize: 22, lineHeight: CELL_SIZE },
  instruction: { alignItems: 'center', gap: 3, paddingBottom: 4 },
  instructionText: { color: '#666', fontSize: 11, fontFamily: 'Inter_400Regular' },
  levelInfo: { color: '#2a2a3a', fontSize: 10, fontFamily: 'Inter_400Regular' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center', justifyContent: 'center',
  },
  shufflingCard: {
    backgroundColor: '#0f1020', borderRadius: 24, padding: 36,
    alignItems: 'center', gap: 10, width: '80%',
    borderWidth: 1, borderColor: '#2a2a4a',
  },
  shuffleEmoji: { fontSize: 52 },
  shufflingTitle: { color: '#fff', fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 4 },
  shufflingSub: { color: '#888', fontSize: 13, fontFamily: 'Inter_400Regular' },
  shuffleDots: { flexDirection: 'row', gap: 8, marginTop: 6 },
  shuffleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6366F1' },
  resultCard: {
    backgroundColor: '#0f1020', borderRadius: 24, padding: 32,
    alignItems: 'center', gap: 12, width: '84%',
    borderWidth: 1, borderColor: '#2a2a4a',
  },
  resultEmoji: { fontSize: 56 },
  resultTitle: { color: '#fff', fontSize: 26, fontFamily: 'Inter_700Bold' },
  resultScore: { color: '#F59E0B', fontSize: 22, fontFamily: 'Inter_700Bold' },
  resultSub: { color: '#555', fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  resultBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#6366F1', paddingVertical: 14, paddingHorizontal: 32,
    borderRadius: 16, marginTop: 8,
  },
  resultBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
});
