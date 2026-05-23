import { Stack } from 'expo-router';
import React from 'react';

export default function GamesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="assessment" />
      <Stack.Screen name="card-match" />
      <Stack.Screen name="balloon-pop" />
      <Stack.Screen name="letter-sort" />
      <Stack.Screen name="word-scramble" />
      <Stack.Screen name="cake-tower" />
      <Stack.Screen name="sequence" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}
