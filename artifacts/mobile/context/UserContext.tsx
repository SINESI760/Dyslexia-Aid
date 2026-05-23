import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type DyslexiaType = 'phonological' | 'surface' | 'rapid-naming' | 'visual' | 'mixed' | null;
export type DyslexiaLevel = 1 | 2 | 3;

export interface AssessmentResult {
  phase: string;
  score: number;
  totalQuestions: number;
  accuracy: number;
}

export interface GameSession {
  id: string;
  gameId: string;
  gameType: string;
  date: string;
  score: number;
  accuracy: number;
  timeSpent: number;
  level: number;
  xpEarned: number;
}

export interface UserProfile {
  name: string;
  age: number | null;
  dyslexiaType: DyslexiaType;
  dyslexiaLevel: DyslexiaLevel;
  assessmentComplete: boolean;
  assessmentResults: AssessmentResult[];
  currentLevel: number;
  totalXP: number;
  streak: number;
  lastPlayDate: string;
  gameSessions: GameSession[];
}

interface UserContextType {
  profile: UserProfile | null;
  isLoading: boolean;
  isOnboarded: boolean;
  setupProfile: (name: string, age: number) => Promise<void>;
  completeAssessment: (
    results: AssessmentResult[],
    dyslexiaType: DyslexiaType,
    dyslexiaLevel: DyslexiaLevel
  ) => Promise<void>;
  addGameSession: (session: Omit<GameSession, 'id' | 'date'>) => Promise<void>;
  getWeeklySessions: () => GameSession[];
  getAverageAccuracy: () => number;
  getDaysSessions: (dateStr: string) => GameSession[];
  resetProfile: () => Promise<void>;
}

const defaultProfile: UserProfile = {
  name: '',
  age: null,
  dyslexiaType: null,
  dyslexiaLevel: 1,
  assessmentComplete: false,
  assessmentResults: [],
  currentLevel: 1,
  totalXP: 0,
  streak: 0,
  lastPlayDate: '',
  gameSessions: [],
};

const UserContext = createContext<UserContextType | null>(null);
const STORAGE_KEY = '@dyslexia_user_profile_v1';

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as UserProfile;
        setProfile(parsed);
        setIsOnboarded(true);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const saveProfile = async (newProfile: UserProfile) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));
    setProfile(newProfile);
  };

  const setupProfile = useCallback(async (name: string, age: number) => {
    const newProfile: UserProfile = { ...defaultProfile, name, age };
    await saveProfile(newProfile);
    setIsOnboarded(true);
  }, []);

  const completeAssessment = useCallback(
    async (results: AssessmentResult[], dyslexiaType: DyslexiaType, dyslexiaLevel: DyslexiaLevel) => {
      if (!profile) return;
      const updated: UserProfile = {
        ...profile,
        assessmentComplete: true,
        assessmentResults: results,
        dyslexiaType,
        dyslexiaLevel,
      };
      await saveProfile(updated);
    },
    [profile]
  );

  const addGameSession = useCallback(
    async (session: Omit<GameSession, 'id' | 'date'>) => {
      if (!profile) return;
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      const streak =
        profile.lastPlayDate === yesterday
          ? profile.streak + 1
          : profile.lastPlayDate === today
            ? profile.streak
            : 1;

      const newXP = profile.totalXP + session.xpEarned;
      const newLevel = Math.min(10, Math.floor(newXP / 300) + 1);

      const fullSession: GameSession = {
        ...session,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        date: new Date().toISOString(),
      };

      const updated: UserProfile = {
        ...profile,
        gameSessions: [...profile.gameSessions, fullSession],
        totalXP: newXP,
        currentLevel: newLevel,
        streak,
        lastPlayDate: today,
      };
      await saveProfile(updated);
    },
    [profile]
  );

  const getWeeklySessions = useCallback((): GameSession[] => {
    if (!profile) return [];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    return profile.gameSessions.filter((s) => s.date >= weekAgo);
  }, [profile]);

  const getAverageAccuracy = useCallback((): number => {
    const weekly = getWeeklySessions();
    if (weekly.length === 0) return 0;
    return Math.round(weekly.reduce((sum, s) => sum + s.accuracy, 0) / weekly.length);
  }, [getWeeklySessions]);

  const getDaysSessions = useCallback(
    (dateStr: string): GameSession[] => {
      if (!profile) return [];
      return profile.gameSessions.filter((s) => new Date(s.date).toDateString() === dateStr);
    },
    [profile]
  );

  const resetProfile = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setProfile(null);
    setIsOnboarded(false);
  }, []);

  return (
    <UserContext.Provider
      value={{
        profile,
        isLoading,
        isOnboarded,
        setupProfile,
        completeAssessment,
        addGameSession,
        getWeeklySessions,
        getAverageAccuracy,
        getDaysSessions,
        resetProfile,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
