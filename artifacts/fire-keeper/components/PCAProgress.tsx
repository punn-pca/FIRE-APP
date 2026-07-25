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
  { id: 1, label: 'Observation', labelTh: 'สังเกตการณ์', delay: 0 },
  { id: 2, label: 'Understanding', labelTh: 'ทำความเข้าใจ', delay: 800 },
  { id: 3, label: 'Purpose', labelTh: 'กำหนดเป้าหมาย', delay: 1600 },
  { id: 4, label: 'Memory', labelTh: 'ดึงข้อมูลอดีต', delay: 2400 },
  { id: 5, label: 'Mental Model', labelTh: 'แบบจำลองความคิด', delay: 3200 },
  { id: 6, label: 'Hypothesis', labelTh: 'ตั้งสมมติฐาน', delay: 4000 },
  { id: 7, label: 'Evidence', labelTh: 'ประเมินหลักฐาน', delay: 4800 },
  { id: 8, label: 'Critique', labelTh: 'วิจารณ์ตัวเอง', delay: 5600 },
  { id: 9, label: 'Decision', labelTh: 'ก่อตัวการตัดสินใจ', delay: 6400 },
  { id: 10, label: 'Communication', labelTh: 'สื่อสาร (LLM)', delay: 7200 },
  { id: 11, label: 'Reflection', labelTh: 'สะท้อนคิด', delay: 8000 },
  { id: 12, label: 'Learning', labelTh: 'บันทึกบทเรียน', delay: 8400 },
];

interface StageItemProps {
  stage: Stage;
  active: boolean;
  done: boolean;
  colors: ReturnType<typeof useColors>;
}

function StageItem({ stage, active, done, colors }: StageItemProps) {
  const opacity = useSharedValue(active || done ? 1 : 0.3);
  const scale = useSharedValue(active ? 1 : 0.96);
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withTiming(active || done ? 1 : 0.3, { duration: 350 });
    scale.value = withTiming(active ? 1 : 0.96, { duration: 350 });
    if (active) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.35, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      pulseOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [active, done]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: active ? pulseOpacity.value : 1,
  }));

  return (
    <Animated.View style={[styles.stageItem, animStyle]}>
      <Animated.View
        style={[
          styles.stageDot,
          done && { backgroundColor: '#22C55E' },
          active && { backgroundColor: colors.primary },
          dotStyle,
        ]}
      />
      <View style={styles.stageTextWrap}>
        <Text style={[styles.stageLabel, (active || done) && { color: active ? colors.primary : '#22C55E' }]}>
          {stage.label}
        </Text>
        <Text style={styles.stageLabelTh}>{stage.labelTh}</Text>
      </View>
      {done && <Text style={styles.doneCheck}>✓</Text>}
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

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 100) / 10);
    }, 100);

    PCA_STAGES.forEach((stage, idx) => {
      const t = setTimeout(() => setActiveStage(idx), stage.delay);
      timeoutsRef.current.push(t);
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, [startTime]);

  return (
    <View style={[styles.container, { borderColor: colors.primary + '33', backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.pcaBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.pcaBadgeText}>PCA</Text>
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>กำลังวิเคราะห์...</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              12-Stage Cognitive Pipeline
            </Text>
          </View>
        </View>
        <Text style={[styles.timer, { color: colors.primary }]}>{elapsed.toFixed(1)}s</Text>
      </View>

      <View style={styles.stages}>
        {PCA_STAGES.map((stage, idx) => (
          <StageItem
            key={stage.id}
            stage={stage}
            active={idx === activeStage}
            done={idx < activeStage}
            colors={colors}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
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
    fontSize: 13,
    fontWeight: '600' as const,
    fontFamily: 'Inter_600SemiBold',
  },
  headerSub: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  timer: {
    fontSize: 14,
    fontWeight: '700' as const,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  stages: { gap: 7 },
  stageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stageDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#555',
  },
  stageTextWrap: { flex: 1 },
  stageLabel: {
    color: '#666',
    fontSize: 11,
    fontWeight: '600' as const,
    fontFamily: 'Inter_600SemiBold',
  },
  stageLabelTh: {
    color: '#666',
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  doneCheck: {
    color: '#22C55E',
    fontSize: 11,
    fontWeight: '700' as const,
  },
});
