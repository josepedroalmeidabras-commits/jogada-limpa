import { useEffect, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { fetchTeamById, type TeamWithSport } from '@/lib/teams';
import {
  fetchOpponentCandidates,
  proposeMatch,
  type TeamLite,
} from '@/lib/matches';

function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function parseDateTime(date: string, time: string): string | null {
  const dm = date.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const tm = time.trim().match(/^(\d{2}):(\d{2})$/);
  if (!dm || !tm) return null;
  const [, dd, mm, yyyy] = dm;
  const [, hh, mi] = tm;
  const iso = `${yyyy}-${mm}-${dd}T${hh}:${mi}:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getTime() <= Date.now()) return null;
  return d.toISOString();
}

export default function NewMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [team, setTeam] = useState<TeamWithSport | null>(null);
  const [opponents, setOpponents] = useState<TeamLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationTbd, setLocationTbd] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const t = await fetchTeamById(id);
      if (cancelled || !t) {
        setLoading(false);
        return;
      }
      setTeam(t);
      const list = await fetchOpponentCandidates(t.sport_id, t.id);
      if (cancelled) return;
      setOpponents(list);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSubmit() {
    setError(null);
    if (!session || !team) {
      setError('Sessão inválida.');
      return;
    }
    if (team.captain_id !== session.user.id) {
      setError('Só o capitão pode marcar jogos.');
      return;
    }
    if (!opponentId) {
      setError('Escolhe um adversário.');
      return;
    }
    const scheduledIso = parseDateTime(date, time);
    if (!scheduledIso) {
      setError('Data ou hora inválida. Tem de ser no futuro.');
      return;
    }
    if (!locationTbd && !locationName.trim()) {
      setError('Indica o local ou marca "A combinar".');
      return;
    }

    setSubmitting(true);
    const result = await proposeMatch({
      proposing_team_id: team.id,
      opponent_team_id: opponentId,
      scheduled_at: scheduledIso,
      location_name: locationTbd ? undefined : locationName.trim(),
      location_tbd: locationTbd,
      message: message.trim() || undefined,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.replace(`/(app)/matches/${result.match_id}`);
  }

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
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Marcar jogo',
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#ffffff',
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.heading}>{team.name}</Text>
          <Text style={styles.sub}>
            {team.sport?.name} · vai propor um jogo
          </Text>

          <Text style={styles.label}>Adversário</Text>
          {opponents.length === 0 ? (
            <Text style={styles.emptyOpp}>
              Ainda não há outras equipas de {team.sport?.name} para desafiar.
              Convida amigos a criarem equipa.
            </Text>
          ) : (
            <View style={styles.opponents}>
              {opponents.map((o) => {
                const picked = o.id === opponentId;
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => setOpponentId(o.id)}
                    disabled={submitting}
                    style={[styles.oppCard, picked && styles.oppCardPicked]}
                  >
                    <Text
                      style={[
                        styles.oppName,
                        picked && styles.oppNamePicked,
                      ]}
                    >
                      {o.name}
                    </Text>
                    <Text
                      style={[
                        styles.oppCity,
                        picked && styles.oppCityPicked,
                      ]}
                    >
                      {o.city}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Text style={styles.label}>Data (DD/MM/AAAA)</Text>
          <TextInput
            style={styles.input}
            placeholder="20/05/2026"
            placeholderTextColor="#666"
            value={date}
            onChangeText={(t) => setDate(formatDateInput(t))}
            keyboardType="number-pad"
            maxLength={10}
            editable={!submitting}
          />

          <Text style={styles.label}>Hora (HH:MM)</Text>
          <TextInput
            style={styles.input}
            placeholder="19:30"
            placeholderTextColor="#666"
            value={time}
            onChangeText={(t) => setTime(formatTimeInput(t))}
            keyboardType="number-pad"
            maxLength={5}
            editable={!submitting}
          />

          <Pressable
            style={styles.tbdRow}
            onPress={() => setLocationTbd((v) => !v)}
            disabled={submitting}
          >
            <View
              style={[styles.checkbox, locationTbd && styles.checkboxChecked]}
            >
              {locationTbd && <Text style={styles.checkboxMark}>✓</Text>}
            </View>
            <Text style={styles.tbdText}>Local a combinar</Text>
          </Pressable>

          {!locationTbd && (
            <>
              <Text style={styles.label}>Local</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Campo Municipal de Celas"
                placeholderTextColor="#666"
                value={locationName}
                onChangeText={setLocationName}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!submitting}
              />
            </>
          )}

          <Text style={styles.label}>Mensagem (opcional)</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Algo a dizer ao outro capitão?"
            placeholderTextColor="#666"
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={500}
            editable={!submitting}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting || opponents.length === 0}
            style={[
              styles.submit,
              (submitting || opponents.length === 0) && styles.submitDisabled,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.submitText}>Enviar desafio</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 24, paddingBottom: 48 },
  heading: { color: '#ffffff', fontSize: 24, fontWeight: '800' },
  sub: { color: '#a3a3a3', fontSize: 14, marginTop: 4, marginBottom: 16 },
  label: {
    color: '#a3a3a3',
    fontSize: 13,
    marginTop: 16,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 16,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  opponents: { gap: 8, marginTop: 4 },
  oppCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  oppCardPicked: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  oppName: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  oppNamePicked: { color: '#000000' },
  oppCity: { color: '#a3a3a3', fontSize: 13, marginTop: 2 },
  oppCityPicked: { color: '#404040' },
  emptyOpp: {
    color: '#a3a3a3',
    fontSize: 14,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    lineHeight: 20,
  },
  tbdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  checkboxMark: { color: '#000000', fontWeight: '800', fontSize: 14 },
  tbdText: { color: '#d4d4d4', fontSize: 14 },
  submit: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 32,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#000000', fontSize: 16, fontWeight: '600' },
  error: {
    color: '#f87171',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 13,
  },
});
