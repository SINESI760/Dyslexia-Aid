import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { GAME_ROTATIONS } from '@/constants/games';

export interface DailyGame {
  id: string;
  gameType: string;
  level: number;
  completed: boolean;
  score?: number;
  accuracy?: number;
  xpEarned?: number;
}

export interface DailyProgress {
  date: string;
  games: DailyGame[];
  completedCount: number;
}

interface GameContextType {
  dailyProgress: DailyProgress | null;
  isLoading: boolean;
  initializeDailyGames: (dyslexiaType: string | null, level: number) => Promise<void>;
  completeGame: (gameId: string, score: number, accuracy: number, xpEarned: number) => Promise<void>;
  getDailyCompletionPercent: () => number;
  getNextGame: () => DailyGame | null;
}

const STORAGE_KEY = '@dyslexia_daily_progress_v1';
const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [dailyProgress, setDailyProgress] = useState<DailyProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDailyProgress();
  }, []);

  const loadDailyProgress = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as DailyProgress;
        const today = new Date().toDateString();
        if (parsed.date === today) {
          // Strip any removed games (e.g. cake-tower) from persisted queues
          const REMOVED_GAMES = ['cake-tower'];
          const filtered = parsed.games.filter((g) => !REMOVED_GAMES.includes(g.gameType));
          const completedCount = filtered.filter((g) => g.completed).length;
          const cleaned: DailyProgress = { ...parsed, games: filtered, completedCount };
          if (filtered.length !== parsed.games.length) {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
          }
          setDailyProgress(cleaned);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const initializeDailyGames = useCallback(
    async (dyslexiaType: string | null, level: number) => {
      const today = new Date().toDateString();
      if (dailyProgress?.date === today) return;

      const rotation = GAME_ROTATIONS[dyslexiaType ?? 'default'] || GAME_ROTATIONS.default;
      const games: DailyGame[] = rotation.map((gameType, i) => ({
        id: `${today}-${i}-${gameType}`,
        gameType,
        level,
        completed: false,
      }));

      const newProgress: DailyProgress = { date: today, games, completedCount: 0 };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newProgress));
      setDailyProgress(newProgress);
    },
    [dailyProgress]
  );

  const completeGame = useCallback(
    async (gameId: string, score: number, accuracy: number, xpEarned: number) => {
      if (!dailyProgress) return;
      const updated: DailyProgress = {
        ...dailyProgress,
        games: dailyProgress.games.map((g) =>
          g.id === gameId ? { ...g, completed: true, score, accuracy, xpEarned } : g
        ),
        completedCount: dailyProgress.completedCount + 1,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setDailyProgress(updated);
    },
    [dailyProgress]
  );

  const getDailyCompletionPercent = useCallback((): number => {
    if (!dailyProgress || dailyProgress.games.length === 0) return 0;
    return (dailyProgress.completedCount / dailyProgress.games.length) * 100;
  }, [dailyProgress]);

  const getNextGame = useCallback((): DailyGame | null => {
    if (!dailyProgress) return null;
    return dailyProgress.games.find((g) => !g.completed) ?? null;
  }, [dailyProgress]);

  return (
    <GameContext.Provider
      value={{
        dailyProgress,
        isLoading,
        initializeDailyGames,
        completeGame,
        getDailyCompletionPercent,
        getNextGame,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
