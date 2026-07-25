import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Share,
  Platform,
  ToastAndroid,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export interface PCAState {
  notes: string[];
  observations: string[];
  understanding: string;
  purpose: string;
  decision: string;
  confidence: "สูง" | "ปานกลาง" | "ต่ำ" | "ไม่สามารถประเมินได้";
  critique: string[];
  reflection: string[];
  learning: string[];
  agency_checks: string[];
  trace: Array<{ stage: string; timestamp: string; output: Record<string, unknown> }>;
  llm_provider?: string;
  llm_model?: string;
  execution_time_ms?: number;
  start_time?: string;
  end_time?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  elapsedMs?: number;
  pcaState?: PCAState;
  timestamp?: string;
}

interface ParsedSection {
  type: 'header' | 'text' | 'summary' | 'bullet' | 'hr';
  stageNum?: number;
  title?: string;
  content: string;
}

function parsePCAContent(text: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const lines = text.split('\n');
  let current: string[] = [];

  const flushText = () => {
    const t = current.join('\n').trim();
    if (t) sections.push({ type: 'text', content: t });
    current = [];
  };

  for (const line of lines) {
    const h3Match = line.match(/^###\s+(\d+)\.\s+(.*)/);
    const h3HashMatch = line.match(/^###\s+#\s+(.*)/);
    const h3Plain = line.match(/^###\s+(.*)/);
    const summaryMatch = line.match(/^\[DECISION_SUMMARY\]:\s*(.*)/);
    const hrMatch = line.match(/^[=─]{4,}/);

    if (h3Match) {
      flushText();
      sections.push({ type: 'header', stageNum: parseInt(h3Match[1], 10), title: h3Match[2].trim(), content: '' });
    } else if (h3HashMatch) {
      flushText();
      sections.push({ type: 'header', title: h3HashMatch[1].trim(), content: '' });
    } else if (h3Plain && !h3Match) {
      flushText();
      sections.push({ type: 'header', title: h3Plain[1].trim(), content: '' });
    } else if (summaryMatch) {
      flushText();
      sections.push({ type: 'summary', content: summaryMatch[1] || '' });
    } else if (hrMatch) {
      flushText();
      sections.push({ type: 'hr', content: '' });
    } else {
      current.push(line);
    }
  }
  flushText();
  return sections;
}

function renderInlineMarkdown(text: string, baseStyle: object, boldStyle: object) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <Text key={i} style={boldStyle}>{part.slice(2, -2)}</Text>;
    }
    return <Text key={i} style={baseStyle}>{part}</Text>;
  });
}

interface MessageBubbleProps {
  message: Message;
}

