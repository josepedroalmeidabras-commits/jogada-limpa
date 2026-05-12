import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeInDown } from 'react-native-reanimated';
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
import {
  computeTeamRecord,
  fetchMatchesForTeam,
  type MatchSummary,
  type TeamRecord,
} from '@/lib/matches';
import {
  fetchSuggestedOpponents,
  type SuggestedOpponent,
} from '@/lib/h2h';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { Heading, Eyebrow } from '@/components/Heading';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import {
  MatchListItem,
  MatchListGroup,
} from '@/components/MatchListItem';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [team, setTeam] = useState<TeamWithSport | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [suggested, setSuggested] = useState<SuggestedOpponent[]>([]);
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
    if (t && session && t.captain_id === session.user.id) {
      const sug = await fetchSuggestedOpponents(t.id, 5);
      setSuggested(sug);
    }
    setLoading(false);
  }, [id, session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) {
    return (
      <Screen>
        <View style={{ padding: 24, gap: 12 }}>
          <Skeleton width={64} height={64} radius={32} />
          <Skeleton width={200} height={28} />
          <Skeleton height={70} radius={16} style={{ marginTop: 12 }} />
          <Skeleton height={70} radius={16} />
        </View>
      </Screen>
    );
  }

  if (!team) {
    return (
      <Screen>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <Text style={{ color: '#a3a3a3' }}>Equipa não encontrada.</Text>
          <Button
            label="Voltar"
            variant="secondary"
            onPress={() => router.replace('/(app)')}
          />
        </View>
      </Screen>
    );
  }

  const isCaptain = team.captain_id === session?.user.id;
  const inviteMessage =
    `Junta-te à minha equipa "${team.name}" na Jogada Limpa ⚽\n\n` +
    `Código de entrada: ${team.invite_code.toUpperCase()}\n\n` +
    `Descarrega a app em jogadalimpa.app e insere o código.`;

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

  const record = computeTeamRecord(matches, team.id);

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: team.name,
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#ffffff',
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.duration(300).springify()}
          style={styles.header}
        >
          <Avatar url={team.photo_url} name={team.name} size={72} />
          <View style={{ flex: 1 }}>
            <Heading level={2}>{team.name}</Heading>
            <Text style={styles.meta}>
              {`${team.sport?.name ?? 'Futebol 7'} · ${team.city}${
                isCaptain ? ' · capitão' : ''
              }`}
            </Text>
          </View>
          {members.some((m) => m.user_id === session?.user.id) && (
            <Pressable
              onPress={() => router.push(`/(app)/teams/${team.id}/chat`)}
              style={styles.chatBtn}
            >
              <Ionicons
                name="chatbubble-ellipses"
                size={20}
                color={colors.brand}
              />
            </Pressable>
          )}
        </Animated.View>

        {team.description && (
          <Animated.View entering={FadeInDown.delay(60).springify()}>
            <Card style={{ marginTop: 16 }}>
              <Text style={styles.description}>{team.description}</Text>
            </Card>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(80).springify()}>
          <TeamRecordRow record={record} />
        </Animated.View>

        {isCaptain && (
          <Animated.View
            entering={FadeInDown.delay(140).springify()}
            style={styles.actions}
          >
            <Button
              label="Marcar jogo"
              size="lg"
              haptic="medium"
              onPress={() =>
                router.push(`/(app)/teams/${team.id}/match/new`)
              }
              full
            />
            <Button
              label="🔔 Publicar desafio aberto"
              variant="secondary"
              onPress={() =>
                router.push(`/(app)/teams/${team.id}/open-request`)
              }
              full
            />
            <Button
              label="Editar equipa"
              variant="ghost"
              onPress={() => router.push(`/(app)/teams/${team.id}/edit`)}
              full
            />
          </Animated.View>
        )}

        {!isCaptain && session && (
          <Animated.View
            entering={FadeInDown.delay(140).springify()}
            style={{ marginTop: 16 }}
          >
            <Button
              label="Sair da equipa"
              variant="secondary"
              full
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
            />
          </Animated.View>
        )}

        <Animated.View
          entering={FadeInDown.delay(200).springify()}
          style={styles.section}
        >
          <Eyebrow>{`Jogos · ${matches.length}`}</Eyebrow>
          {matches.length === 0 ? (
            <Card style={{ marginTop: 8 }}>
              <Text style={styles.muted}>
                {`Sem jogos ainda.${isCaptain ? ' Toca em "Marcar jogo" para começar.' : ''}`}
              </Text>
            </Card>
          ) : (
            <Animated.View
              entering={FadeInDown.delay(240).springify()}
              style={{ marginTop: 8 }}
            >
              <MatchListGroup>
                {matches.map((m) => (
                  <MatchListItem
                    key={m.id}
                    match={m}
                    highlightTeamId={team.id}
                    onPress={() => router.push(`/(app)/matches/${m.id}`)}
                  />
                ))}
              </MatchListGroup>
            </Animated.View>
          )}
        </Animated.View>

        {isCaptain && suggested.length > 0 && (
          <Animated.View
            entering={FadeInDown.delay(260).springify()}
            style={styles.section}
          >
            <Eyebrow>Adversários do teu nível</Eyebrow>
            {suggested.map((s, i) => (
              <Animated.View
                key={s.team_id}
                entering={FadeInDown.delay(300 + i * 30).springify()}
              >
                <Card
                  onPress={() => router.push(`/(app)/teams/${s.team_id}`)}
                  style={{ marginTop: 8 }}
                >
                  <View style={styles.row}>
                    <Avatar
                      url={s.photo_url}
                      name={s.name}
                      size={40}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{s.name}</Text>
                      <Text style={styles.itemMeta}>
                        {`Δ ELO ${Math.round(s.elo_diff)}${s.played_us > 0 ? ` · ${s.played_us} jogos` : ''}`}
                      </Text>
                    </View>
                    <Text style={styles.suggestedElo}>
                      {Math.round(s.elo_avg)}
                    </Text>
                  </View>
                </Card>
              </Animated.View>
            ))}
          </Animated.View>
        )}

        <Animated.View
          entering={FadeInDown.delay(280).springify()}
          style={styles.section}
        >
          <Eyebrow>{`Plantel · ${members.length}`}</Eyebrow>
          {members.map((m, i) => (
            <Animated.View
              key={m.user_id}
              entering={FadeInDown.delay(320 + i * 30).springify()}
            >
              <Card
                onPress={() => router.push(`/(app)/users/${m.user_id}`)}
                style={{ marginTop: 8 }}
              >
                <View style={styles.row}>
                  <Avatar
                    url={m.profile?.photo_url}
                    name={m.profile?.name}
                    size={40}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>
                      {m.profile?.name ?? 'Jogador'}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {m.role === 'captain' ? 'Capitão' : 'Membro'}
                    </Text>
                  </View>
                  <Text style={styles.arrow}>›</Text>
                </View>
              </Card>
            </Animated.View>
          ))}
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(360).springify()}
          style={styles.section}
        >
          <Eyebrow>Convidar jogadores</Eyebrow>
          <Card style={{ marginTop: 8 }}>
            <Text style={styles.inviteLabel}>Código</Text>
            <Text style={styles.inviteCode}>{team.invite_code}</Text>
            <View style={styles.inviteRow}>
              <Button
                label={copied ? '✓ Copiado' : 'Copiar'}
                variant="secondary"
                full
                onPress={copyCode}
              />
              <Button label="Partilhar" full onPress={shareInvite} />
            </View>
            <Text style={styles.inviteHint}>
              Quem tiver o código pode entrar em "Entrar com código".
            </Text>
          </Card>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

