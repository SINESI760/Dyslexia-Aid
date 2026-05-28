import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Platform, ScrollView, Switch, Pressable, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { theme, setTheme } = useTheme();
  const { profile, resetProfile } = useUser();
  const topPad = Platform.OS === 'web' ? 60 : insets.top;
  const botPad = Platform.OS === 'web' ? 84 : insets.bottom + 20;
  const [resetting, setResetting] = useState(false);

  const handleReset = () => {
    Alert.alert(
      'Reset Profile',
      'This will erase all your data — profile, progress, and scores. You\'ll start fresh from onboarding. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            setResetting(true);
            try {
              await resetProfile();
              // Clear daily progress too
              await AsyncStorage.removeItem('@dyslexia_daily_progress_v1');
            } finally {
              setResetting(false);
              router.replace('/onboarding');
            }
          },
        },
      ]
    );
  };

  const isDark = theme === 'dark';

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: botPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Appearance */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>APPEARANCE</Text>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: isDark ? '#1E1B4B' : '#F1F0FF' }]}>
              <Feather name={isDark ? 'moon' : 'sun'} size={18} color={colors.primary} />
            </View>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>
              {isDark ? 'Dark Mode' : 'Light Mode'}
            </Text>
            <Switch
              value={isDark}
              onValueChange={(v) => setTheme(v ? 'dark' : 'light')}
              trackColor={{ false: colors.muted, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Profile */}
        {profile && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PROFILE</Text>
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.row}>
                <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}18` }]}>
                  <Feather name="user" size={18} color={colors.primary} />
                </View>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                  {profile.name || 'User'}
                </Text>
                <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
                  Level {profile.currentLevel}
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.row}>
                <View style={[styles.iconWrap, { backgroundColor: `${colors.warning}18` }]}>
                  <Feather name="zap" size={18} color={colors.warning} />
                </View>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>Total XP</Text>
                <Text style={[styles.rowValue, { color: colors.warning }]}>{profile.totalXP} XP</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.row}>
                <View style={[styles.iconWrap, { backgroundColor: `${colors.success}18` }]}>
                  <Feather name="activity" size={18} color={colors.success} />
                </View>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>Streak</Text>
                <Text style={[styles.rowValue, { color: colors.success }]}>
                  {profile.streak} days 🔥
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Dev Tools */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DEVELOPER</Text>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Pressable style={styles.row} onPress={handleReset} disabled={resetting}>
            <View style={[styles.iconWrap, { backgroundColor: '#EF444418' }]}>
              <Feather name="trash-2" size={18} color="#EF4444" />
            </View>
            <Text style={[styles.rowLabel, { color: '#EF4444' }]}>
              {resetting ? 'Resetting…' : 'Reset Profile & Start Over'}
            </Text>
            <Feather name="chevron-right" size={16} color="#EF444488" />
          </Pressable>
        </View>

        {/* About */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ABOUT</Text>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}18` }]}>
              <Feather name="info" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>DyslexiaHeal</Text>
            <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>v1.0</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: '#EF444418' }]}>
              <Feather name="heart" size={18} color="#EF4444" />
            </View>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>Made for learners</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 24, paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  scroll: { padding: 20, gap: 8 },
  sectionLabel: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase', letterSpacing: 1,
    marginTop: 12, marginBottom: 6, marginLeft: 4,
  },
  section: {
    borderRadius: 16, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium' },
  rowValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  divider: { height: 1, marginHorizontal: 16 },
});
