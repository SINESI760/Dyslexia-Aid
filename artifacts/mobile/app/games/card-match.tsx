import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Animated, Pressable, StyleSheet, Text, View,
  Platform, ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { CARD_PAIRS_BY_LEVEL } from '@/constants/games';
import * as Haptics from 'expo-haptics';

interface Card {
  id: string;
  value: string;
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

export default function CardMatchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ gameId: string; level: string }>();
  const level = Math.min(3, Math.max(1, parseInt(params.level ?? '1')));
  const gameId = params.gameId ?? 'card-match-default';
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const pairsData = CARD_PAIRS_BY_LEVEL[level] ?? CARD_PAIRS_BY_LEVEL[1];
  const pairCount = level === 1 ? 3 : level === 2 ? 5 : 6;

  const [cards, setCards] = useState<Card[]>([]);
  const [flippedIds, setFlippedIds] = useState<string[]>([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [moves, setMoves] = useState(0);
  const [startTime] = useState(Date.now());
  const [gameOver, setGameOver] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const flipAnims = useRef<Record<string, Animated.Value>>({});

  const initGame = useCallback(() => {
    const selected = pairsData.slice(0, pairCount);
    const allCards: Card[] = [];
    selected.forEach((pair, i) => {
      allCards.push({ id: `w-${i}`, value: pair.word, pairId: i, isFlipped: false, isMatched: false });
      allCards.push({ id: `m-${i}`, value: pair.match, pairId: i, isFlipped: false, isMatched: false });
    });
    const shuffled = shuffle(allCards);
    shuffled.forEach((c) => {
      flipAnims.current[c.id] = new Animated.Value(0);
    });
    setCards(shuffled);
    setFlippedIds([]);
    setMatchedPairs(0);
    setMoves(0);
    setGameOver(false);
    setIsChecking(false);
  }, [pairCount, pairsData]);

  useEffect(() => { initGame(); }, []);

  const flipCard = (id: string) => {
    Animated.spring(flipAnims.current[id], {
      toValue: 1, useNativeDriver: false, tension: 60, friction: 8,
    }).start();
  };

  const unflipCard = (id: string) => {
    Animated.spring(flipAnims.current[id], {
      toValue: 0, useNativeDriver: false, tension: 60, friction: 8,
    }).start();
  };

  const handleCardPress = (card: Card) => {
    if (isChecking || card.isFlipped || card.isMatched || flippedIds.length >= 2) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    flipCard(card.id);

    const newFlipped = [...flippedIds, card.id];
    setFlippedIds(newFlipped);
    setCards((prev) => prev.map((c) => c.id === card.id ? { ...c, isFlipped: true } : c));

    if (newFlipped.length === 2) {
      setIsChecking(true);
      setMoves((m) => m + 1);
      const [id1, id2] = newFlipped;
      const c1 = cards.find((c) => c.id === id1)!;
      const c2 = { ...card, id: card.id };

      setTimeout(() => {
        if (c1.pairId === c2.pairId) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setCards((prev) => prev.map((c) =>
            c.id === id1 || c.id === id2 ? { ...c, isMatched: true } : c
          ));
          const newMatched = matchedPairs + 1;
          setMatchedPairs(newMatched);
          if (newMatched >= pairCount) {
            setGameOver(true);
          }
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          unflipCard(id1);
          unflipCard(id2);
          setCards((prev) => prev.map((c) =>
            c.id === id1 || c.id === id2 ? { ...c, isFlipped: false } : c
          ));
        }
        setFlippedIds([]);
        setIsChecking(false);
      }, 900);
    }
  };

  const handleFinish = () => {
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const accuracy = Math.max(0, Math.round(100 - (moves - pairCount) * 10));
    const score = Math.max(0, (pairCount * 100) - (moves - pairCount) * 20);
    const xpEarned = Math.round(score / 10) + 10;
    router.replace(
      `/games/complete?gameId=${gameId}&gameType=card-match&score=${score}&accuracy=${accuracy}&timeSpent=${timeSpent}&level=${level}&xpEarned=${xpEarned}`
    );
  };

  const cols = level === 1 ? 2 : 3;
  const cardWidth = `${Math.floor(92 / cols)}%`;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="x" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Card Match</Text>
        <View style={[styles.movesBadge, { backgroundColor: colors.muted }]}>
          <Text style={[styles.movesText, { color: colors.foreground }]}>{moves} moves</Text>
        </View>
      </View>

      <View style={styles.pairsRow}>
        {Array.from({ length: pairCount }).map((_, i) => (
          <View
            key={i}
            style={[styles.pairDot, {
              backgroundColor: i < matchedPairs ? colors.success : colors.muted,
            }]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        <View style={styles.gridInner}>
          {cards.map((card) => {
            const anim = flipAnims.current[card.id];
            if (!anim) return null;

            const frontInterpolate = anim.interpolate({
              inputRange: [0, 0.5, 1], outputRange: ['180deg', '90deg', '0deg'],
            });
            const backInterpolate = anim.interpolate({
              inputRange: [0, 0.5, 1], outputRange: ['0deg', '90deg', '180deg'],
            });

            return (
              <Pressable
                key={card.id}
                onPress={() => handleCardPress(card)}
                style={[styles.card, { width: cardWidth as any }]}
              >
                <Animated.View
                  style={[styles.cardFace, styles.cardBack, {
                    backgroundColor: card.isMatched ? `${colors.success}22` : colors.card,
                    borderColor: card.isMatched ? colors.success : colors.border,
                    transform: [{ rotateY: frontInterpolate }],
                  }]}
                >
                  <Text style={[styles.cardText, { color: card.isMatched ? colors.success : colors.foreground }]}>
                    {card.value}
                  </Text>
                </Animated.View>
                <Animated.View
                  style={[styles.cardFace, styles.cardFront, {
                    backgroundColor: colors.primary,
                    transform: [{ rotateY: backInterpolate }],
                  }]}
                >
                  <Feather name="help-circle" size={28} color={colors.primaryForeground} />
                </Animated.View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {gameOver && (
        <View style={[styles.overlay, { backgroundColor: `${colors.background}EE` }]}>
          <View style={[styles.doneCard, { backgroundColor: colors.card, borderRadius: 24 }]}>
            <Feather name="star" size={40} color={colors.warning} />
            <Text style={[styles.doneTitle, { color: colors.foreground }]}>All matched!</Text>
            <Text style={[styles.doneSub, { color: colors.mutedForeground }]}>
              Completed in {moves} moves
            </Text>
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
  backBtn: { padding: 6 },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  movesBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  movesText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  pairsRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 8,
    paddingVertical: 8,
  },
  pairDot: { width: 12, height: 12, borderRadius: 6 },
  grid: { padding: 16, flexGrow: 1 },
  gridInner: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  card: { aspectRatio: 1, perspective: '1000px' as any },
  cardFace: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 14, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    backfaceVisibility: 'hidden',
  },
  cardFront: {},
  cardBack: {},
  cardText: { fontSize: 16, fontFamily: 'Inter_700Bold', textAlign: 'center', padding: 4 },
  overlay: {
    ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center',
  },
  doneCard: {
    padding: 32, alignItems: 'center', gap: 12, width: '80%',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, elevation: 10,
  },
  doneTitle: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  doneSub: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  doneBtn: { marginTop: 8, paddingVertical: 14, paddingHorizontal: 40, borderRadius: 16 },
  doneBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});
