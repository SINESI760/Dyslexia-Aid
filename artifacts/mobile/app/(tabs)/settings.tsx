import React from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, ScrollView, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { router } from 'expo-router';

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { theme, setTheme } = useTheme();
  const { profile, resetProfile } = useUser();
  const topPad = Platform.OS === 'web' ? 60 : insets.top;
  const botPad = Platform.OS === 'web' ? 84 : insets.bottom + 20;

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
          {/* Light mode */}
          <Pressable
            onPress={() => setTheme('light')}
            style={({ pressed }) => [
              styles.themeOption,
              {
                backgroundColor: !isDark ? `${colors.primary}15` : 'transparent',
                borderColor: !isDark ? colors.primary : colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <View style={[styles.themeIconWrap, { backgroundColor: '#F9F8FF' }]}>
              <Feather name="sun" size={20} color="#6366F1" />
            </View>
            <View style={styles.themeTextWrap}>
              <Text style={[styles.themeTitle, { color: colors.foreground }]}>Light</Text>
              <Text style={[styles.themeSub, { color: colors.mutedForeground }]}>Bright background</Text>
            </View>
            {!isDark && (
              <View style={[styles.checkCircle, { backgroundColor: colors.primary }]}>
                <Feather name="check" size={13} color="#fff" />
              </View>
            )}
          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Dark mode */}
          <Pressable
            onPress={() => setTheme('dark')}
            style={({ pressed }) => [
              styles.themeOption,
              {
                backgroundColor: isDark ? `${colors.primary}15` : 'transparent',
                borderColor: isDark ? colors.primary : colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <View style={[styles.themeIconWrap, { backgroundColor: '#0F0D1C' }]}>
              <Feather name="moon" size={20} color="#818CF8" />
            </View>
            <View style={styles.themeTextWrap}>
              <Text style={[styles.themeTitle, { color: colors.foreground }]}>Dark</Text>
              <Text style={[styles.themeSub, { color: colors.mutedForeground }]}>Easy on the eyes</Text>
            </View>
            {isDark && (
              <View style={[styles.checkCircle, { backgroundColor: colors.primary }]}>
                <Feather name="check" size={13} color={colors.primaryForeground} />
              </View>
            )}
          </Pressable>
        </View>

        {/* Quick toggle */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <Feather name={isDark ? 'moon' : 'sun'} size={18} color={colors.primary} />
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>Dark Mode</Text>
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
                <Feather name="user" size={18} color={colors.primary} />
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>{profile.name || 'User'}</Text>
                <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
                  Level {profile.currentLevel}
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.row}>
                <Feather name="zap" size={18} color={colors.warning} />
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>Total XP</Text>
                <Text style={[styles.rowValue, { color: colors.warning }]}>{profile.totalXP} XP</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.row}>
                <Feather name="activity" size={18} color={colors.success} />
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>Streak</Text>
                <Text style={[styles.rowValue, { color: colors.success }]}>{profile.streak} days 🔥</Text>
              </View>
            </View>
          </>
        )}

        {/* About */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ABOUT</Text>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <Feather name="info" size={18} color={colors.primary} />
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>DyslexiaHeal</Text>
            <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>v1.0</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.row}>
            <Feather name="heart" size={18} color="#EF4444" />
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
  themeOption: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, borderWidth: 0,
  },
  themeIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  themeTextWrap: { flex: 1 },
  themeTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  themeSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  checkCircle: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  divider: { height: 1, marginHorizontal: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium' },
  rowValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
