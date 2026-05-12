import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useAuth } from '@/providers/auth';
import {
  fetchTeamById,
  fetchTeamMembers,
  type TeamMember,
  type TeamWithSport,
} from '@/lib/teams';

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [team, setTeam] = useState<TeamWithSport | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [t, m] = await Promise.all([
      fetchTeamById(id),
      fetchTeamMembers(id),
    ]);
    setTeam(t);
    setMembers(m);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color="#ffffff" />
        </View>
      </SafeAreaView>
    );
  }

  if (!team) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.error}>Equipa não encontrada.</Text>
          <Pressable
            style={styles.linkBtn}
            onPress={() => router.replace('/(app)')}
          >
            <Text style={styles.linkBtnText}>Voltar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isCaptain = team.captain_id === session?.user.id;
  const inviteMessage = `Junta-te à minha equipa "${team.name}" na Jogada Limpa. Código: ${team.invite_code}`;

  async function copyCode() {
    await Clipboard.setStringAsync(team!.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareInvite() {
    try {
      await Share.share({ message: inviteMessage });
    } catch (e) {
      console.error('share error', e);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: team.name,
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#ffffff',
        }}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.name}>{team.name}</Text>
          <Text style={styles.meta}>
            {team.sport?.name} · {team.city}
            {isCaptain ? ' · capitão' : ''}
          </Text>
        </View>

        <Text style={styles.section}>Plantel ({members.length})</Text>
        {members.map((m) => (
          <View key={m.user_id} style={styles.member}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(m.profile?.name ?? '?').slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>
                {m.profile?.name ?? 'Jogador'}
              </Text>
              <Text style={styles.memberRole}>
                {m.role === 'captain' ? 'Capitão' : 'Membro'}
              </Text>
            </View>
          </View>
        ))}

        <Text style={[styles.section, { marginTop: 24 }]}>
          Convidar jogadores
        </Text>
        <View style={styles.inviteBox}>
          <Text style={styles.inviteLabel}>Código de convite</Text>
          <Text style={styles.inviteCode}>{team.invite_code}</Text>
          <View style={styles.inviteRow}>
            <Pressable style={styles.inviteBtn} onPress={copyCode}>
              <Text style={styles.inviteBtnText}>
                {copied ? '✓ Copiado' : 'Copiar'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.inviteBtn, styles.inviteBtnPrimary]}
              onPress={shareInvite}
            >
              <Text
                style={[
                  styles.inviteBtnText,
                  styles.inviteBtnTextPrimary,
                ]}
              >
                Partilhar
              </Text>
            </Pressable>
          </View>
          <Text style={styles.inviteHint}>
            Quem tiver o código pode entrar na equipa em "Entrar com código".
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  scroll: { padding: 24, paddingBottom: 48 },
  header: { marginBottom: 24 },
  name: { color: '#ffffff', fontSize: 28, fontWeight: '800' },
  meta: { color: '#a3a3a3', fontSize: 14, marginTop: 4 },
  section: {
    color: '#a3a3a3',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#ffffff', fontWeight: '700' },
  memberInfo: { marginLeft: 12, flex: 1 },
  memberName: { color: '#ffffff', fontSize: 15, fontWeight: '500' },
  memberRole: { color: '#a3a3a3', fontSize: 12, marginTop: 2 },
  inviteBox: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  inviteLabel: {
    color: '#a3a3a3',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  inviteCode: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 8,
    fontFamily: 'Courier',
  },
  inviteRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  inviteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  inviteBtnPrimary: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  inviteBtnText: { color: '#ffffff', fontWeight: '600' },
  inviteBtnTextPrimary: { color: '#000000' },
  inviteHint: {
    color: '#737373',
    fontSize: 13,
    marginTop: 12,
    lineHeight: 18,
  },
  error: { color: '#f87171' },
  linkBtn: { padding: 12 },
  linkBtnText: { color: '#ffffff', fontWeight: '600' },
});
