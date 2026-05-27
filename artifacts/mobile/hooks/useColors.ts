import { useTheme } from '@/context/ThemeContext';
import colors from '@/constants/colors';

/**
 * Returns design tokens for the user-selected theme (light or dark).
 * Falls back to light when no preference is stored.
 */
export function useColors() {
  const { theme } = useTheme();
  const palette =
    theme === 'dark' && 'dark' in colors
      ? (colors as Record<string, typeof colors.light>).dark
      : colors.light;
  return { ...palette, radius: colors.radius };
}
