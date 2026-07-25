import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';

interface Stage {
  id: number;
  label: string;
  labelTh: string;
  delay: number;
}

const PCA_STAGES: Stage[] = [
  { id: 1, label: 'Understanding', labelTh: 'ทำความเข้าใจ', delay: 300 },
  { id: 2, label: 'Strategic Rec.', labelTh: 'วิเคราะห์ยุทธศาสตร์', delay: 2000 },
  { id: 3, label: 'Boundaries', labelTh: 'ข้อจำกัดและมาตรฐาน', delay: 4000 },
];

interface StageItemProps {
  stage: Stage;
  active: boolean;
  colors: ReturnType<typeof useColors>;
}

function StageItem({ stage, active, colors }: StageItemProps) {
  const opacity = useSharedValue(active ? 1 : 0.35);
  const scale = useSharedValue(active ? 1 : 0.95);
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withTiming(active ? 1 : 0.35, { duration: 400 });
    scale.value = withTiming(active ? 1 : 0.95, { duration: 400 });
    if (active) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      pulseOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [active]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: active ? pulseOpacity.value : 1,
  }));

  const styles = createStyles(colors);

  return (
    <Animated.View style={[styles.stageItem, animStyle]}>
      <Animated.View style={[styles.stageDot, active && styles.stageDotActive, dotStyle]} />
      <View style={styles.stageTextWrap}>
        <Text style={[styles.stageLabel, active && styles.stageLabelActive]}>
          {stage.label}
        </Text>
        <Text style={styles.stageLabelTh}>{stage.labelTh}</Text>
      </View>
    </Animated.View>
  );
}

interface PCAProgressProps {
  startTime: number;
}

export default function PCAProgress({ startTime }: PCAProgressProps) {
  const colors = useColors();
  const [activeStage, setActiveStage] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const styles = createStyles(colors);

  useEffect(() => {
    // Start timer
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 100) / 10);
    }, 100);

    // Animate stages
    PCA_STAGES.forEach((stage, idx) => {
      const t = setTimeout(() => {
        setActiveStage(idx);
      }, stage.delay);
      timeoutsRef.current.push(t);
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, [startTime]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.pcaBadge}>
            <Text style={styles.pcaBadgeText}>PCA</Text>
          </View>
          <Text style={styles.headerTitle}>กำลังวิเคราะห์...</Text>
        </View>
        <Text style={styles.timer}>{elapsed.toFixed(1)}s</Text>
      </View>
      <View style={styles.stages}>
        {PCA_STAGES.map((stage, idx) => (
          <StageItem
            key={stage.id}
            stage={stage}
            active={idx <= activeStage}
            colors={colors}
          />
        ))}
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: {
      marginHorizontal: 12,
      marginVertical: 8,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.primary + '33',
      padding: 14,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    pcaBadge: {
      backgroundColor: colors.primary,
      borderRadius: 6,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    pcaBadgeText: {
      color: '#FFF',
      fontSize: 10,
      fontWeight: '700' as const,
      fontFamily: 'Inter_700Bold',
    },
    headerTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '600' as const,
      fontFamily: 'Inter_600SemiBold',
    },
    timer: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '700' as const,
      fontFamily: 'Inter_700Bold',
      letterSpacing: 0.5,
    },
    stages: {
      gap: 8,
    },
    stageItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    stageDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.mutedForeground,
    },
    stageDotActive: {
      backgroundColor: colors.primary,
    },
    stageTextWrap: {
      flex: 1,
    },
    stageLabel: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '600' as const,
      fontFamily: 'Inter_600SemiBold',
    },
    stageLabelActive: {
      color: colors.primary,
    },
    stageLabelTh: {
      color: colors.mutedForeground,
      fontSize: 10,
      fontFamily: 'Inter_400Regular',
      marginTop: 1,
    },
  });
}
