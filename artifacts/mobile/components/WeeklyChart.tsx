import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { GameSession } from '@/context/UserContext';

interface WeeklyChartProps {
  sessions: GameSession[];
}

export function WeeklyChart({ sessions }: WeeklyChartProps) {
  const colors = useColors();

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date().getDay();

  const chartData = days.map((day, i) => {
    const targetDate = new Date();
    const diff = i - today;
    targetDate.setDate(targetDate.getDate() + diff);
    const dateStr = targetDate.toDateString();

    const daySessions = sessions.filter(
      (s) => new Date(s.date).toDateString() === dateStr
    );

    const avgAccuracy =
      daySessions.length > 0
        ? daySessions.reduce((sum, s) => sum + s.accuracy, 0) / daySessions.length
        : 0;

    return { day, accuracy: Math.round(avgAccuracy), count: daySessions.length, isToday: i === today };
  });

  const maxVal = Math.max(...chartData.map((d) => d.accuracy), 1);

  return (
    <View style={styles.container}>
      <View style={styles.bars}>
        {chartData.map((item, i) => {
          const barHeight = Math.max(4, (item.accuracy / maxVal) * 80);
          return (
            <View key={i} style={styles.barGroup}>
              {item.count > 0 && (
                <Text style={[styles.barValue, { color: colors.mutedForeground }]}>
                  {item.accuracy}
                </Text>
              )}
              <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: barHeight,
                      backgroundColor: item.isToday ? colors.primary : `${colors.primary}80`,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.dayLabel,
                  {
                    color: item.isToday ? colors.primary : colors.mutedForeground,
                    fontFamily: item.isToday ? 'Inter_700Bold' : 'Inter_400Regular',
                  },
                ]}
              >
                {item.day}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={[styles.baseline, { backgroundColor: colors.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
  },
  bars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 110,
  },
  barGroup: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  barValue: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
  },
  barTrack: {
    width: 24,
    height: 80,
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
  },
  dayLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  baseline: {
    height: 1,
    marginTop: 6,
  },
});
