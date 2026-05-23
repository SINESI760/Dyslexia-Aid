# DyslexiaHeal

A therapeutic mobile app that helps users improve reading skills through adaptive daily games targeting different types of dyslexia.

## Run & Operate

- `pnpm --filter @workspace/mobile run dev` — start the Expo dev server
- `pnpm run typecheck` — full typecheck across all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo (SDK 52) + Expo Router (file-based routing)
- Storage: AsyncStorage (no backend — all data local)
- UI: React Native + @expo/vector-icons (Feather)
- Fonts: @expo-google-fonts/inter (loads in background, system font fallback)
- Animations: React Native Animated API (useNativeDriver: false for web compat)

## Where things live

- `artifacts/mobile/app/` — Expo Router screens
  - `(tabs)/` — home, games, progress tab screens
  - `games/` — game screens + assessment + complete
  - `onboarding.tsx` — 3-step onboarding flow
- `artifacts/mobile/context/` — UserContext (profile) + GameContext (daily queue)
- `artifacts/mobile/constants/games.ts` — game data, word lists, GAME_ROTATIONS
- `artifacts/mobile/components/` — ProgressBar, GameCard, StatsCard, WeeklyChart

## Architecture decisions

- No backend — all user state stored in AsyncStorage (`@dyslexia_user_profile_v1`, `@dyslexia_daily_progress_v1`)
- Font loading does NOT block app render — `SplashScreen.hideAsync()` fires immediately; fonts load in background with system font fallback
- `useNativeDriver: false` on all Animated calls for web compatibility
- App flow: launch → check profile → onboarding (if new) → assessment → daily games tab

## Product

- 5-phase assessment identifies dyslexia type (phonological/visual/rapid-naming/surface/mixed) and severity (mild/moderate/severe)
- 6 therapeutic games: Card Match, Balloon Pop, Letter Sort, Word Scramble, Cake Tower, Memory Sequence
- Daily 7-game rotation tailored to dyslexia type, tracked with progress bar
- Weekly progress report with XP, streaks, and accuracy charts

## User preferences

- Dyslexia-friendly UI: high contrast, large touch targets, clean layout, indigo (#6366F1) as primary color

## Gotchas

- Do NOT block rendering on font loading — call `SplashScreen.hideAsync()` immediately in useEffect
- `KeyboardProvider` from react-native-keyboard-controller removed from layout (caused blank screen on web)
- GAME_ROTATIONS uses 'sequence' as key — maps to `app/games/sequence.tsx`
- Web preview uses REPLIT_EXPO_DEV_DOMAIN (Expo domain routing), not localhost:80