function TeamRecordRow({ record }: { record: TeamRecord }) {
  if (record.played === 0) {
    return (
      <Card style={{ marginTop: 16 }}>
        <Text style={styles.muted}>Sem jogos validados ainda.</Text>
      </Card>
    );
  }
  const gd = record.goals_for - record.goals_against;
  return (
    <Card style={{ marginTop: 16 }}>
      <View style={styles.statsRow}>
        <Stat label="V" value={record.wins} color="#34d399" />
        <Stat label="E" value={record.draws} color="#fbbf24" />
        <Stat label="D" value={record.losses} color="#f87171" />
        <Stat label="DG" value={gd > 0 ? `+${gd}` : `${gd}`} color="#ffffff" />
        <Stat label="Jogos" value={record.played} color="#a3a3a3" />
      </View>
    </Card>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 4,
  },
  meta: {
    color: '#a3a3a3',
    fontSize: 13,
    marginTop: 4,
    letterSpacing: -0.1,
  },
  description: {
    color: '#d4d4d4',
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: -0.1,
  },
  chatBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { marginTop: 20, gap: 8 },
  section: { marginTop: 28 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  suggestedElo: {
    color: colors.brand,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  itemName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  itemMeta: {
    color: '#a3a3a3',
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  arrow: { color: '#5a5a5a', fontSize: 22, fontWeight: '300' },
  muted: { color: '#737373', fontSize: 13 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  statLabel: {
    color: '#737373',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 4,
  },
  inviteLabel: {
    color: '#737373',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  inviteCode: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 6,
    marginTop: 8,
    fontFamily: 'Menlo',
  },
  inviteRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  inviteHint: {
    color: '#737373',
    fontSize: 12,
    marginTop: 12,
    lineHeight: 18,
  },
});