async function shareAsFile(content: string, filename: string) {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
    await navigator.share({ text: content, title: filename });
    return;
  }
  await Share.share({ message: content, title: filename });
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const colors = useColors();
  const styles = createStyles(colors);
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [showPCA, setShowPCA] = useState(false);

  const sections = useMemo(() => {
    if (isUser) return null;
    return parsePCAContent(message.content);
  }, [message.content, isUser]);

  const hasPCA = sections && sections.some((s) => s.type === 'header');

  const elapsedLabel =
    message.elapsedMs != null
      ? message.elapsedMs >= 1000
        ? `${(message.elapsedMs / 1000).toFixed(1)}s`
        : `${message.elapsedMs}ms`
      : null;

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(message.content);
    setCopied(true);
    if (Platform.OS === 'android') {
      ToastAndroid.show('คัดลอกแล้ว', ToastAndroid.SHORT);
    }
    setTimeout(() => setCopied(false), 2000);
  }, [message.content]);

  const handleShare = useCallback(async () => {
    const timestamp = new Date().toLocaleString('th-TH');
    const filename = `FIRE_KEEPER_${Date.now()}.txt`;
    let content = `=== FIRE KEEPER — PUNN PCA Analysis ===\nวันที่: ${timestamp}\n\n`;

    if (message.pcaState) {
      content += `ระดับความมั่นใจ (ประมาณการเชิงคุณภาพ): ${message.pcaState.confidence}\n`;
      content += `โมเดล: ${message.pcaState.llm_provider ?? 'openai'} (${message.pcaState.llm_model ?? 'gpt-4o'})\n`;
      if (message.pcaState.execution_time_ms) {
        content += `เวลาประมวลผล: ${(message.pcaState.execution_time_ms / 1000).toFixed(2)}s\n`;
      }
      content += '\n';
    }

    content += `=== คำตอบ ===\n${message.content}\n`;

    if (message.pcaState) {
      content += `\n=== กระบวนการคิด PCA ===\n`;
      content += `เข้าใจบริบท: ${message.pcaState.understanding}\n`;
      content += `เป้าหมาย: ${message.pcaState.purpose}\n`;
      content += `\nข้อวิจารณ์:\n${message.pcaState.critique.map((c) => `- ${c}`).join('\n')}\n`;
      content += `\nการสะท้อนคิด:\n${message.pcaState.reflection.map((r) => `- ${r}`).join('\n')}\n`;
    }

    try {
      await shareAsFile(content, filename);
    } catch (err) {
      // Fallback to basic share
      await Share.share({ message: content, title: 'FIRE KEEPER Analysis' });
    }
  }, [message]);

  const renderSections = () => {
    if (!sections) return null;
    return sections.map((sec, idx) => {
      if (sec.type === 'header') {
        const stageColors = [
          '#FF6B2C', '#FF8C42', '#FFB347', '#E8844A', '#D97D3A',
          '#C4712F', '#B06525', '#9C591B', '#884E12', '#744208',
        ];
        const c = sec.stageNum
          ? stageColors[(sec.stageNum - 1) % stageColors.length]
          : colors.primary;
        return (
          <View key={idx} style={styles.sectionHeader}>
            {sec.stageNum != null && (
              <View style={[styles.sectionTag, { backgroundColor: c + '22' }]}>
                <Text style={[styles.sectionTagText, { color: c }]}>{sec.stageNum}</Text>
              </View>
            )}
            <Text style={[styles.sectionTitle, { color: c }]}>{sec.title}</Text>
          </View>
        );
      }
      if (sec.type === 'summary') {
        return (
          <View key={idx} style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>🔥 DECISION SUMMARY</Text>
            <Text style={styles.summaryText}>{sec.content}</Text>
          </View>
        );
      }
      if (sec.type === 'hr') {
        return <View key={idx} style={styles.hr} />;
      }
      if (sec.type === 'text' && sec.content) {
        const lines = sec.content.split('\n').filter(Boolean);
        return (
          <View key={idx} style={styles.textBlock}>
            {lines.map((line, li) => {
              const bulletMatch = line.match(/^[-•*]\s+(.*)/);
              const numberedMatch = line.match(/^(\d+)\.\s+(.*)/);
              if (bulletMatch) {
                return (
                  <View key={li} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>
                      {renderInlineMarkdown(bulletMatch[1], styles.bulletText, styles.bold)}
                    </Text>
                  </View>
                );
              }
              if (numberedMatch) {
                return (
                  <View key={li} style={styles.bulletRow}>
                    <Text style={[styles.bulletDot, { width: 18 }]}>{numberedMatch[1]}.</Text>
                    <Text style={styles.bulletText}>
                      {renderInlineMarkdown(numberedMatch[2], styles.bulletText, styles.bold)}
                    </Text>
                  </View>
                );
              }
              if (line.startsWith('#')) return null;
              return (
                <Text key={li} style={styles.aiText}>
                  {renderInlineMarkdown(line, styles.aiText, styles.bold)}
                </Text>
              );
            })}
          </View>
        );
      }
      return null;
    });
  };

  return (
    <View style={[styles.wrapper, isUser ? styles.wrapperUser : styles.wrapperAI]}>
      {isUser ? (
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.content}</Text>
        </View>
      ) : (
        <View style={styles.aiBubble}>
          {/* Content */}
          {!hasPCA ? (
            <Text style={styles.aiText}>{message.content}</Text>
          ) : (
            <View>{renderSections()}</View>
          )}

          {/* PCA Meta (collapsible) */}
          {message.pcaState && (
            <Pressable onPress={() => setShowPCA(!showPCA)} style={styles.pcaToggle}>
              <Text style={styles.pcaToggleText}>
                {showPCA ? '▲ ซ่อนข้อมูล PCA' : '▼ แสดงข้อมูล PCA'}
              </Text>
              <Text style={[
                styles.pcaConfidence,
                message.pcaState.confidence === 'สูง' && { color: '#22c55e' },
                message.pcaState.confidence === 'ต่ำ' && { color: '#f97316' },
                message.pcaState.confidence === 'ไม่สามารถประเมินได้' && { color: '#94a3b8' },
              ]}>
                ความมั่นใจ: {message.pcaState.confidence}
              </Text>
            </Pressable>
          )}
          {showPCA && message.pcaState && (
            <View style={styles.pcaMeta}>
              <Text style={styles.pcaMetaRow}>
                <Text style={styles.pcaMetaLabel}>โมเดล: </Text>
                {message.pcaState.llm_provider} ({message.pcaState.llm_model})
              </Text>
              {message.pcaState.execution_time_ms != null && (
                <Text style={styles.pcaMetaRow}>
                  <Text style={styles.pcaMetaLabel}>เวลา: </Text>
                  {(message.pcaState.execution_time_ms / 1000).toFixed(2)}s
                </Text>
              )}
              <Text style={styles.pcaMetaRow}>
                <Text style={styles.pcaMetaLabel}>ขั้นตอน: </Text>
                {message.pcaState.trace.length} stages
              </Text>
              <Text style={[styles.pcaMetaRow, { marginTop: 6 }]}>
                <Text style={styles.pcaMetaLabel}>บริบท: </Text>
                {message.pcaState.understanding}
              </Text>
            </View>
          )}

          {/* Footer: actions */}
          <View style={styles.footer}>
            {elapsedLabel && (
              <View style={styles.elapsedBadge}>
                <Text style={styles.elapsedText}>{elapsedLabel}</Text>
              </View>
            )}
            <View style={styles.actions}>
              <Pressable
                onPress={handleCopy}
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}
                hitSlop={8}
              >
                <Ionicons
                  name={copied ? 'checkmark' : 'copy-outline'}
                  size={16}
                  color={copied ? '#22C55E' : colors.mutedForeground}
                />
                <Text style={[styles.actionLabel, copied && { color: '#22C55E' }]}>
                  {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleShare}
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}
                hitSlop={8}
              >
                <Ionicons name="share-outline" size={16} color={colors.mutedForeground} />
                <Text style={styles.actionLabel}>แชร์</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    wrapper: {
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    wrapperUser: { alignItems: 'flex-end' },
    wrapperAI: { alignItems: 'flex-start' },
    userBubble: {
      maxWidth: '80%',
      backgroundColor: colors.primary,
      borderRadius: 20,
      borderBottomRightRadius: 4,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    userText: {
      color: '#FFF',
      fontSize: 15,
      fontFamily: 'Inter_400Regular',
      lineHeight: 22,
    },
    aiBubble: {
      maxWidth: '96%',
      backgroundColor: colors.card,
      borderRadius: 20,
      borderBottomLeftRadius: 4,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    aiText: {
      color: colors.foreground,
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      lineHeight: 22,
    },
    bold: {
      color: colors.foreground,
      fontSize: 14,
      fontFamily: 'Inter_700Bold',
      lineHeight: 22,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 14,
      marginBottom: 4,
    },
    sectionTag: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTagText: {
      fontSize: 11,
      fontWeight: '700' as const,
      fontFamily: 'Inter_700Bold',
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700' as const,
      fontFamily: 'Inter_700Bold',
      flex: 1,
      flexWrap: 'wrap',
    },
    textBlock: { gap: 4, marginBottom: 4 },
    bulletRow: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'flex-start',
      marginBottom: 2,
    },
    bulletDot: {
      color: colors.primary,
      fontSize: 14,
      lineHeight: 22,
    },
    bulletText: {
      color: colors.foreground,
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      lineHeight: 22,
      flex: 1,
    },
    summaryBox: {
      marginTop: 12,
      backgroundColor: colors.primary + '18',
      borderRadius: 12,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      padding: 12,
    },
    summaryLabel: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: '700' as const,
      fontFamily: 'Inter_700Bold',
      letterSpacing: 1,
      marginBottom: 4,
    },
    summaryText: {
      color: colors.foreground,
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      lineHeight: 20,
    },
    hr: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 8,
    },
    pcaToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    pcaToggleText: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
    },
    pcaConfidence: {
      color: colors.primary,
      fontSize: 11,
      fontFamily: 'Inter_600SemiBold',
      fontWeight: '600' as const,
    },
    pcaMeta: {
      marginTop: 8,
      backgroundColor: colors.muted,
      borderRadius: 8,
      padding: 10,
      gap: 4,
    },
    pcaMetaRow: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      lineHeight: 18,
    },
    pcaMetaLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontWeight: '600' as const,
      color: colors.foreground,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    elapsedBadge: {
      backgroundColor: colors.primary + '22',
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    elapsedText: {
      color: colors.primary,
      fontSize: 11,
      fontFamily: 'Inter_500Medium',
    },
    actions: {
      flexDirection: 'row',
      gap: 12,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    actionLabel: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
    },
  });
}
