import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  elapsedMs?: number;
}

interface ParsedSection {
  type: 'header' | 'text' | 'summary' | 'bullet';
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
    const headerMatch = line.match(/^###\s+(\d+)\.\s+(.+)/);
    const summaryMatch = line.match(/^\[DECISION_SUMMARY\]:\s*(.*)/);

    if (headerMatch) {
      flushText();
      const stageNum = parseInt(headerMatch[1], 10);
      const title = headerMatch[2].trim();
      sections.push({ type: 'header', stageNum, title, content: '' });
    } else if (summaryMatch) {
      flushText();
      sections.push({ type: 'summary', content: summaryMatch[1] || '' });
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
      return (
        <Text key={i} style={boldStyle}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return <Text key={i} style={baseStyle}>{part}</Text>;
  });
}

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const colors = useColors();
  const styles = createStyles(colors);
  const isUser = message.role === 'user';

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

  return (
    <View style={[styles.wrapper, isUser ? styles.wrapperUser : styles.wrapperAI]}>
      {isUser ? (
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.content}</Text>
        </View>
      ) : (
        <View style={styles.aiBubble}>
          {!hasPCA ? (
            // Plain text (streaming)
            <Text style={styles.aiText}>{message.content}</Text>
          ) : (
            // PCA structured response
            <View>
              {sections!.map((sec, idx) => {
                if (sec.type === 'header') {
                  const stageColors = ['#FF6B2C', '#FF8C42', '#FFB347'];
                  const c = stageColors[(sec.stageNum ?? 1) - 1] ?? colors.primary;
                  return (
                    <View key={idx} style={styles.sectionHeader}>
                      <View style={[styles.sectionTag, { backgroundColor: c + '22' }]}>
                        <Text style={[styles.sectionTagText, { color: c }]}>
                          {sec.stageNum}
                        </Text>
                      </View>
                      <Text style={[styles.sectionTitle, { color: c }]}>
                        {sec.title}
                      </Text>
                    </View>
                  );
                }
                if (sec.type === 'summary') {
                  return (
                    <View key={idx} style={styles.summaryBox}>
                      <Text style={styles.summaryLabel}>DECISION SUMMARY</Text>
                      <Text style={styles.summaryText}>{sec.content}</Text>
                    </View>
                  );
                }
                if (sec.type === 'text' && sec.content) {
                  const lines = sec.content.split('\n').filter(Boolean);
                  return (
                    <View key={idx} style={styles.textBlock}>
                      {lines.map((line, li) => {
                        const bulletMatch = line.match(/^[-•]\s+(.*)/);
                        if (bulletMatch) {
                          return (
                            <View key={li} style={styles.bulletRow}>
                              <Text style={styles.bulletDot}>•</Text>
                              <Text style={styles.bulletText}>
                                {renderInlineMarkdown(
                                  bulletMatch[1],
                                  styles.bulletText,
                                  styles.bold
                                )}
                              </Text>
                            </View>
                          );
                        }
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
              })}
            </View>
          )}

          {/* Footer: elapsed time */}
          {elapsedLabel && (
            <View style={styles.footer}>
              <View style={styles.elapsedBadge}>
                <Text style={styles.elapsedText}>{elapsedLabel}</Text>
              </View>
            </View>
          )}
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
    wrapperUser: {
      alignItems: 'flex-end',
    },
    wrapperAI: {
      alignItems: 'flex-start',
    },
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
      maxWidth: '92%',
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
      marginTop: 12,
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
    textBlock: {
      gap: 4,
      marginBottom: 4,
    },
    bulletRow: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'flex-start',
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
    footer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 8,
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
  });
}
