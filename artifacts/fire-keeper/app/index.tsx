import React, { useRef, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  Pressable,
  Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fetch } from 'expo/fetch';
import { useColors } from '@/hooks/useColors';
import MessageBubble, { Message } from '@/components/MessageBubble';
import ChatInput from '@/components/ChatInput';
import PCAProgress from '@/components/PCAProgress';

let messageCounter = 0;
function generateId(): string {
  messageCounter++;
  return `msg-${Date.now()}-${messageCounter}-${Math.random().toString(36).substr(2, 9)}`;
}

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content:
    'สวัสดีครับ ผมคือ FIRE KEEPER ระบบประมวลผลปัญญาประดิษฐ์ตามกรอบ PUNN Cognitive Architecture (PCA)\n\nพร้อมช่วยเหลือคุณในการวิเคราะห์และประเมินทางเลือกเชิงยุทธศาสตร์อย่างโปร่งใส โดยรักษาเสรีภาพในการเลือกของคุณ (Human Agency)',
};

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors, insets);
  const inputRef = useRef<View>(null);

  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStartTime, setStreamStartTime] = useState<number | null>(null);

  const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

  const handleSend = async (text: string) => {
    if (isStreaming) return;

    const currentMessages = [...messages];
    const userMsg: Message = { id: generateId(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);

    const startTime = Date.now();
    setStreamStartTime(startTime);
    setIsStreaming(true);

    let fullContent = '';
    let assistantAdded = false;
    const assistantId = generateId();

    try {
      const history = [
        ...currentMessages
          .filter((m) => m.id !== 'welcome')
          .map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: text },
      ];

      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ messages: history }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.content) {
              fullContent += parsed.content;
              const elapsedMs = Date.now() - startTime;

              if (!assistantAdded) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: assistantId,
                    role: 'assistant',
                    content: fullContent,
                    elapsedMs,
                  },
                ]);
                assistantAdded = true;
              } else {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: fullContent,
                    elapsedMs,
                  };
                  return updated;
                });
              }
            }
          } catch (parseErr) {
            if ((parseErr as Error).message !== 'Unexpected end of JSON input') {
              throw parseErr;
            }
          }
        }
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: `เกิดข้อผิดพลาด: ${errorMsg}`,
          elapsedMs: Date.now() - startTime,
        },
      ]);
    } finally {
      setIsStreaming(false);
      setStreamStartTime(null);
    }
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMessages([WELCOME_MESSAGE]);
  };

  const reversedMessages = [...messages].reverse();

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerLeft}>
          <View style={styles.fireIcon}>
            <Ionicons name="flame" size={22} color="#FF6B2C" />
          </View>
          <View>
            <Text style={styles.headerTitle}>FIRE KEEPER</Text>
            <Text style={styles.headerSub}>PCA Cognitive System</Text>
          </View>
        </View>
        <Pressable
          onPress={handleClear}
          style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="trash-outline" size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Chat */}
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <FlatList
          data={reversedMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          inverted={!!messages.length}
          ListHeaderComponent={
            isStreaming && streamStartTime != null ? (
              <PCAProgress startTime={streamStartTime} />
            ) : null
          }
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!!messages.length}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
        <ChatInput onSend={handleSend} disabled={isStreaming} />
        <View style={{ height: Platform.OS === 'web' ? 0 : insets.bottom }} />
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
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
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    fireIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary + '22',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      color: colors.foreground,
      fontSize: 17,
      fontWeight: '700' as const,
      fontFamily: 'Inter_700Bold',
      letterSpacing: 0.5,
    },
    headerSub: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      marginTop: 1,
    },
    clearBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chatContainer: {
      flex: 1,
    },
    listContent: {
      paddingTop: 8,
      paddingBottom: 8,
    },
  });
}
