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
  leaveTeam,
  type TeamMember,
  type TeamWithSport,
} from '@/lib/teams';
import { Alert } from 'react-native';
import { Avatar } from '@/components/Avatar';
import {
  fetchMatchesForTeam,
  formatMatchDate,
  statusLabel,
  type MatchSummary,
} from '@/lib/matches';

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [team, setTeam] = useState<TeamWithSport | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [t, m, ms] = await Promise.all([
      fetchTeamById(id),
      fetchTeamMembers(id),
      fetchMatchesForTeam(id),
    ]);
    setTeam(t);
    setMembers(m);
    setMatches(ms);
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
          <Avatar url={team.photo_url} name={team.name} size={64} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{team.name}</Text>
            <Text style={styles.meta}>
              {team.sport?.name} · {team.city}
              {isCaptain ? ' · capitão' : ''}
            </Text>
          </View>
        </View>

        {isCaptain && (
          <View style={styles.actions}>
            <Pressable
              style={styles.primary}
              onPress={() => router.push(`/(app)/teams/${team.id}/match/new`)}
            >
              <Text style={styles.primaryText}>Marcar jogo</Text>
            </Pressable>
            <Pressable
              style={styles.secondary}
              onPress={() => router.push(`/(app)/teams/${team.id}/edit`)}
            >
              <Text style={styles.secondaryText}>Editar</Text>
            </Pressable>
          </View>
        )}

        {!isCaptain && session && (
          <Pressable
            style={styles.secondary}
            onPress={() =>
              Alert.alert(
                'Sair da equipa?',
                `Vais deixar de ser membro de ${team.name}. Podes voltar com o código de convite.`,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Sair',
                    style: 'destructive',
                    onPress: async () => {
                      const r = await leaveTeam(team.id, session.user.id);
                      if (!r.ok) {
                        Alert.alert('Erro', r.message);
                        return;
                      }
                      router.replace('/(app)');
                    },
                  },
                ],
              )
            }
          >
            <Text style={styles.secondaryText}>Sair da equipa</Text>
          </Pressable>
        )}

        <Text style={[styles.section, { marginTop: 24 }]}>
          Jogos ({matches.length})
        </Text>
        {matches.length === 0 ? (
          <Text style={styles.emptyMatches}>
            Sem jogos ainda. {isCaptain ? 'Toca em "Marcar jogo" para começar.' : ''}
          </Text>
        ) : (
          matches.map((m) => {
            const opponent =
              m.side_a.id === team.id ? m.side_b : m.side_a;
            return (
              <Pressable
                key={m.id}
                style={styles.matchCard}
                onPress={() => router.push(`/(app)/matches/${m.id}`)}
              >
                <View style={styles.matchCardLeft}>
                  <Text style={styles.matchOpponent}>vs {opponent.name}</Text>
                  <Text style={styles.matchWhen}>
                    {formatMatchDate(m.scheduled_at)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    m.status === 'confirmed' && styles.statusConfirmed,
                    m.status === 'cancelled' && styles.statusCancelled,
                    m.status === 'disputed' && styles.statusCancelled,
                  ]}
                >
                  <Text style={styles.statusBadgeText}>
                    {statusLabel(m.status)}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}

        <Text style={[styles.section, { marginTop: 24 }]}>
          Plantel ({members.length})
        </Text>
        {members.map((m) => (
          <Pressable
            key={m.user_id}
            style={styles.member}
            onPress={() => router.push(`/(app)/users/${m.user_id}`)}
          >
            <Avatar url={m.profile?.photo_url} name={m.profile?.name} size={40} />
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>
                {m.profile?.name ?? 'Jogador'}
              </Text>
              <Text style={styles.memberRole}>
                {m.role === 'captain' ? 'Capitão' : 'Membro'}
              </Text>
            </View>
            <Text style={styles.memberArrow}>›</Text>
          </Pressable>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  name: { color: '#ffffff', fontSize: 28, fontWeight: '800' },
  meta: { color: '#a3a3a3', fontSize: 14, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  primary: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#000000', fontSize: 16, fontWeight: '600' },
  secondary: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  secondaryText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  section: {
    color: '#a3a3a3',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  emptyMatches: {
    color: '#737373',
    fontSize: 13,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 8,
  },
  matchCardLeft: { flex: 1 },
  matchOpponent: { color: '#ffffff', fontWeight: '600', fontSize: 15 },
  matchWhen: { color: '#a3a3a3', fontSize: 12, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  statusConfirmed: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderColor: 'rgba(52, 211, 153, 0.4)',
  },
  statusCancelled: {
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
    borderColor: 'rgba(248, 113, 113, 0.4)',
  },
  statusBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '600' },
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
  memberArrow: { color: '#737373', fontSize: 20, marginLeft: 8 },
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
