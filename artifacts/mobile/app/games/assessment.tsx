import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Animated, Pressable, StyleSheet, Text, View,
  ScrollView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useUser } from '@/context/UserContext';
import type { AssessmentResult, DyslexiaType, DyslexiaLevel } from '@/context/UserContext';
import { RHYME_QUESTIONS, SPELLING_QUESTIONS } from '@/constants/games';
import * as Haptics from 'expo-haptics';

type Phase = 'intro' | 'visual' | 'phonological' | 'rapid' | 'surface' | 'sequence' | 'result';

const VISUAL_QUESTIONS = [
  { prompt: 'Which letter is "b"?', options: ['d', 'b', 'p', 'q'], answer: 'b' },
  { prompt: 'Which letter is "d"?', options: ['b', 'q', 'd', 'p'], answer: 'd' },
  { prompt: 'Which letter is "p"?', options: ['q', 'b', 'd', 'p'], answer: 'p' },
  { prompt: 'Which letter is "q"?', options: ['p', 'd', 'q', 'b'], answer: 'q' },
  { prompt: 'Which letter is "n"?', options: ['u', 'm', 'n', 'h'], answer: 'n' },
];

const SEQUENCE_ROUNDS = [
  { seq: ['A', 'B', 'C'], options: ['A', 'B', 'C', 'D', 'E', 'F'] },
  { seq: ['D', 'A', 'C'], options: ['A', 'B', 'C', 'D', 'E', 'F'] },
  { seq: ['B', 'E', 'D'], options: ['A', 'B', 'C', 'D', 'E', 'F'] },
];

const RAPID_GRID = ['A','T','A','K','A','M','A','R','A','S','A','P','A','W','A','X'];

