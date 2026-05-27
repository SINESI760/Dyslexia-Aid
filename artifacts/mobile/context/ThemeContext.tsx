import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  setTheme: async () => {},
});

const THEME_KEY = '@app_theme_v1';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('light');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((val) => {
      if (val === 'dark' || val === 'light') setThemeState(val);
    });
  }, []);

  const setTheme = useCallback(async (t: ThemeMode) => {
    setThemeState(t);
    await AsyncStorage.setItem(THEME_KEY, t);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
