import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  Pressable,
  Platform,
  Share,
  Alert,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { fetch } from 'expo/fetch';
import { useColors } from '@/hooks/useColors';
import MessageBubble, { type Message, type PCAState } from '@/components/MessageBubble';
import ChatInput from '@/components/ChatInput';
import PCAProgress from '@/components/PCAProgress';

let msgCounter = 0;
function genId(): string {
  msgCounter++;
  return `msg-${Date.now()}-${msgCounter}`;
}

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  content:
    'สวัสดีครับ ผมคือ FIRE KEEPER ระบบประมวลผลปัญญาประดิษฐ์ตามกรอบ PUNN Cognitive Architecture (PCA)\n\nพร้อมช่วยวิเคราะห์และประเมินทางเลือกเชิงยุทธศาสตร์อย่างโปร่งใส โดยรักษาเสรีภาพในการตัดสินใจของคุณ (Human Agency)\n\nกด 📤 เพื่อแชร์ หรือ 📋 เพื่อคัดลอกคำตอบออกไปได้เลยครับ',
  timestamp: new Date().toISOString(),
};

type Tone = 'Formal Architect' | 'Empathetic Guide' | 'Direct Expert';

const TONES: { value: Tone; label: string }[] = [
  { value: 'Formal Architect', label: 'ทางการ' },
  { value: 'Empathetic Guide', label: 'เป็นกันเอง' },
  { value: 'Direct Expert', label: 'กระชับ' },
];

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors, insets);
  const listRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamStartTime, setStreamStartTime] = useState<number | null>(null);
  const [tone, setTone] = useState<Tone>('Formal Architect');
  const [deepReasoning, setDeepReasoning] = useState(false);
  const [showToneBar, setShowToneBar] = useState(false);

  const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

  const handleSend = useCallback(
    async (text: string) => {
      if (isLoading) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const userMsg: Message = {
        id: genId(),
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      const startTime = Date.now();
      setStreamStartTime(startTime);
      setIsLoading(true);

      try {
        // 1. Conversation Memory — send last 10 turns as history
        const history = messages
          .filter((m) => m.id !== 'welcome' && !m.content.startsWith('⚠️'))
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }));

        // Long-term memory is persisted by the API server and is part of
        // retrieval input, rather than an empty client-side placeholder.
        const memoryResponse = await fetch(`${API_BASE}/api/memory`);
        const memoryPayload = memoryResponse.ok
          ? await memoryResponse.json() as {
              items?: Array<{
                content: string;
                layer: string;
                source: string;
                confidence: number;
              }>;
            }
          : { items: [] };

        const response = await fetch(`${API_BASE}/api/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: text,
            tone,
            deepReasoning,
            personalContext: '',
            memories: (memoryPayload.items ?? []).map((memory) => ({
              content: memory.content,
              layer: memory.layer,
              source: memory.source,
              confidence: memory.confidence,
            })),
            history,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error((errData as { error?: string }).error ?? `เซิร์ฟเวอร์ผิดพลาด: ${response.status}`);
        }

        const data = await response.json() as {
          response: string;
          pcaState: PCAState;
        };

        const elapsedMs = Date.now() - startTime;
        const assistantMsg: Message = {
          id: genId(),
          role: 'assistant',
          content: data.response,
          elapsedMs,
          pcaState: data.pcaState,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่';
        setMessages((prev) => [
          ...prev,
          {
            id: genId(),
            role: 'assistant',
            content: `⚠️ เกิดข้อผิดพลาด: ${errorMsg}`,
            elapsedMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsLoading(false);
        setStreamStartTime(null);
      }
    },
    [isLoading, tone, deepReasoning, API_BASE]
  );

  const handleClear = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('ล้างการสนทนา', 'ต้องการลบประวัติการสนทนาทั้งหมดหรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ล้าง',
        style: 'destructive',
        onPress: () => setMessages([WELCOME]),
      },
    ]);
  }, []);

  const handleExportAll = useCallback(async () => {
    const timestamp = new Date().toLocaleString('th-TH');
    let content = `=== FIRE KEEPER — PUNN PCA Session Export ===\nวันที่ส่งออก: ${timestamp}\n`;
    content += `โทน: ${tone} | Deep Reasoning: ${deepReasoning ? 'เปิด' : 'ปิด'}\n`;
    content += `${'═'.repeat(60)}\n\n`;

    messages.forEach((msg) => {
      const role = msg.role === 'user' ? '👤 ผู้ใช้' : '🔥 FIRE KEEPER';
      const time = msg.timestamp
        ? new Date(msg.timestamp).toLocaleTimeString('th-TH')
        : '';
      content += `${role} [${time}]\n${msg.content}\n\n`;
    });

    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ text: content, title: 'FIRE KEEPER Session' });
        return;
      }
      await Share.share({ message: content, title: 'FIRE KEEPER Session' });
    } catch (_err) {
      await Clipboard.setStringAsync(content);
      Alert.alert('คัดลอกแล้ว', 'คัดลอกการสนทนาทั้งหมดไปยังคลิปบอร์ดแล้วครับ');
    }
  }, [messages, tone, deepReasoning]);

  const reversedMessages = [...messages].reverse();

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.fireIcon, { backgroundColor: colors.primary + '22' }]}>
            <Ionicons name="flame" size={22} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>FIRE KEEPER</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              PCA · {tone === 'Formal Architect' ? 'ทางการ' : tone === 'Empathetic Guide' ? 'เป็นกันเอง' : 'กระชับ'}
              {deepReasoning ? ' · Deep' : ''}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          {/* Export all */}
          <Pressable
            onPress={handleExportAll}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
            hitSlop={8}
          >
            <Ionicons name="share-outline" size={20} color={colors.mutedForeground} />
          </Pressable>
          {/* Settings toggle */}
          <Pressable
            onPress={() => setShowToneBar((v) => !v)}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
            hitSlop={8}
          >
            <Ionicons name="options-outline" size={20} color={showToneBar ? colors.primary : colors.mutedForeground} />
          </Pressable>
          {/* Clear */}
          <Pressable
            onPress={handleClear}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
            hitSlop={8}
          >
            <Ionicons name="trash-outline" size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      {/* Settings bar */}
      {showToneBar && (
        <View style={[styles.settingsBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={styles.settingsSection}>
            <Text style={[styles.settingsLabel, { color: colors.mutedForeground }]}>รูปแบบการสื่อสาร:</Text>
            <View style={styles.toneRow}>
              {TONES.map((t) => (
                <Pressable
                  key={t.value}
                  onPress={() => setTone(t.value)}
                  style={[
                    styles.toneBtn,
                    { borderColor: colors.border, backgroundColor: colors.muted },
                    tone === t.value && { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
                  ]}
                >
                  <Text
                    style={[
                      styles.toneBtnText,
                      { color: colors.mutedForeground },
                      tone === t.value && { color: colors.primary, fontFamily: 'Inter_600SemiBold' },
                    ]}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Pressable
            onPress={() => setDeepReasoning((v) => !v)}
            style={styles.deepRow}
          >
            <View style={[styles.deepToggle, deepReasoning && { backgroundColor: colors.primary }]}>
              <View style={[styles.deepKnob, deepReasoning && { transform: [{ translateX: 18 }] }]} />
            </View>
            <Text style={[styles.settingsLabel, { color: colors.foreground }]}>
              Deep Reasoning (วิเคราะห์เชิงลึก)
            </Text>
          </Pressable>
        </View>
      )}

      {/* Chat */}
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={reversedMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          inverted={!!messages.length}
          ListHeaderComponent={
            isLoading && streamStartTime != null ? (
              <PCAProgress startTime={streamStartTime} />
            ) : null
          }
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
        <ChatInput onSend={handleSend} disabled={isLoading} />
        <View style={{ height: Platform.OS === 'web' ? 0 : insets.bottom }} />
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(
  colors: ReturnType<typeof useColors>,
  insets: ReturnType<typeof useSafeAreaInsets>
) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      ...(Platform.OS === 'web' ? { paddingTop: 67 } : {}),
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    fireIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '700' as const,
      fontFamily: 'Inter_700Bold',
      letterSpacing: 0.5,
    },
    headerSub: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      marginTop: 1,
    },
    headerActions: { flexDirection: 'row', gap: 4 },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    settingsBar: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      gap: 10,
    },
    settingsSection: { gap: 6 },
    settingsLabel: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
    },
    toneRow: { flexDirection: 'row', gap: 8 },
    toneBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
    },
    toneBtnText: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
    },
    deepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    deepToggle: {
      width: 40,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    deepKnob: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: '#FFF',
    },
    chatContainer: { flex: 1 },
    listContent: { paddingTop: 8, paddingBottom: 8 },
  });
}
