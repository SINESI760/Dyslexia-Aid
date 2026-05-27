import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Animated, Pressable, StyleSheet, Text, View,
  Platform, ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';

// ── Animals pool (16 unique animals — enough for all rounds) ────────────────
const ANIMALS = [
  '🐶', '🐱', '🐸', '🦊', '🐻', '🐼', '🐯', '🦁',
  '🐮', '🐷', '🐨', '🐧', '🦆', '🐢', '🦋', '🐝',
];

// ── Round configurations ────────────────────────────────────────────────────
const ROUND_CONFIG = [
  { round: 1, pairs: 3, cols: 3, label: '3 × 2', desc: 'Warm-up' },
  { round: 2, pairs: 4, cols: 4, label: '4 × 2', desc: 'Getting warmer' },
  { round: 3, pairs: 8, cols: 4, label: '4 × 4', desc: 'Expert' },
];

// ── Types ───────────────────────────────────────────────────────────────────
interface Card {
  id: string;
  emoji: string;
  pairId: number;
  isFlipped: boolean;
  isMatched: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Flip card component ─────────────────────────────────────────────────────
function FlipCard({
  card,
  onPress,
  size,
  colors,
  disabled,
}: {
  card: Card;
  onPress: () => void;
  size: number;
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
  disabled: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [showFront, setShowFront] = useState(card.isFlipped || card.isMatched);

  useEffect(() => {
    const shouldShow = card.isFlipped || card.isMatched;
    if (shouldShow === showFront) return;
    Animated.timing(scaleAnim, { toValue: 0, duration: 110, useNativeDriver: false }).start(() => {
      setShowFront(shouldShow);
      Animated.timing(scaleAnim, { toValue: 1, duration: 130, useNativeDriver: false }).start();
    });
  }, [card.isFlipped, card.isMatched]);

  const bgColor = card.isMatched
    ? `${colors.success}22`
    : showFront
      ? colors.card
      : colors.primary;
  const borderColor = card.isMatched ? colors.success : showFront ? colors.border : colors.primary;

  return (
    <Animated.View style={{ transform: [{ scaleX: scaleAnim }], margin: 4 }}>
      <Pressable
        onPress={onPress}
        disabled={disabled || card.isFlipped || card.isMatched}
        style={[
          styles.card,
          {
            width: size, height: size,
            backgroundColor: bgColor, borderColor, borderWidth: 2,
          },
        ]}
      >
        {showFront ? (
          <Text style={[styles.animalEmoji, { fontSize: size * 0.48 }]}>{card.emoji}</Text>
        ) : (
          <Text style={[styles.backIcon, { fontSize: size * 0.38 }]}>?</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────
export default function CardMatchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ gameId: string }>();
  const gameId = params.gameId ?? 'card-match-default';
  const topPad = Platform.OS === 'web' ? 60 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const [roundIdx, setRoundIdx] = useState(0);
  const roundCfg = ROUND_CONFIG[roundIdx];

  const [cards, setCards] = useState<Card[]>([]);
  const [flippedIds, setFlippedIds] = useState<string[]>([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [moves, setMoves] = useState(0);
  const [totalMoves, setTotalMoves] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [roundComplete, setRoundComplete] = useState(false);
  const [gameComplete, setGameComplete] = useState(false);
  const [startTime] = useState(Date.now());

  const buildRound = useCallback((cfg: typeof ROUND_CONFIG[0]) => {
    // Pick animals for this round from the pool (offset by prior rounds)
    const offset = ROUND_CONFIG.slice(0, cfg.round - 1).reduce((s, c) => s + c.pairs, 0);
    const picked = ANIMALS.slice(offset, offset + cfg.pairs);
    const allCards: Card[] = [];
    picked.forEach((emoji, i) => {
      allCards.push({ id: `a-${cfg.round}-${i}`, emoji, pairId: i, isFlipped: false, isMatched: false });
      allCards.push({ id: `b-${cfg.round}-${i}`, emoji, pairId: i, isFlipped: false, isMatched: false });
    });
    setCards(shuffle(allCards));
    setFlippedIds([]);
    setMatchedPairs(0);
    setMoves(0);
    setIsChecking(false);
    setRoundComplete(false);
  }, []);

  useEffect(() => { buildRound(ROUND_CONFIG[0]); }, []);

  const handleCardPress = (card: Card) => {
    if (isChecking || card.isFlipped || card.isMatched || flippedIds.length >= 2) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const newFlipped = [...flippedIds, card.id];
    setFlippedIds(newFlipped);
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, isFlipped: true } : c));

    if (newFlipped.length === 2) {
      setIsChecking(true);
      setMoves(m => m + 1);
      setTotalMoves(m => m + 1);
      const [id1, id2] = newFlipped;
      const c1 = cards.find(c => c.id === id1)!;
      const c2 = card;

      setTimeout(() => {
        if (c1.pairId === c2.pairId) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setCards(prev => prev.map(c =>
            c.id === id1 || c.id === c2.id ? { ...c, isMatched: true, isFlipped: true } : c
          ));
          const newMatched = matchedPairs + 1;
          setMatchedPairs(newMatched);
          setTotalMatches(t => t + 1);
          if (newMatched >= roundCfg.pairs) {
            setTimeout(() => {
              if (roundIdx === ROUND_CONFIG.length - 1) {
                setGameComplete(true);
              } else {
                setRoundComplete(true);
              }
            }, 500);
          }
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setCards(prev => prev.map(c =>
            c.id === id1 || c.id === c2.id ? { ...c, isFlipped: false } : c
          ));
        }
        setFlippedIds([]);
        setIsChecking(false);
      }, 900);
    }
  };

  const handleNextRound = () => {
    const next = roundIdx + 1;
    setRoundIdx(next);
    buildRound(ROUND_CONFIG[next]);
  };

  const handleFinish = () => {
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const totalPairs = ROUND_CONFIG.reduce((s, c) => s + c.pairs, 0);
    const accuracy = Math.max(0, Math.round(100 - (totalMoves - totalMatches) * 8));
    const score = Math.max(0, (totalPairs * 80) - (totalMoves - totalMatches) * 10);
    const xpEarned = Math.round(score / 8) + 20;
    router.replace(
      `/games/complete?gameId=${gameId}&gameType=card-match&score=${score}&accuracy=${accuracy}&timeSpent=${timeSpent}&level=3&xpEarned=${xpEarned}`
    );
  };

  // ── Layout ──────────────────────────────────────────────────────────────
  const { cols, pairs } = roundCfg;
  const SCREEN_W = 390;
  const cardSize = Math.floor((SCREEN_W - 48 - cols * 8) / cols);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="x" size={22} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.title, { color: colors.foreground }]}>Card Match</Text>
          <View style={styles.roundPills}>
            {ROUND_CONFIG.map((r, i) => (
              <View
                key={r.round}
                style={[
                  styles.roundPill,
                  {
                    backgroundColor: i < roundIdx
                      ? colors.success
                      : i === roundIdx
                        ? colors.primary
                        : colors.muted,
                  },
                ]}
              >
                <Text style={[
                  styles.roundPillText,
                  { color: i <= roundIdx ? '#fff' : colors.mutedForeground },
                ]}>
                  {i < roundIdx ? '✓' : `R${r.round}`}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <View style={[styles.movesBadge, { backgroundColor: colors.muted }]}>
          <Text style={[styles.movesText, { color: colors.foreground }]}>{moves} moves</Text>
        </View>
      </View>

      {/* Round info + pair dots */}
      <View style={styles.roundInfo}>
        <Text style={[styles.roundLabel, { color: colors.primary }]}>
          Round {roundCfg.round} · {roundCfg.label} · {roundCfg.desc}
        </Text>
        <View style={styles.pairsRow}>
          {Array.from({ length: pairs }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.pairDot,
                { backgroundColor: i < matchedPairs ? colors.success : colors.muted },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Hint */}
      <View style={[styles.hint, { backgroundColor: colors.muted }]}>
        <Feather name="info" size={13} color={colors.mutedForeground} />
        <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
          Tap two cards to find matching animals
        </Text>
      </View>

      {/* Grid */}
      <ScrollView contentContainerStyle={[styles.gridScroll, { paddingBottom: botPad + 20 }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.gridInner, { maxWidth: cols * (cardSize + 8) + 16 }]}>
          {cards.map(card => (
            <FlipCard
              key={card.id}
              card={card}
              onPress={() => handleCardPress(card)}
              size={cardSize}
              colors={colors}
              disabled={isChecking}
            />
          ))}
        </View>
      </ScrollView>

      {/* Round complete overlay */}
      {roundComplete && (
        <View style={[styles.overlay, { backgroundColor: `${colors.background}EE` }]}>
          <View style={[styles.doneCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={styles.doneEmoji}>🎉</Text>
            <Text style={[styles.doneTitle, { color: colors.foreground }]}>
              Round {roundCfg.round} Complete!
            </Text>
            <Text style={[styles.doneSub, { color: colors.mutedForeground }]}>
              {pairs} pairs matched in {moves} moves
            </Text>
            <View style={[styles.nextRoundInfo, { backgroundColor: colors.muted }]}>
              <Text style={[styles.nextRoundText, { color: colors.foreground }]}>
                Up next: Round {roundIdx + 2} · {ROUND_CONFIG[roundIdx + 1]?.label}
              </Text>
            </View>
            <Pressable
              onPress={handleNextRound}
              style={[styles.doneBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.doneBtnText, { color: colors.primaryForeground }]}>
                Next Round
              </Text>
              <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
            </Pressable>
          </View>
        </View>
      )}

      {/* Game complete overlay */}
      {gameComplete && (
        <View style={[styles.overlay, { backgroundColor: `${colors.background}EE` }]}>
          <View style={[styles.doneCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={styles.doneEmoji}>🏆</Text>
            <Text style={[styles.doneTitle, { color: colors.foreground }]}>All 3 Rounds Done!</Text>
            <Text style={[styles.doneSub, { color: colors.mutedForeground }]}>
              Total: {totalMoves} moves · {totalMatches} pairs found
            </Text>
            <View style={[styles.statsRow, { backgroundColor: colors.muted }]}>
              <View style={styles.stat}>
                <Text style={[styles.statNum, { color: colors.primary }]}>{totalMoves}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Moves</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.stat}>
                <Text style={[styles.statNum, { color: colors.success }]}>{totalMatches}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Pairs</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.stat}>
                <Text style={[styles.statNum, { color: colors.warning }]}>
                  {Math.max(0, Math.round(100 - (totalMoves - totalMatches) * 8))}%
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Accuracy</Text>
              </View>
            </View>
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
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingVertical: 10, justifyContent: 'space-between',
  },
  backBtn: { padding: 6 },
  headerCenter: { alignItems: 'center', gap: 6 },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  roundPills: { flexDirection: 'row', gap: 6 },
  roundPill: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20,
    minWidth: 34, alignItems: 'center',
  },
  roundPillText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  movesBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  movesText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  roundInfo: { alignItems: 'center', gap: 8, paddingBottom: 4 },
  roundLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  pairsRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  pairDot: { width: 12, height: 12, borderRadius: 6 },
  hint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 20, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
  },
  hintText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  gridScroll: { flexGrow: 1, paddingVertical: 8 },
  gridInner: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', alignSelf: 'center',
  },
  card: {
    borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  animalEmoji: { textAlign: 'center' },
  backIcon: {
    fontFamily: 'Inter_700Bold', color: '#ffffff99', textAlign: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center',
  },
  doneCard: {
    padding: 28, alignItems: 'center', gap: 12, width: '88%',
    borderRadius: 24, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 20, elevation: 10,
  },
  doneEmoji: { fontSize: 52 },
  doneTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  doneSub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  nextRoundInfo: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, width: '100%',
    alignItems: 'center',
  },
  nextRoundText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  doneBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 4, paddingVertical: 13, paddingHorizontal: 32, borderRadius: 16,
  },
  doneBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, overflow: 'hidden', width: '100%',
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statNum: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  statDivider: { width: 1, height: '60%' },
});
