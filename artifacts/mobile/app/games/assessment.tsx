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
import * as Haptics from 'expo-haptics';

type Phase = 'intro' | 'visual' | 'color' | 'phonological' | 'rapid' | 'surface' | 'sequence' | 'result';

// ── Phase 1: Letter reversal (visual discrimination) ──
const LETTER_QUESTIONS = [
  { prompt: 'Which letter is "b"?', options: ['d', 'b', 'p', 'q'], answer: 'b' },
  { prompt: 'Which letter is "d"?', options: ['b', 'q', 'd', 'p'], answer: 'd' },
  { prompt: 'Which letter is "p"?', options: ['q', 'b', 'p', 'd'], answer: 'p' },
  { prompt: 'Which letter is "n"?', options: ['u', 'n', 'm', 'h'], answer: 'n' },
  { prompt: 'Which word is spelled "saw" (not "was")?', options: ['wsa', 'saw', 'aws', 'was'], answer: 'saw' },
];

// ── Phase 2: Color & shape discrimination (visual processing) ──
const COLOR_QUESTIONS: { prompt: string; options: { label: string; color: string }[]; answer: string }[] = [
  {
    prompt: 'Which box is a DIFFERENT color from the rest?',
    options: [
      { label: 'A', color: '#6366F1' },
      { label: 'B', color: '#6366F1' },
      { label: 'C', color: '#EF4444' },
      { label: 'D', color: '#6366F1' },
    ],
    answer: 'C',
  },
  {
    prompt: 'Which box is a DIFFERENT color from the rest?',
    options: [
      { label: 'A', color: '#10B981' },
      { label: 'B', color: '#F59E0B' },
      { label: 'C', color: '#10B981' },
      { label: 'D', color: '#10B981' },
    ],
    answer: 'B',
  },
  {
    prompt: 'Which color matches RED?',
    options: [
      { label: 'A', color: '#F97316' },
      { label: 'B', color: '#EF4444' },
      { label: 'C', color: '#EC4899' },
      { label: 'D', color: '#8B5CF6' },
    ],
    answer: 'B',
  },
  {
    prompt: 'Which box is the ODD one out?',
    options: [
      { label: 'A', color: '#3B82F6' },
      { label: 'B', color: '#60A5FA' },
      { label: 'C', color: '#93C5FD' },
      { label: 'D', color: '#F59E0B' },
    ],
    answer: 'D',
  },
  {
    prompt: 'Which two colors are most similar? Pick the one that stands out.',
    options: [
      { label: 'A', color: '#6366F1' },
      { label: 'B', color: '#6366F1' },
      { label: 'C', color: '#EF4444' },
      { label: 'D', color: '#6366F1' },
    ],
    answer: 'C',
  },
];

// ── Phase 3: Rhyming (phonological) ──
const RHYME_QUESTIONS = [
  { prompt: 'Which word rhymes with "CAT"?', options: ['BAT', 'DOG', 'RUN', 'PILL'], answer: 'BAT' },
  { prompt: 'Which word rhymes with "SUN"?', options: ['FUN', 'MAP', 'LOG', 'BELL'], answer: 'FUN' },
  { prompt: 'Which word rhymes with "CAKE"?', options: ['ROPE', 'LAKE', 'FISH', 'DRUM'], answer: 'LAKE' },
  { prompt: 'Which word rhymes with "HOP"?', options: ['BALL', 'SAND', 'TOP', 'WIRE'], answer: 'TOP' },
  { prompt: 'Which word rhymes with "PIG"?', options: ['MOON', 'JIG', 'FROG', 'STAR'], answer: 'JIG' },
];

// ── Phase 4: Rapid naming grid (letters + colors) ──
const RAPID_GRID = ['A', 'T', 'A', 'K', 'A', 'M', 'A', 'R', 'A', 'S', 'A', 'P', 'A', 'W', 'A', 'X'];

