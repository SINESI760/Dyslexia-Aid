import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Animated, Pressable, StyleSheet, Text, View, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { WORDS_BY_LEVEL } from '@/constants/games';
import * as Haptics from 'expo-haptics';

// ── Constants ──────────────────────────────────────────────────────────────
const BLOCK_H = 48;
const BASE_H = 20;
const LAYER_COLORS = ['#FF6B6B', '#FECA57', '#48DBFB', '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface StackLayer {
  x: number;
  width: number;
  color: string;
  letter: string;
}

export default function CakeTowerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ gameId: string; level: string }>();
  const level = Math.min(5, Math.max(1, parseInt(params.level ?? '1')));
  const gameId = params.gameId ?? 'cake-tower-default';
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  // ── Word list (stable) ──
  const [words] = useState<string[]>(() => {
    const pool = WORDS_BY_LEVEL[level] ?? WORDS_BY_LEVEL[1];
    return shuffle(pool).slice(0, 3);
  });

  const [wordIdx, setWordIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [startTime] = useState(Date.now());
  const [lives, setLives] = useState(3);
  const [gamePhase, setGamePhase] = useState<'playing' | 'complete' | 'gameover' | 'nextword'>('playing');
  const [flashMsg, setFlashMsg] = useState<string | null>(null);

  // ── Container measurement ──
  const [containerW, setContainerW] = useState(320);
  const containerReady = containerW > 100;

  // ── Stack state for current word ──
  const currentWord = words[wordIdx] ?? 'CAT';
  const letters = currentWord.split('');
  const initialBlockW = useRef(0);

  const [stackLayers, setStackLayers] = useState<StackLayer[]>([]);
  const [currentLetterIdx, setCurrentLetterIdx] = useState(0);
  const [currentBlockW, setCurrentBlockW] = useState(0);
  const [sweepDuration, setSweepDuration] = useState(1600);

  // ── Sweep animation ──
  const blockX = useRef(new Animated.Value(0)).current;
  const blockXRef = useRef(0);
  const sweepAnim = useRef<Animated.CompositeAnimation | null>(null);
  const activeRef = useRef(true);

  // Track blockX value via listener
  useEffect(() => {
    const id = blockX.addListener(({ value }) => { blockXRef.current = value; });
    return () => blockX.removeListener(id);
  }, [blockX]);

  // Init block width once container is measured
  useEffect(() => {
    if (!containerReady || initialBlockW.current > 0) return;
    const w = Math.round(containerW * 0.68);
    initialBlockW.current = w;
    setCurrentBlockW(w);
  }, [containerReady, containerW]);

  // Start/restart sweep when block width is ready & game is playing
  const startSweep = useCallback((maxX: number, duration: number) => {
    sweepAnim.current?.stop();
    blockX.setValue(0);
    sweepAnim.current = Animated.loop(
      Animated.sequence([
        Animated.timing(blockX, { toValue: maxX, duration, useNativeDriver: false }),
        Animated.timing(blockX, { toValue: 0, duration, useNativeDriver: false }),
      ])
    );
    sweepAnim.current.start();
  }, [blockX]);

  useEffect(() => {
    if (!containerReady || currentBlockW === 0 || gamePhase !== 'playing') return;
    const maxX = containerW - currentBlockW;
    startSweep(maxX, sweepDuration);
    return () => { sweepAnim.current?.stop(); };
  }, [containerW, currentBlockW, sweepDuration, gamePhase, containerReady, startSweep]);

  // ── Drop handler ──
  const handleDrop = useCallback(() => {
    if (gamePhase !== 'playing' || currentBlockW === 0) return;

    sweepAnim.current?.stop();
    const dropX = blockXRef.current;

    const topLayer = stackLayers.length > 0
      ? stackLayers[stackLayers.length - 1]
      : { x: 0, width: containerW }; // base platform

    // Calculate overlap
    const leftEdge = Math.max(dropX, topLayer.x);
    const rightEdge = Math.min(dropX + currentBlockW, topLayer.x + topLayer.width);
    const overlap = rightEdge - leftEdge;

    if (overlap <= 8) {
      // Missed — lose a life
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const newLives = lives - 1;
      setLives(newLives);
      setFlashMsg('MISS!');
      setTimeout(() => setFlashMsg(null), 700);

      if (newLives <= 0) {
        sweepAnim.current?.stop();
        setGamePhase('gameover');
        return;
      }
      // Resume sweep from beginning
      const maxX = containerW - currentBlockW;
      startSweep(maxX, sweepDuration);
      return;
    }

    // Good drop!
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newLayer: StackLayer = {
      x: leftEdge,
      width: overlap,
      color: LAYER_COLORS[currentLetterIdx % LAYER_COLORS.length],
      letter: letters[currentLetterIdx],
    };

    const newStack = [...stackLayers, newLayer];
    setStackLayers(newStack);

    const pointsEarned = Math.round((overlap / currentBlockW) * 20);
    setScore((s) => s + pointsEarned);

    const nextLetterIdx = currentLetterIdx + 1;

    if (nextLetterIdx >= letters.length) {
      // Word complete!
      sweepAnim.current?.stop();
      setGamePhase('nextword');
      setWordsCompleted((w) => w + 1);
      setScore((s) => s + 30); // bonus
      setFlashMsg('WORD COMPLETE! 🎂');
      setTimeout(() => {
        setFlashMsg(null);
        const nextWordIdx = wordIdx + 1;
        if (nextWordIdx >= words.length) {
          setGamePhase('complete');
        } else {
          // Reset for next word
          setWordIdx(nextWordIdx);
          setStackLayers([]);
          setCurrentLetterIdx(0);
          setCurrentBlockW(initialBlockW.current);
          setSweepDuration((d) => Math.max(800, d - 150));
          setGamePhase('playing');
        }
      }, 1500);
      return;
    }

    // Next letter — block narrows slightly
    const newBlockW = Math.max(60, overlap);
    setCurrentBlockW(newBlockW);
    setCurrentLetterIdx(nextLetterIdx);
    // Speed up slightly each layer
    const newDuration = Math.max(600, sweepDuration - 80);
    setSweepDuration(newDuration);

    const newMaxX = containerW - newBlockW;
    startSweep(newMaxX, newDuration);
  }, [
    gamePhase, currentBlockW, containerW, stackLayers, lives,
    currentLetterIdx, letters, wordIdx, words, sweepDuration, startSweep,
  ]);

  const handleFinish = () => {
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const accuracy = Math.round((wordsCompleted / words.length) * 100);
    const xpEarned = Math.round(score / 5) + 10;
    router.replace(
      `/games/complete?gameId=${gameId}&gameType=cake-tower&score=${score}&accuracy=${accuracy}&timeSpent=${timeSpent}&level=${level}&xpEarned=${xpEarned}`
    );
  };

  // Tower visual height
  const towerVisualH = letters.length * BLOCK_H + BASE_H + 8;
  const towerMaxH = Math.max(towerVisualH, 240);

  return (
    <View style={[styles.container, { backgroundColor: '#1a1030', paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => { sweepAnim.current?.stop(); router.back(); }} style={styles.headerBtn}>
          <Feather name="x" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.titleText}>Cake Tower</Text>
        <View style={styles.lives}>
          {[0, 1, 2].map((i) => (
            <Feather key={i} name="heart" size={18} color={i < lives ? '#EF4444' : '#333'} />
          ))}
        </View>
      </View>

      {/* Word display */}
      <View style={styles.wordRow}>
        {letters.map((letter, i) => {
          const placed = i < currentLetterIdx || gamePhase === 'nextword';
          const current = i === currentLetterIdx && gamePhase === 'playing';
          return (
            <View
              key={i}
              style={[
                styles.letterBox,
                {
                  backgroundColor: placed
                    ? LAYER_COLORS[i % LAYER_COLORS.length]
                    : current ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
                  borderColor: current ? '#fff' : 'transparent',
                  borderWidth: current ? 2 : 0,
                },
              ]}
            >
              <Text style={[styles.letterBoxText, { color: placed || current ? '#fff' : '#444' }]}>
                {placed || current ? letter : '?'}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.instructionText}>
        Word {wordIdx + 1}/{words.length} · Next letter:{' '}
        <Text style={{ color: LAYER_COLORS[currentLetterIdx % LAYER_COLORS.length], fontFamily: 'Inter_700Bold' }}>
          {letters[currentLetterIdx] ?? '✓'}
        </Text>
      </Text>

      {/* Tower + sweeping block — the main game area */}
      <Pressable
        style={styles.gameArea}
        onPress={handleDrop}
        onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
      >
        {/* Tower stack (grows from bottom) */}
        <View style={[styles.towerContainer, { height: towerMaxH }]}>
          {/* Base plate */}
          <View
            style={[
              styles.base,
              { bottom: 0, width: containerW, backgroundColor: '#333' },
            ]}
          />

          {/* Placed layers */}
          {stackLayers.map((layer, i) => (
            <View
              key={i}
              style={[
                styles.block,
                {
                  bottom: BASE_H + i * BLOCK_H,
                  left: layer.x,
                  width: layer.width,
                  backgroundColor: layer.color,
                  height: BLOCK_H - 4,
                  borderRadius: 8,
                },
              ]}
            >
              <Text style={styles.blockLetter}>{layer.letter}</Text>
            </View>
          ))}

          {/* Moving block (sweeps left-right) */}
          {gamePhase === 'playing' && currentBlockW > 0 && containerReady && (
            <Animated.View
              style={[
                styles.block,
                {
                  bottom: BASE_H + stackLayers.length * BLOCK_H,
                  left: blockX,
                  width: currentBlockW,
                  height: BLOCK_H - 4,
                  borderRadius: 8,
                  backgroundColor: LAYER_COLORS[currentLetterIdx % LAYER_COLORS.length],
                  opacity: 0.9,
                  borderWidth: 2,
                  borderColor: '#fff',
                },
              ]}
            >
              <Text style={styles.blockLetter}>{letters[currentLetterIdx]}</Text>
            </Animated.View>
          )}
        </View>

        {/* Tap instruction */}
        {gamePhase === 'playing' && (
          <View style={styles.tapHint}>
            <Feather name="chevrons-down" size={20} color="rgba(255,255,255,0.5)" />
            <Text style={styles.tapHintText}>TAP ANYWHERE TO DROP</Text>
            <Feather name="chevrons-down" size={20} color="rgba(255,255,255,0.5)" />
          </View>
        )}

        {/* Flash message */}
        {flashMsg && (
          <View style={styles.flashOverlay}>
            <Text style={styles.flashText}>{flashMsg}</Text>
          </View>
        )}
      </Pressable>

      {/* Score bar */}
      <View style={[styles.scoreBar, { paddingBottom: botPad + 8 }]}>
        <Feather name="zap" size={16} color="#F59E0B" />
        <Text style={styles.scoreText}>Score: {score}</Text>
        <Text style={styles.wordCountText}>{wordsCompleted}/{words.length} words</Text>
      </View>

      {/* Game Over / Complete overlay */}
      {(gamePhase === 'gameover' || gamePhase === 'complete') && (
        <View style={styles.overlay}>
          <View style={styles.doneCard}>
            <Feather
              name={gamePhase === 'complete' ? 'award' : 'x-circle'}
              size={48}
              color={gamePhase === 'complete' ? '#FECA57' : '#EF4444'}
            />
            <Text style={styles.doneTitle}>
              {gamePhase === 'complete' ? 'Tower Built! 🎂' : 'Tower Fell!'}
            </Text>
            <Text style={styles.doneScore}>Score: {score}</Text>
            <Text style={styles.doneSub}>
              {wordsCompleted} of {words.length} words completed
            </Text>
            <Pressable onPress={handleFinish} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>Continue</Text>
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
  headerBtn: { padding: 4 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingVertical: 12, justifyContent: 'space-between',
  },
  titleText: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold' },
  lives: { flexDirection: 'row', gap: 6 },
  wordRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 8,
    paddingHorizontal: 20, paddingTop: 4,
  },
  letterBox: {
    width: 38, height: 42, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  letterBoxText: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  instructionText: {
    color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: 'Inter_400Regular',
    textAlign: 'center', marginTop: 6, marginBottom: 4,
  },
  gameArea: {
    flex: 1, paddingHorizontal: 16, justifyContent: 'flex-end',
  },
  towerContainer: {
    position: 'relative', width: '100%',
  },
  base: {
    position: 'absolute', height: BASE_H, borderRadius: 6,
  },
  block: {
    position: 'absolute',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },
  blockLetter: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold' },
  tapHint: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 14,
  },
  tapHintText: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },
  flashOverlay: {
    position: 'absolute', top: '30%', left: 0, right: 0,
    alignItems: 'center',
  },
  flashText: { color: '#fff', fontSize: 28, fontFamily: 'Inter_700Bold', textShadowColor: '#000', textShadowRadius: 8 },
  scoreBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingTop: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  scoreText: { color: '#F59E0B', fontSize: 16, fontFamily: 'Inter_700Bold' },
  wordCountText: { color: '#aaa', fontSize: 13, fontFamily: 'Inter_400Regular', marginLeft: 'auto' as any },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center', justifyContent: 'center',
  },
  doneCard: {
    backgroundColor: '#1e1445', borderRadius: 24, padding: 32,
    alignItems: 'center', gap: 12, width: '82%',
    borderWidth: 1, borderColor: '#333',
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, elevation: 20,
  },
  doneTitle: { color: '#fff', fontSize: 26, fontFamily: 'Inter_700Bold' },
  doneScore: { color: '#FECA57', fontSize: 22, fontFamily: 'Inter_700Bold' },
  doneSub: { color: '#aaa', fontSize: 14, fontFamily: 'Inter_400Regular' },
  doneBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#6366F1', paddingVertical: 14, paddingHorizontal: 36,
    borderRadius: 16, marginTop: 8,
  },
  doneBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
});