export default function AssessmentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { completeAssessment } = useUser();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const [phase, setPhase] = useState<Phase>('intro');
  const [questionIdx, setQuestionIdx] = useState(0);
  const [results, setResults] = useState<Record<string, { correct: number; total: number }>>({
    visual: { correct: 0, total: 0 },
    phonological: { correct: 0, total: 0 },
    rapid: { correct: 0, total: 0 },
    surface: { correct: 0, total: 0 },
    sequence: { correct: 0, total: 0 },
  });

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [rapidTapped, setRapidTapped] = useState<number[]>([]);
  const [rapidTime, setRapidTime] = useState(15);
  const [rapidDone, setRapidDone] = useState(false);
  const [showSeq, setShowSeq] = useState(false);
  const [userSeq, setUserSeq] = useState<string[]>([]);
  const [seqPhase, setSeqPhase] = useState<'show' | 'input'>('show');
  const [seqRound, setSeqRound] = useState(0);
  const [dyslexiaResult, setDyslexiaResult] = useState<{ type: DyslexiaType; level: DyslexiaLevel } | null>(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const fadeTransition = useCallback((fn: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      fn();
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
  }, [fadeAnim]);

  const totalPhases = 5;
  const phaseOrder: Phase[] = ['visual', 'phonological', 'rapid', 'surface', 'sequence'];
  const currentPhaseIdx = phaseOrder.indexOf(phase);
  const overallProgress = currentPhaseIdx >= 0 ? (currentPhaseIdx / totalPhases) * 100 : 0;

  // Rapid naming timer
  useEffect(() => {
    if (phase !== 'rapid' || rapidDone) return;
    if (rapidTime <= 0) {
      setRapidDone(true);
      return;
    }
    const t = setTimeout(() => setRapidTime((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, rapidTime, rapidDone]);

  const handleAnswer = (answer: string, correctAnswer: string, phaseKey: string) => {
    const correct = answer === correctAnswer;
    setSelectedAnswer(answer);
    setIsCorrect(correct);
    Haptics.impactAsync(correct ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy);

    setResults((prev) => ({
      ...prev,
      [phaseKey]: {
        correct: prev[phaseKey].correct + (correct ? 1 : 0),
        total: prev[phaseKey].total + 1,
      },
    }));

    setTimeout(() => {
      setSelectedAnswer(null);
      setIsCorrect(null);
      const questions =
        phaseKey === 'visual' ? VISUAL_QUESTIONS :
        phaseKey === 'phonological' ? RHYME_QUESTIONS.slice(0, 5) :
        SPELLING_QUESTIONS.slice(0, 5);

      if (questionIdx + 1 >= questions.length) {
        fadeTransition(() => advancePhase(phaseKey));
      } else {
        setQuestionIdx((p) => p + 1);
      }
    }, 600);
  };

  const advancePhase = (currentKey: string) => {
    setQuestionIdx(0);
    const idx = phaseOrder.indexOf(currentKey as Phase);
    if (idx + 1 < phaseOrder.length) {
      setPhase(phaseOrder[idx + 1]);
      if (phaseOrder[idx + 1] === 'sequence') initSequence();
    } else {
      calculateResult();
    }
  };

  const initSequence = () => {
    setSeqRound(0);
    setUserSeq([]);
    setSeqPhase('show');
    showSequence(0);
  };

  const showSequence = (round: number) => {
    setShowSeq(true);
    setTimeout(() => {
      setShowSeq(false);
      setSeqPhase('input');
    }, 2000 + round * 500);
  };

  const handleSeqTap = (letter: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newSeq = [...userSeq, letter];
    setUserSeq(newSeq);

    const target = SEQUENCE_ROUNDS[seqRound].seq;
    if (newSeq.length === target.length) {
      const correct = newSeq.join('') === target.join('');
      setResults((prev) => ({
        ...prev,
        sequence: {
          correct: prev.sequence.correct + (correct ? 1 : 0),
          total: prev.sequence.total + 1,
        },
      }));
      setTimeout(() => {
        if (seqRound + 1 < SEQUENCE_ROUNDS.length) {
          setSeqRound((p) => p + 1);
          setUserSeq([]);
          setSeqPhase('show');
          showSequence(seqRound + 1);
        } else {
          fadeTransition(calculateResult);
        }
      }, 800);
    }
  };

  const handleRapidTap = (idx: number) => {
    if (rapidDone || rapidTapped.includes(idx)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRapidTapped((p) => [...p, idx]);
    const correct = RAPID_GRID[idx] === 'A';
    setResults((prev) => ({
      ...prev,
      rapid: {
        correct: prev.rapid.correct + (correct ? 1 : 0),
        total: prev.rapid.total + 1,
      },
    }));
  };

  const finishRapid = () => {
    const totalAs = RAPID_GRID.filter((l) => l === 'A').length;
    const tapped = rapidTapped.filter((i) => RAPID_GRID[i] === 'A').length;
    setResults((prev) => ({
      ...prev,
      rapid: { correct: tapped, total: totalAs },
    }));
    fadeTransition(() => {
      setPhase('surface');
      setQuestionIdx(0);
    });
  };

  const calculateResult = () => {
    const scores: Record<string, number> = {};
    Object.entries(results).forEach(([k, v]) => {
      scores[k] = v.total > 0 ? v.correct / v.total : 1;
    });

    const minScore = Math.min(...Object.values(scores));
    const worstType = Object.entries(scores).find(([, v]) => v === minScore)?.[0] ?? 'mixed';

    const typeMap: Record<string, DyslexiaType> = {
      visual: 'visual',
      phonological: 'phonological',
      rapid: 'rapid-naming',
      surface: 'surface',
      sequence: 'phonological',
    };

    const avgScore = Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length;
    const level: DyslexiaLevel = avgScore >= 0.7 ? 1 : avgScore >= 0.4 ? 2 : 3;

    const typeKey = scores.visual <= scores.phonological && scores.visual <= scores.rapid
      ? 'visual'
      : worstType;

    const finalType = typeMap[typeKey] ?? 'mixed';
    setDyslexiaResult({ type: finalType, level });
    setPhase('result');
  };

  const handleFinish = async () => {
    if (!dyslexiaResult) return;
    const assessmentResults: AssessmentResult[] = Object.entries(results).map(([phase, v]) => ({
      phase,
      score: v.correct,
      totalQuestions: v.total,
      accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
    }));
    await completeAssessment(assessmentResults, dyslexiaResult.type, dyslexiaResult.level);
    router.replace('/(tabs)/');
  };

  const renderPhaseContent = () => {
    switch (phase) {
      case 'intro': return renderIntro();
      case 'visual': return renderMCQ('visual', VISUAL_QUESTIONS, questionIdx, (a) =>
        handleAnswer(a, VISUAL_QUESTIONS[questionIdx].answer, 'visual'));
      case 'phonological': return renderMCQ('phonological', RHYME_QUESTIONS.slice(0, 5).map(q => ({
        prompt: `Which word rhymes with "${q.word}"?`, options: q.options, answer: q.answer
      })), questionIdx, (a) => handleAnswer(a, RHYME_QUESTIONS[questionIdx].answer, 'phonological'));
      case 'rapid': return renderRapid();
      case 'surface': return renderMCQ('surface', SPELLING_QUESTIONS.slice(0, 5).map(q => ({
        prompt: 'Which spelling is correct?', options: q.options, answer: q.correct
      })), questionIdx, (a) => handleAnswer(a, SPELLING_QUESTIONS[questionIdx].correct, 'surface'));
      case 'sequence': return renderSequence();
      case 'result': return renderResult();
      default: return null;
    }
  };

  const renderIntro = () => (
    <View style={styles.center}>
      <View style={[styles.iconBig, { backgroundColor: `${colors.primary}18` }]}>
        <Feather name="clipboard" size={48} color={colors.primary} />
      </View>
      <Text style={[styles.h1, { color: colors.foreground }]}>Quick Assessment</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        5 short activities to understand how you learn best. No right or wrong — just do your best!
      </Text>
      <Text style={[styles.detail, { color: colors.mutedForeground }]}>
        Takes about 5 minutes
      </Text>
      <Pressable
        onPress={() => fadeTransition(() => setPhase('visual'))}
        style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
      >
        <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Let's Start</Text>
        <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
      </Pressable>
    </View>
  );

  const renderMCQ = (
    key: string,
    questions: { prompt: string; options: string[]; answer: string }[],
    idx: number,
    onAnswer: (a: string) => void
  ) => {
    const q = questions[idx];
    if (!q) return null;
    const phaseLabels: Record<string, string> = {
      visual: 'Letter Recognition',
      phonological: 'Rhyme Finder',
      surface: 'Spelling Check',
    };
    return (
      <View style={styles.questionWrap}>
        <Text style={[styles.phaseLabel, { color: colors.primary }]}>
          {phaseLabels[key]} · {idx + 1}/{questions.length}
        </Text>
        <Text style={[styles.question, { color: colors.foreground }]}>{q.prompt}</Text>
        <View style={styles.options}>
          {q.options.map((opt) => {
            const chosen = selectedAnswer === opt;
            const correct = opt === q.answer;
            let bg = colors.card;
            let border = colors.border;
            if (chosen) {
              bg = isCorrect ? `${colors.success}22` : `${colors.destructive}22`;
              border = isCorrect ? colors.success : colors.destructive;
            }
            return (
              <Pressable
                key={opt}
                onPress={() => !selectedAnswer && onAnswer(opt)}
                style={[styles.optionBtn, { backgroundColor: bg, borderColor: border, borderRadius: 14 }]}
              >
                <Text style={[styles.optionText, { color: colors.foreground, fontSize: key === 'visual' ? 32 : 18 }]}>
                  {opt}
                </Text>
                {chosen && (
                  <Feather
                    name={isCorrect ? 'check-circle' : 'x-circle'}
                    size={20}
                    color={isCorrect ? colors.success : colors.destructive}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const renderRapid = () => (
    <View style={styles.questionWrap}>
      <Text style={[styles.phaseLabel, { color: colors.primary }]}>Rapid Finding</Text>
      <Text style={[styles.question, { color: colors.foreground }]}>Tap all the letter "A" — as fast as you can!</Text>
      <View style={[styles.timerRow]}>
        <Feather name="clock" size={16} color={rapidTime <= 5 ? colors.destructive : colors.primary} />
        <Text style={[styles.timer, { color: rapidTime <= 5 ? colors.destructive : colors.primary }]}>
          {rapidTime}s
        </Text>
      </View>
      <View style={styles.grid}>
        {RAPID_GRID.map((letter, i) => {
          const tapped = rapidTapped.includes(i);
          const isTarget = letter === 'A';
          return (
            <Pressable
              key={i}
              onPress={() => handleRapidTap(i)}
              style={[
                styles.gridCell,
                {
                  backgroundColor: tapped
                    ? isTarget ? `${colors.success}30` : `${colors.destructive}20`
                    : colors.card,
                  borderColor: tapped ? (isTarget ? colors.success : colors.destructive) : colors.border,
                  borderRadius: 10,
                },
              ]}
            >
              <Text style={[styles.gridLetter, { color: colors.foreground }]}>{letter}</Text>
            </Pressable>
          );
        })}
      </View>
      {(rapidDone || rapidTime <= 0) && (
        <Pressable
          onPress={finishRapid}
          style={[styles.btn, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Continue</Text>
        </Pressable>
      )}
    </View>
  );

  const renderSequence = () => {
    const round = SEQUENCE_ROUNDS[seqRound];
    return (
      <View style={styles.questionWrap}>
        <Text style={[styles.phaseLabel, { color: colors.primary }]}>Memory Sequence · {seqRound + 1}/3</Text>
        <Text style={[styles.question, { color: colors.foreground }]}>
          {seqPhase === 'show' && showSeq ? 'Remember this sequence:' : 'Tap the letters in order:'}
        </Text>
        {seqPhase === 'show' && showSeq ? (
          <View style={styles.seqDisplay}>
            {round.seq.map((l, i) => (
              <View key={i} style={[styles.seqBadge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.seqLetter, { color: colors.primaryForeground }]}>{l}</Text>
              </View>
            ))}
          </View>
        ) : (
          <>
            <View style={styles.seqInput}>
              {Array.from({ length: round.seq.length }).map((_, i) => (
                <View key={i} style={[styles.seqSlot, { borderColor: colors.border, backgroundColor: colors.muted }]}>
                  <Text style={[styles.seqLetter, { color: colors.foreground }]}>
                    {userSeq[i] ?? ''}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.seqOptions}>
              {round.options.map((l) => (
                <Pressable
                  key={l}
                  onPress={() => handleSeqTap(l)}
                  style={({ pressed }) => [
                    styles.seqBtn,
                    { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }
                  ]}
                >
                  <Text style={[styles.seqLetter, { color: colors.foreground }]}>{l}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>
    );
  };

  const renderResult = () => {
    if (!dyslexiaResult) return null;
    const typeLabels: Record<string, string> = {
      phonological: 'Phonological',
      visual: 'Visual',
      'rapid-naming': 'Rapid Naming',
      surface: 'Surface',
      mixed: 'Mixed',
    };
    const levelLabels = { 1: 'Mild', 2: 'Moderate', 3: 'Significant' };
    const levelColors = { 1: colors.success, 2: colors.warning, 3: colors.destructive };

    return (
      <View style={styles.center}>
        <View style={[styles.iconBig, { backgroundColor: `${colors.success}18` }]}>
          <Feather name="check-circle" size={48} color={colors.success} />
        </View>
        <Text style={[styles.h1, { color: colors.foreground }]}>Assessment Complete!</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Here's what we found about your learning style:
        </Text>
        <View style={[styles.resultCard, { backgroundColor: colors.card, borderRadius: 20 }]}>
          <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>Dyslexia Type</Text>
          <Text style={[styles.resultValue, { color: colors.primary }]}>
            {typeLabels[dyslexiaResult.type ?? 'mixed']}
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>Severity</Text>
          <Text style={[styles.resultValue, { color: levelColors[dyslexiaResult.level] }]}>
            {levelLabels[dyslexiaResult.level]}
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.resultNote, { color: colors.mutedForeground }]}>
            We've personalized your daily games to target your specific needs. Play 6-7 games daily for best results!
          </Text>
        </View>
        <Pressable
          onPress={handleFinish}
          style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Start My Journey</Text>
          <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      {phase !== 'intro' && phase !== 'result' && (
        <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
          <View style={[styles.progressFill, { width: `${overallProgress}%` as any, backgroundColor: colors.primary }]} />
        </View>
      )}
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: botPad + 20 }]} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>
          {renderPhaseContent()}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  progressTrack: { height: 4, marginHorizontal: 24, borderRadius: 4, marginBottom: 8 },
  progressFill: { height: 4, borderRadius: 4 },
  scroll: { padding: 24, flexGrow: 1, justifyContent: 'center' },
  center: { alignItems: 'center', gap: 20, paddingVertical: 20 },
  iconBig: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  h1: { fontSize: 28, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  sub: { fontSize: 16, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 24 },
  detail: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 16, paddingHorizontal: 32, borderRadius: 16, width: '100%', justifyContent: 'center',
  },
  btnText: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  questionWrap: { gap: 20 },
  phaseLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 1 },
  question: { fontSize: 22, fontFamily: 'Inter_700Bold', lineHeight: 30 },
  options: { gap: 12 },
  optionBtn: {
    padding: 18, borderWidth: 2, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  optionText: { fontFamily: 'Inter_600SemiBold' },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timer: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCell: {
    width: 60, height: 60, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  gridLetter: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  seqDisplay: { flexDirection: 'row', gap: 16, justifyContent: 'center', paddingVertical: 20 },
  seqBadge: {
    width: 56, height: 56, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  seqLetter: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  seqInput: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  seqSlot: {
    width: 56, height: 56, borderRadius: 12, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  seqOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 12 },
  seqBtn: {
    width: 56, height: 56, borderRadius: 12, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  resultCard: {
    padding: 24, width: '100%', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 4,
  },
  resultLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  resultValue: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  divider: { height: 1 },
  resultNote: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22 },
});