// ── Phase 5: Spelling (surface dyslexia) ──
const SPELLING_QUESTIONS = [
  { prompt: 'Which spelling is correct?', options: ['THEIR', 'THIER', 'THERE', 'THEAR'], answer: 'THEIR' },
  { prompt: 'Which spelling is correct?', options: ['WICH', 'WHICH', 'WHICCH', 'WHICK'], answer: 'WHICH' },
  { prompt: 'Which spelling is correct?', options: ['FREIND', 'FRIEND', 'FREND', 'FRINND'], answer: 'FRIEND' },
  { prompt: 'Which spelling is correct?', options: ['BECAUS', 'BECAWSE', 'BECAUSE', 'BECUSE'], answer: 'BECAUSE' },
  { prompt: 'Which spelling is correct?', options: ['COUD', 'COULD', 'KOULD', 'COLUD'], answer: 'COULD' },
];

// ── Phase 6: Memory sequence ──
const SEQUENCE_ROUNDS = [
  { seq: ['A', 'B', 'C'], options: ['A', 'B', 'C', 'D', 'E', 'F'] },
  { seq: ['D', 'A', 'C'], options: ['A', 'B', 'C', 'D', 'E', 'F'] },
  { seq: ['B', 'E', 'D'], options: ['A', 'B', 'C', 'D', 'E', 'F'] },
];

