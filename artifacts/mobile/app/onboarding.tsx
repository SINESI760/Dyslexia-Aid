import React, { useState, useRef } from 'react';
import {
  Animated, Keyboard, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useUser } from '@/context/UserContext';
import * as Haptics from 'expo-haptics';

const AGE_GROUPS = [
  { label: '6–9', value: 7, icon: 'star' },
  { label: '10–12', value: 11, icon: 'zap' },
  { label: '13–15', value: 14, icon: 'book' },
  { label: '16+', value: 17, icon: 'award' },
];

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setupProfile } = useUser();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [selectedAge, setSelectedAge] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const fadeNext = (fn: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      fn();
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  };

  const handleContinue = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 0) {
      fadeNext(() => setStep(1));
    } else if (step === 1) {
      if (!name.trim()) return;
      fadeNext(() => setStep(2));
    } else if (step === 2) {
      if (!selectedAge) return;
      setIsLoading(true);
      await setupProfile(name.trim(), selectedAge);
      router.replace('/games/assessment');
    }
  };

  const steps = [
    { title: 'Welcome to\nDyslexiaHeal', icon: 'book-open', color: colors.primary },
    { title: 'What\'s your name?', icon: 'user', color: '#EC4899' },
    { title: 'How old are you?', icon: 'calendar', color: '#10B981' },
  ];

  const currentStep = steps[step];

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.description, { color: colors.mutedForeground }]}>
              A fun, science-backed approach to improving reading skills through daily games and activities.
            </Text>
            <View style={styles.features}>
              {[
                { icon: 'target', text: 'Personalized assessment', color: '#6366F1' },
                { icon: 'zap', text: '6 therapeutic games daily', color: '#F59E0B' },
                { icon: 'trending-up', text: 'Track your progress weekly', color: '#10B981' },
                { icon: 'award', text: 'Level up as you improve', color: '#EC4899' },
              ].map((f, i) => (
                <View key={i} style={[styles.featureRow, { backgroundColor: colors.card, borderRadius: 14 }]}>
                  <View style={[styles.featureIcon, { backgroundColor: `${f.color}18` }]}>
                    <Feather name={f.icon as any} size={18} color={f.color} />
                  </View>
                  <Text style={[styles.featureText, { color: colors.foreground }]}>{f.text}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      case 1:
        return (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.stepContent}
          >
            <Text style={[styles.description, { color: colors.mutedForeground }]}>
              We'll personalize your experience just for you.
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: name.length > 0 ? colors.primary : colors.border,
                  color: colors.foreground,
                },
              ]}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={handleContinue}
            />
          </KeyboardAvoidingView>
        );
      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.description, { color: colors.mutedForeground }]}>
              We'll adjust difficulty to match your level.
            </Text>
            <View style={styles.ageGrid}>
              {AGE_GROUPS.map((group) => (
                <Pressable
                  key={group.value}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedAge(group.value);
                  }}
                  style={({ pressed }) => [
                    styles.ageBtn,
                    {
                      backgroundColor: selectedAge === group.value ? colors.primary : colors.card,
                      borderColor: selectedAge === group.value ? colors.primary : colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Feather
                    name={group.icon as any}
                    size={24}
                    color={selectedAge === group.value ? colors.primaryForeground : colors.primary}
                  />
                  <Text
                    style={[
                      styles.ageLabel,
                      { color: selectedAge === group.value ? colors.primaryForeground : colors.foreground },
                    ]}
                  >
                    {group.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
    }
  };

  const canContinue =
    step === 0 || (step === 1 && name.trim().length > 0) || (step === 2 && selectedAge !== null);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: botPad + 20 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepsIndicator}>
          {steps.map((_, i) => (
            <View
              key={i}
              style={[
                styles.stepDot,
                {
                  backgroundColor: i <= step ? colors.primary : colors.muted,
                  width: i === step ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        <Animated.View style={[styles.main, { opacity: fadeAnim }]}>
          <View style={[styles.iconCircle, { backgroundColor: `${currentStep.color}18` }]}>
            <Feather name={currentStep.icon as any} size={52} color={currentStep.color} />
          </View>

          <Text style={[styles.title, { color: colors.foreground }]}>{currentStep.title}</Text>

          {renderStepContent()}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: botPad + 12, paddingHorizontal: 24 }]}>
        <Pressable
          onPress={handleContinue}
          disabled={!canContinue || isLoading}
          style={({ pressed }) => [
            styles.continueBtn,
            {
              backgroundColor: canContinue ? colors.primary : colors.muted,
              opacity: pressed ? 0.85 : 1,
              borderRadius: 18,
            },
          ]}
        >
          <Text style={[styles.continueBtnText, { color: canContinue ? colors.primaryForeground : colors.mutedForeground }]}>
            {isLoading ? 'Starting...' : step === 2 ? 'Start Assessment' : 'Continue'}
          </Text>
          {!isLoading && (
            <Feather
              name={step === 2 ? 'play' : 'arrow-right'}
              size={18}
              color={canContinue ? colors.primaryForeground : colors.mutedForeground}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24 },
  stepsIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 32, justifyContent: 'center',
  },
  stepDot: { height: 8, borderRadius: 4 },
  main: { alignItems: 'center', gap: 24, flex: 1 },
  iconCircle: {
    width: 112, height: 112, borderRadius: 56,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: 32, fontFamily: 'Inter_700Bold',
    textAlign: 'center', lineHeight: 40,
  },
  description: { fontSize: 16, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 24 },
  stepContent: { width: '100%', gap: 20, alignItems: 'center' },
  features: { width: '100%', gap: 10 },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
  },
  featureIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  featureText: { fontSize: 15, fontFamily: 'Inter_500Medium', flex: 1 },
  input: {
    width: '100%', padding: 18, borderRadius: 16, borderWidth: 2,
    fontSize: 20, fontFamily: 'Inter_600SemiBold',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  ageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', width: '100%' },
  ageBtn: {
    width: '45%', aspectRatio: 1.4, borderRadius: 18, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  ageLabel: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  footer: { paddingTop: 12 },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 18,
    shadowColor: '#6366F1', shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
  },
  continueBtnText: { fontSize: 17, fontFamily: 'Inter_700Bold' },
});
