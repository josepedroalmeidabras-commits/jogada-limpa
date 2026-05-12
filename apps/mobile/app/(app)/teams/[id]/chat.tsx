import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/providers/auth';
import {
  fetchTeamMessages,
  markTeamChatRead,
  sendTeamMessage,
  subscribeTeamMessages,
  type ChatMessage,
} from '@/lib/chat';
import { Screen } from '@/components/Screen';
import { Avatar } from '@/components/Avatar';
import { colors } from '@/theme';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function dayHeader(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (isSameDay(iso, today.toISOString())) return 'Hoje';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(iso, yesterday.toISOString())) return 'Ontem';
  return d.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'short',
  });
}

export default function TeamChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const m = await fetchTeamMessages(id);
    setMessages(m);
    setLoading(false);
    void markTeamChatRead(id);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!id) return;
    const unsub = subscribeTeamMessages(id, (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      void markTeamChatRead(id);
    });
    return unsub;
  }, [id]);

  useEffect(() => {
    // auto-scroll to bottom on new messages
    if (!loading) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length, loading]);

  async function handleSend() {
    if (!id || !text.trim()) return;
    setSending(true);
    const r = await sendTeamMessage(id, text);
    setSending(false);
    if (r.ok) setText('');
  }

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Chat da equipa',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.text} />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scroll}
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({ animated: false })
            }
          >
            {messages.length === 0 ? (
              <Text style={styles.empty}>
                Sem mensagens. Sê o primeiro a escrever. 👋
              </Text>
            ) : (
              messages.map((m, i) => {
                const prev = messages[i - 1];
                const newDay = !prev || !isSameDay(prev.created_at, m.created_at);
                const isMine = m.author_id === session?.user.id;
                return (
                  <View key={m.id}>
                    {newDay && (
                      <Text style={styles.dayHeader}>
                        {dayHeader(m.created_at).toUpperCase()}
                      </Text>
                    )}
                    <View
                      style={[
                        styles.bubbleRow,
                        isMine && styles.bubbleRowMine,
                      ]}
                    >
                      {!isMine && (
                        <Avatar
                          url={m.author?.photo_url}
                          name={m.author?.name}
                          size={28}
                        />
                      )}
                      <View
                        style={[
                          styles.bubble,
                          isMine ? styles.bubbleMine : styles.bubbleOther,
                        ]}
                      >
                        {!isMine && (
                          <Text style={styles.author}>
                            {m.author?.name ?? 'Jogador'}
                          </Text>
                        )}
                        <Text
                          style={[
                            styles.text,
                            isMine && styles.textMine,
                          ]}
                        >
                          {m.text}
                        </Text>
                        <Text
                          style={[
                            styles.time,
                            isMine && styles.timeMine,
                          ]}
                        >
                          {formatTime(m.created_at)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Escreve uma mensagem…"
            placeholderTextColor={colors.textFaint}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={1000}
            editable={!sending}
          />
          <Pressable
            onPress={handleSend}
            disabled={sending || !text.trim()}
            style={[
              styles.sendBtn,
              (!text.trim() || sending) && styles.sendBtnDisabled,
            ]}
          >
            {sending ? (
              <ActivityIndicator color="#0E1812" />
            ) : (
              <Ionicons name="arrow-up" size={20} color="#0E1812" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 24, gap: 4 },
  empty: {
    color: colors.textDim,
    textAlign: 'center',
    marginTop: 32,
    fontSize: 14,
  },
  dayHeader: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginVertical: 12,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 4,
  },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '80%',
    padding: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  bubbleMine: {
    backgroundColor: colors.brand,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderBottomLeftRadius: 4,
  },
  author: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  text: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  textMine: { color: '#0E1812' },
  time: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  timeMine: { color: 'rgba(0,0,0,0.55)' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    color: colors.text,
    fontSize: 15,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
