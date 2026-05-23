import React, { useState, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View, Platform, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { WORDS_BY_LEVEL } from '@/constants/games';
import * as Haptics from 'expo-haptics';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const LAYER_COLORS = ['#FF6B6B', '#FECA57', '#48DBFB', '#FF9FF3', '#54A0FF', '#5F27CD'];

interface Layer {
  id: string;
  letter: string;
  color: string;
  placed: boolean;
}

export default function CakeTowerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ gameId: string; level: string }>();
  const level = Math.min(5, Math.max(1, parseInt(params.level ?? '1')));
  const gameId = params.gameId ?? 'cake-tower-default';
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const wordPool = WORDS_BY_LEVEL[level] ?? WORDS_BY_LEVEL[1];
  const wordsToPlay = shuffle(wordPool).slice(0, 3);

  const [roundIdx, setRoundIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [startTime] = useState(Date.now());
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [wrongLetter, setWrongLetter] = useState<string | null>(null);
  const [towerLayers, setTowerLayers] = useState<Layer[]>([]);

  const currentWord = wordsToPlay[roundIdx];
  const sortedLetters = [...currentWord].sort();

  const makeLayers = (word: string): Layer[] =>
    shuffle([...word]).map((l, i) => ({
      id: `${i}-${l}-${Date.now()}`,
      letter: l,
      color: LAYER_COLORS[i % LAYER_COLORS.length],
      placed: false,
    }));

  const [layers, setLayers] = useState<Layer[]>(() => makeLayers(currentWord));

  const handleLayerTap = useCallback((layer: Layer) => {
    if (layer.placed || feedback) return;
    const expectedIdx = towerLayers.length;
    const expectedLetter = sortedLetters[expectedIdx];

    if (layer.letter === expectedLetter) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const newTower = [...towerLayers, layer];
      setTowerLayers(newTower);
      setLayers((prev) => prev.map((l) => l.id === layer.id ? { ...l, placed: true } : l));

      if (newTower.length === currentWord.length) {
        setFeedback('correct');
        setScore((s) => s + 30);
        setCorrect((c) => c + 1);
        goNext(1, 30);
      }
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setFeedback('wrong');
      setWrongLetter(layer.letter);
      setTimeout(() => {
        setFeedback(null);
        setWrongLetter(null);
      }, 800);
    }
  }, [towerLayers, sortedLetters, currentWord, feedback]);

  const goNext = useCallback((incCorrect: number, incScore: number) => {
    const next = roundIdx + 1;
    if (next >= wordsToPlay.length) {
      const timeSpent = Math.round((Date.now() - startTime) / 1000);
      const totalCorrect = correct + incCorrect;
      const accuracy = Math.round((totalCorrect / wordsToPlay.length) * 100);
      const finalScore = score + incScore;
      const xpEarned = Math.round(finalScore / 5) + 10;
      setTimeout(() => {
        router.replace(
          `/games/complete?gameId=${gameId}&gameType=cake-tower&score=${finalScore}&accuracy=${accuracy}&timeSpent=${timeSpent}&level=${level}&xpEarned=${xpEarned}`
        );
      }, 1000);
    } else {
      const nextWord = wordsToPlay[next];
      setTimeout(() => {
        setRoundIdx(next);
        setLayers(makeLayers(nextWord));
        setTowerLayers([]);
        setFeedback(null);
      }, 1000);
    }
  }, [roundIdx, wordsToPlay, correct, score, startTime, gameId, level]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Feather name="x" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Cake Tower</Text>
        <View style={[styles.badge, { backgroundColor: colors.muted }]}>
          <Text style={[styles.badgeText, { color: colors.foreground }]}>
            {roundIdx + 1}/{wordsToPlay.length}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 20 }]}>
        <View style={[styles.infoBox, { backgroundColor: colors.muted, borderRadius: 14 }]}>
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Stack the letters in alphabetical order (A to Z)
          </Text>
          <Text style={[styles.nextHint, { color: colors.primary }]}>
            Next: {sortedLetters[towerLayers.length] ?? '?'}
          </Text>
        </View>

        <View style={styles.towerArea}>
          {towerLayers.length === 0 ? (
            <View style={[styles.plate, { backgroundColor: colors.muted }]}>
              <Text style={[styles.plateText, { color: colors.mutedForeground }]}>
                Tap layers below to stack here
              </Text>
            </View>
          ) : (
            <View style={styles.tower}>
              {[...towerLayers].reverse().map((layer, i) => (
                <View
                  key={layer.id}
                  style={[
                    styles.towerLayer,
                    {
                      backgroundColor: layer.color,
                      width: `${100 - i * 8}%` as any,
                    },
                  ]}
                >
                  <Text style={styles.towerLetter}>{layer.letter}</Text>
                </View>
              ))}
              <View style={[styles.plate, { backgroundColor: colors.muted }]} />
            </View>
          )}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          Available layers — tap in alphabetical order:
        </Text>

        <View style={styles.layerPool}>
          {layers.map((layer) => (
            <Pressable
              key={layer.id}
              onPress={() => handleLayerTap(layer)}
              style={({ pressed }) => [
                styles.layerBtn,
                {
                  backgroundColor: layer.placed ? `${colors.muted}88` : layer.color,
                  opacity: layer.placed ? 0.4 : pressed ? 0.8 : 1,
                  borderColor: wrongLetter === layer.letter ? colors.destructive : 'transparent',
                  borderWidth: wrongLetter === layer.letter ? 3 : 0,
                },
              ]}
            >
              <Text style={[styles.layerLetter, { color: layer.placed ? colors.mutedForeground : '#fff' }]}>
                {layer.letter}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.scoreRow}>
          <Feather name="zap" size={16} color={colors.warning} />
          <Text style={[styles.scoreText, { color: colors.foreground }]}>Score: {score}</Text>
        </View>
      </ScrollView>
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
  content: { padding: 20, gap: 20, alignItems: 'center' },
  infoBox: { padding: 14, width: '100%', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  nextHint: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  towerArea: { width: '100%', minHeight: 180, alignItems: 'center', justifyContent: 'flex-end' },
  plate: {
    width: '100%', height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  plateText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  tower: { width: '100%', alignItems: 'center', gap: 4 },
  towerLayer: {
    height: 44, borderRadius: 8, alignItems: 'center',
    justifyContent: 'center', marginHorizontal: 'auto',
  },
  towerLetter: { color: '#fff', fontSize: 20, fontFamily: 'Inter_700Bold' },
  sectionLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', alignSelf: 'flex-start' },
  layerPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  layerBtn: {
    width: 64, height: 64, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  layerLetter: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scoreText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