export default function AssessmentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { completeAssessment } = useUser();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const phaseOrder: Phase[] = ['visual', 'color', 'phonological', 'rapid', 'surface', 'sequence'];
  const totalPhases = phaseOrder.length;

  const [phase, setPhase] = useState<Phase>('intro');
  const [questionIdx, setQuestionIdx] = useState(0);
  const [results, setResults] = useState<Record<string, { correct: number; total: number }>>({
    visual: { correct: 0, total: 0 },
    color: { correct: 0, total: 0 },
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
  const [dyslexiaResult, setDyslexiaResult] = useState<{
    type: DyslexiaType; level: DyslexiaLevel; noDyslexia?: boolean;
  } | null>(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  // FIXED: useNativeDriver: false so callback fires on web
  const fadeTransition = useCallback((fn: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start(() => {
      fn();
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start();
    });
  }, [fadeAnim]);

  const currentPhaseIdx = phaseOrder.indexOf(phase);
  const overallProgress = currentPhaseIdx >= 0 ? ((currentPhaseIdx) / totalPhases) * 100 : 0;

  // Rapid naming timer
  useEffect(() => {
    if (phase !== 'rapid' || rapidDone) return;
    if (rapidTime <= 0) { setRapidDone(true); return; }
    const t = setTimeout(() => setRapidTime((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, rapidTime, rapidDone]);

  const getQuestionsForPhase = (phaseKey: string) => {
    switch (phaseKey) {
      case 'visual': return LETTER_QUESTIONS;
      case 'phonological': return RHYME_QUESTIONS;
      case 'surface': return SPELLING_QUESTIONS;
      default: return [];
    }
  };

  const handleAnswer = (answer: string, correctAnswer: string, phaseKey: string) => {
    if (selectedAnswer) return;
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
      const questions = phaseKey === 'color' ? COLOR_QUESTIONS : getQuestionsForPhase(phaseKey);
      if (questionIdx + 1 >= questions.length) {
        fadeTransition(() => advancePhase(phaseKey));
      } else {
        setQuestionIdx((p) => p + 1);
      }
    }, 700);
  };

  const advancePhase = (currentKey: string) => {
    setQuestionIdx(0);
    const idx = phaseOrder.indexOf(currentKey as Phase);
    if (idx + 1 < phaseOrder.length) {
      const next = phaseOrder[idx + 1];
      setPhase(next);
      if (next === 'sequence') initSequence();
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

    // Merge color into visual score
    const visualAvg = (scores.visual + scores.color) / 2;
    const phaseScores = {
      visual: visualAvg,
      phonological: scores.phonological,
      rapid: scores.rapid,
      surface: scores.surface,
      sequence: scores.sequence,
    };

    const avgScore = Object.values(phaseScores).reduce((a, b) => a + b, 0) / Object.values(phaseScores).length;
    const minScore = Math.min(...Object.values(phaseScores));

    // High scorers (≥ 85% average AND no single category below 60%) → no dyslexia
    if (avgScore >= 0.85 && minScore >= 0.6) {
      setDyslexiaResult({ type: 'mixed', level: 1, noDyslexia: true });
      setPhase('result');
      return;
    }

    const worstEntry = Object.entries(phaseScores).find(([, v]) => v === minScore);
    const worstType = worstEntry?.[0] ?? 'mixed';

    const typeMap: Record<string, DyslexiaType> = {
      visual: 'visual',
      phonological: 'phonological',
      rapid: 'rapid-naming',
      surface: 'surface',
      sequence: 'phonological',
    };

    const level: DyslexiaLevel = avgScore >= 0.7 ? 1 : avgScore >= 0.4 ? 2 : 3;
    const finalType = typeMap[worstType] ?? 'mixed';

    setDyslexiaResult({ type: finalType, level });
    setPhase('result');
  };

  const handleFinish = async () => {
    if (!dyslexiaResult) return;
    const assessmentResults: AssessmentResult[] = Object.entries(results).map(([p, v]) => ({
      phase: p,
      score: v.correct,
      totalQuestions: v.total,
      accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
    }));
    await completeAssessment(assessmentResults, dyslexiaResult.type, dyslexiaResult.level);
    router.replace('/(tabs)/');
  };

  // ── Renderers ──

  const renderIntro = () => (
    <View style={styles.center}>
      <View style={[styles.iconBig, { backgroundColor: `${colors.primary}18` }]}>
        <Feather name="clipboard" size={48} color={colors.primary} />
      </View>
      <Text style={[styles.h1, { color: colors.foreground }]}>Quick Assessment</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        6 short activities to understand how you learn best. No right or wrong — just do your best!
      </Text>
      <View style={styles.phasesList}>
        {[
          { icon: 'eye', label: 'Letter Recognition', color: '#6366F1' },
          { icon: 'droplet', label: 'Color & Pattern', color: '#EC4899' },
          { icon: 'volume-2', label: 'Rhyming Words', color: '#10B981' },
          { icon: 'zap', label: 'Rapid Finding', color: '#F59E0B' },
          { icon: 'type', label: 'Spelling Check', color: '#EF4444' },
          { icon: 'list', label: 'Memory Sequence', color: '#8B5CF6' },
        ].map((item, i) => (
          <View key={i} style={[styles.phaseItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.phaseIcon, { backgroundColor: `${item.color}20` }]}>
              <Feather name={item.icon as any} size={16} color={item.color} />
            </View>
            <Text style={[styles.phaseItemText, { color: colors.foreground }]}>{item.label}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.detail, { color: colors.mutedForeground }]}>Takes about 5–7 minutes</Text>
      <Pressable
        onPress={() => fadeTransition(() => setPhase('visual'))}
        style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
      >
        <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Let's Start</Text>
        <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
      </Pressable>
    </View>
  );

  const renderLetterMCQ = () => {
    const q = LETTER_QUESTIONS[questionIdx];
    if (!q) return null;
    return (
      <View style={styles.questionWrap}>
        <Text style={[styles.phaseLabel, { color: '#6366F1' }]}>
          Letter Recognition · {questionIdx + 1}/{LETTER_QUESTIONS.length}
        </Text>
        <Text style={[styles.question, { color: colors.foreground }]}>{q.prompt}</Text>
        <View style={styles.options}>
          {q.options.map((opt, i) => {
            const chosen = selectedAnswer === `${i}:${opt}`;
            const bg = chosen
              ? isCorrect ? `${colors.success}22` : `${colors.destructive}22`
              : colors.card;
            const border = chosen
              ? isCorrect ? colors.success : colors.destructive
              : colors.border;
            return (
              <Pressable
                key={`v-${i}`}
                onPress={() => handleAnswer(`${i}:${opt}`, `${q.options.indexOf(q.answer)}:${q.answer}`, 'visual')}
                style={[styles.optionBtn, { backgroundColor: bg, borderColor: border }]}
              >
                <Text style={[styles.optionText, { color: colors.foreground, fontSize: 34 }]}>{opt}</Text>
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

  const renderColorMCQ = () => {
    const q = COLOR_QUESTIONS[questionIdx];
    if (!q) return null;
    return (
      <View style={styles.questionWrap}>
        <Text style={[styles.phaseLabel, { color: '#EC4899' }]}>
          Color & Pattern · {questionIdx + 1}/{COLOR_QUESTIONS.length}
        </Text>
        <Text style={[styles.question, { color: colors.foreground }]}>{q.prompt}</Text>
        <View style={styles.colorGrid}>
          {q.options.map((opt) => {
            const chosen = selectedAnswer === opt.label;
            const correct = opt.label === q.answer;
            const borderColor = chosen
              ? isCorrect ? colors.success : colors.destructive
              : colors.border;
            const borderWidth = chosen ? 3 : 1.5;
            return (
              <Pressable
                key={opt.label}
                onPress={() => handleAnswer(opt.label, q.answer, 'color')}
                style={[styles.colorCard, { borderColor, borderWidth }]}
              >
                <View style={[styles.colorSwatch, { backgroundColor: opt.color }]} />
                <Text style={[styles.colorLabel, { color: colors.foreground }]}>{opt.label}</Text>
                {chosen && (
                  <Feather
                    name={isCorrect ? 'check-circle' : 'x-circle'}
                    size={16}
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

  const renderRhymeMCQ = () => {
    const q = RHYME_QUESTIONS[questionIdx];
    if (!q) return null;
    return (
      <View style={styles.questionWrap}>
        <Text style={[styles.phaseLabel, { color: '#10B981' }]}>
          Rhyming · {questionIdx + 1}/{RHYME_QUESTIONS.length}
        </Text>
        <Text style={[styles.question, { color: colors.foreground }]}>{q.prompt}</Text>
        <View style={styles.options}>
          {q.options.map((opt, i) => {
            const chosen = selectedAnswer === `${i}:${opt}`;
            const bg = chosen
              ? isCorrect ? `${colors.success}22` : `${colors.destructive}22`
              : colors.card;
            const border = chosen
              ? isCorrect ? colors.success : colors.destructive
              : colors.border;
            return (
              <Pressable
                key={`r-${i}`}
                onPress={() => handleAnswer(`${i}:${opt}`, `${q.options.indexOf(q.answer)}:${q.answer}`, 'phonological')}
                style={[styles.optionBtn, { backgroundColor: bg, borderColor: border }]}
              >
                <Text style={[styles.optionText, { color: colors.foreground, fontSize: 22 }]}>{opt}</Text>
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

  const renderSpellingMCQ = () => {
    const q = SPELLING_QUESTIONS[questionIdx];
    if (!q) return null;
    return (
      <View style={styles.questionWrap}>
        <Text style={[styles.phaseLabel, { color: '#EF4444' }]}>
          Spelling · {questionIdx + 1}/{SPELLING_QUESTIONS.length}
        </Text>
        <Text style={[styles.question, { color: colors.foreground }]}>{q.prompt}</Text>
        <View style={styles.options}>
          {q.options.map((opt, i) => {
            const chosen = selectedAnswer === `${i}:${opt}`;
            const bg = chosen
              ? isCorrect ? `${colors.success}22` : `${colors.destructive}22`
              : colors.card;
            const border = chosen
              ? isCorrect ? colors.success : colors.destructive
              : colors.border;
            return (
              <Pressable
                key={`s-${i}`}
                onPress={() => handleAnswer(`${i}:${opt}`, `${q.options.indexOf(q.answer)}:${q.answer}`, 'surface')}
                style={[styles.optionBtn, { backgroundColor: bg, borderColor: border }]}
              >
                <Text style={[styles.optionText, { color: colors.foreground, fontSize: 18 }]}>{opt}</Text>
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
      <Text style={[styles.phaseLabel, { color: '#F59E0B' }]}>Rapid Finding</Text>
      <Text style={[styles.question, { color: colors.foreground }]}>
        Tap all the letter "A" as fast as you can!
      </Text>
      <View style={styles.timerRow}>
        <Feather name="clock" size={16} color={rapidTime <= 5 ? colors.destructive : '#F59E0B'} />
        <Text style={[styles.timer, { color: rapidTime <= 5 ? colors.destructive : '#F59E0B' }]}>
          {rapidTime}s
        </Text>
        <Text style={[styles.timerSub, { color: colors.mutedForeground }]}>
          Found: {rapidTapped.filter((i) => RAPID_GRID[i] === 'A').length}/{RAPID_GRID.filter(l => l === 'A').length}
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
                    ? isTarget ? `${colors.success}40` : `${colors.destructive}20`
                    : colors.card,
                  borderColor: tapped
                    ? isTarget ? colors.success : colors.destructive
                    : colors.border,
                },
              ]}
            >
              <Text style={[
                styles.gridLetter,
                { color: tapped && isTarget ? colors.success : colors.foreground, fontFamily: 'Inter_700Bold' }
              ]}>
                {letter}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {(rapidDone || rapidTime <= 0) && (
        <Pressable
          onPress={finishRapid}
          style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
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
        <Text style={[styles.phaseLabel, { color: '#8B5CF6' }]}>
          Memory Sequence · {seqRound + 1}/{SEQUENCE_ROUNDS.length}
        </Text>
        <Text style={[styles.question, { color: colors.foreground }]}>
          {seqPhase === 'show' && showSeq
            ? 'Remember this sequence:'
            : seqPhase === 'show' && !showSeq
              ? 'Get ready...'
              : 'Tap the letters in order:'}
        </Text>
        {seqPhase === 'show' && showSeq ? (
          <View style={styles.seqDisplay}>
            {round.seq.map((l, i) => (
              <View key={i} style={[styles.seqBadge, { backgroundColor: '#8B5CF6' }]}>
                <Text style={[styles.seqLetter, { color: '#fff' }]}>{l}</Text>
              </View>
            ))}
          </View>
        ) : seqPhase === 'input' ? (
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
                    {
                      backgroundColor: userSeq.includes(l) ? `${colors.primary}22` : colors.card,
                      borderColor: userSeq.includes(l) ? colors.primary : colors.border,
                      opacity: pressed ? 0.7 : 1,
                    }
                  ]}
                >
                  <Text style={[styles.seqLetter, { color: colors.foreground }]}>{l}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.seqDisplay}>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>Preparing next round...</Text>
          </View>
        )}
      </View>
    );
  };

  const renderResult = () => {
    if (!dyslexiaResult) return null;

    // ── No dyslexia detected ──────────────────────────────────────────────
    if (dyslexiaResult.noDyslexia) {
      return (
        <View style={styles.center}>
          <View style={[styles.iconBig, { backgroundColor: '#10B98120' }]}>
            <Text style={{ fontSize: 52 }}>🎉</Text>
          </View>
          <Text style={[styles.h1, { color: colors.foreground, textAlign: 'center' }]}>
            You're Doing Great!
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            Based on your results, you do not appear to have dyslexia.
            Your reading and recognition skills are excellent — keep it up!
          </Text>

          {/* Celebration card */}
          <View style={[styles.resultCard, { backgroundColor: '#10B98112', borderColor: '#10B98140', borderWidth: 1.5, borderRadius: 20 }]}>
            <View style={styles.noBadgeRow}>
              <Feather name="check-circle" size={20} color="#10B981" />
              <Text style={[styles.noBadgeText, { color: '#10B981' }]}>No Dyslexia Indicators Detected</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: '#10B98130' }]} />
            <Text style={[styles.resultNote, { color: colors.mutedForeground }]}>
              All 6 assessment areas — letter recognition, color patterns, rhyming, rapid naming, spelling, and memory — came back strong. There's nothing to worry about!
            </Text>
            <View style={[styles.divider, { backgroundColor: '#10B98130' }]} />
            <Text style={[styles.resultNote, { color: colors.mutedForeground }]}>
              You can still use the games in this app to keep your reading skills sharp and have fun!
            </Text>
          </View>

          <Pressable
            onPress={handleFinish}
            style={({ pressed }) => [styles.btn, { backgroundColor: '#10B981', opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[styles.btnText, { color: '#fff' }]}>Explore the App</Text>
            <Feather name="arrow-right" size={18} color="#fff" />
          </Pressable>
        </View>
      );
    }

    // ── Dyslexia result ────────────────────────────────────────────────────
    const typeLabels: Record<string, string> = {
      phonological: 'Phonological Dyslexia',
      visual: 'Visual Dyslexia',
      'rapid-naming': 'Rapid Naming Dyslexia',
      surface: 'Surface Dyslexia',
      mixed: 'Mixed Type',
    };
    const typeDescs: Record<string, string> = {
      phonological: 'Difficulty connecting letters to sounds and rhyming.',
      visual: 'Difficulty with letter shapes, orientation, and colors.',
      'rapid-naming': 'Slower processing of symbols, colors, and text.',
      surface: 'Difficulty with irregular word spelling and recognition.',
      mixed: 'A combination of multiple reading challenges.',
    };
    const levelLabels: Record<number, string> = { 1: 'Mild', 2: 'Moderate', 3: 'Significant' };
    const levelColors: Record<number, string> = {
      1: colors.success, 2: colors.warning, 3: colors.destructive,
    };

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
          <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>Primary Type</Text>
          <Text style={[styles.resultValue, { color: colors.primary }]}>
            {typeLabels[dyslexiaResult.type] ?? 'Mixed Type'}
          </Text>
          <Text style={[styles.resultDesc, { color: colors.mutedForeground }]}>
            {typeDescs[dyslexiaResult.type] ?? ''}
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>Severity Level</Text>
          <Text style={[styles.resultValue, { color: levelColors[dyslexiaResult.level] }]}>
            {levelLabels[dyslexiaResult.level]}
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.resultNote, { color: colors.mutedForeground }]}>
            Your daily games are now personalized to your profile. Play 6–7 games daily for the best results!
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

  const renderPhaseContent = () => {
    switch (phase) {
      case 'intro': return renderIntro();
      case 'visual': return renderLetterMCQ();
      case 'color': return renderColorMCQ();
      case 'phonological': return renderRhymeMCQ();
      case 'rapid': return renderRapid();
      case 'surface': return renderSpellingMCQ();
      case 'sequence': return renderSequence();
      case 'result': return renderResult();
      default: return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      {phase !== 'intro' && phase !== 'result' && (
        <View style={styles.progressOuter}>
          <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
            <View style={[styles.progressFill, { width: `${overallProgress}%` as any, backgroundColor: colors.primary }]} />
          </View>
          <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
            {currentPhaseIdx + 1}/{totalPhases}
          </Text>
        </View>
      )}
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: botPad + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {renderPhaseContent()}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  progressOuter: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 24, marginBottom: 8,
  },
  progressTrack: { flex: 1, height: 6, borderRadius: 4 },
  progressFill: { height: 6, borderRadius: 4 },
  progressLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', minWidth: 30 },
  scroll: { padding: 24, flexGrow: 1, justifyContent: 'center' },
  center: { alignItems: 'center', gap: 18, paddingVertical: 20 },
  iconBig: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  h1: { fontSize: 26, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  sub: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 23 },
  detail: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  phasesList: { width: '100%', gap: 8 },
  phaseItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
  },
  phaseIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  phaseItemText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 16, paddingHorizontal: 32, borderRadius: 16, width: '100%', justifyContent: 'center',
  },
  btnText: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  questionWrap: { gap: 18 },
  phaseLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 1 },
  question: { fontSize: 20, fontFamily: 'Inter_700Bold', lineHeight: 28 },
  options: { gap: 10 },
  optionBtn: {
    padding: 16, borderWidth: 2, borderRadius: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  optionText: { fontFamily: 'Inter_600SemiBold' },
  // Color grid
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  colorCard: {
    width: '44%', borderRadius: 16, padding: 12, alignItems: 'center', gap: 8,
    backgroundColor: '#fff',
  },
  colorSwatch: { width: '100%', height: 70, borderRadius: 10 },
  colorLabel: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  // Rapid
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timer: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  timerSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginLeft: 'auto' as any },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCell: {
    width: 58, height: 58, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderRadius: 12,
  },
  gridLetter: { fontSize: 22 },
  // Sequence
  seqDisplay: { flexDirection: 'row', gap: 14, justifyContent: 'center', paddingVertical: 16 },
  seqBadge: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  seqLetter: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  seqInput: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  seqSlot: {
    width: 56, height: 56, borderRadius: 12, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  seqOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 8 },
  seqBtn: {
    width: 52, height: 52, borderRadius: 12, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  // Result
  resultCard: {
    padding: 24, width: '100%', gap: 10,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 4,
  },
  resultLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.5 },
  resultValue: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  resultDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20, marginTop: -4 },
  divider: { height: 1, marginVertical: 4 },
  resultNote: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  noBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noBadgeText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
});
