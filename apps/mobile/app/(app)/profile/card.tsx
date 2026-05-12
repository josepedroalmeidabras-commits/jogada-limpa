import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Stack, useFocusEffect } from 'expo-router';
import { useAuth } from '@/providers/auth';
import {
  fetchProfile,
  formatDisplayName,
  FOOT_LABEL,
  type Profile,
} from '@/lib/profile';
import { fetchUserSports, type UserSportElo } from '@/lib/reviews';
import {
  categoriesForPosition,
  fetchPlayerStats,
  overallRating,
  ratingColor,
  STAT_ICONS,
  STAT_LABELS,
  type AggregateStat,
  type StatCategory,
} from '@/lib/player-stats';
import { fetchSeasonStats, type SeasonStats } from '@/lib/season-stats';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { POSITION_LABEL } from '@/lib/teams';
import { colors } from '@/theme';

export default function PlayerCardScreen() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sport, setSport] = useState<UserSportElo | null>(null);
  const [stats, setStats] = useState<AggregateStat[]>([]);
  const [season, setSeason] = useState<SeasonStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const [p, sports, ss] = await Promise.all([
      fetchProfile(session.user.id),
      fetchUserSports(session.user.id),
      fetchSeasonStats(session.user.id),
    ]);
    const sp = sports.find((x) => x.sport_id === 2) ?? null;
    const position = sp?.preferred_position ?? null;
    const ps = await fetchPlayerStats(session.user.id, position);
    setProfile(p);
    setSport(sp);
    setStats(ps);
    setSeason(ss);
    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading || !profile) {
    return (
      <Screen>
        <Stack.Screen
          options={{
            headerShown: true,
            headerTitle: 'Player Card',
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
          }}
        />
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
        </View>
      </Screen>
    );
  }

  const overall = overallRating(stats);
  const position = sport?.preferred_position ?? null;
  const isGk = position === 'gr';
  const elo = sport ? Math.round(sport.elo) : null;
  const cats = categoriesForPosition(position);
  const overallColor = overall > 0 ? ratingColor(overall) : colors.textDim;

  async function handleShare() {
    if (!profile) return;
    const lines = [
      `🟢 ${formatDisplayName(profile)}`,
      position ? `${isGk ? '🧤 ' : ''}${POSITION_LABEL[position] ?? ''}` : '',
      overall > 0 ? `Overall ${overall}/99` : '',
      elo !== null ? `ELO ${elo}` : '',
      season ? `${season.matches_played} jogos · ${season.goals}G · ${season.assists}A` : '',
      '',
      'S7VN — jogadalimpa.app',
    ].filter(Boolean);
    try {
      await Share.share({ message: lines.join('\n') });
    } catch {}
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Player Card',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <View style={styles.outer}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.card}>
          {/* Top row: overall + position */}
          <View style={styles.topRow}>
            <View style={styles.overallBlock}>
              <Text
                style={[
                  styles.overall,
                  { color: overallColor },
                ]}
              >
                {overall > 0 ? overall : '—'}
              </Text>
              <Text style={[styles.overallSub, { color: overallColor }]}>
                {position ? (isGk ? '🧤 GR' : POSITION_LABEL[position]?.slice(0, 3).toUpperCase() ?? '') : '—'}
              </Text>
            </View>
            <View style={styles.flagBlock}>
              <Text style={styles.flag}>🇵🇹</Text>
              <Text style={styles.city}>{profile.city}</Text>
            </View>
          </View>

          {/* Avatar + name */}
          <View style={styles.heroBlock}>
            <View style={styles.avatarWrap}>
              <Avatar
                url={profile.photo_url}
                name={profile.name}
                size={120}
              />
              {profile.jersey_number !== null && (
                <View style={styles.jersey}>
                  <Text style={styles.jerseyText}>{profile.jersey_number}</Text>
                </View>
              )}
            </View>
            <Text style={styles.name} numberOfLines={2}>
              {formatDisplayName(profile)}
            </Text>
            {profile.preferred_foot && (
              <Text style={styles.foot}>
                {`⚽ ${FOOT_LABEL[profile.preferred_foot]}`}
              </Text>
            )}
          </View>

          {/* Stats */}
          <View style={styles.statsBlock}>
            {cats.map((cat) => {
              const stat = stats.find((s) => s.category === cat);
              const value = stat?.value ?? 0;
              const votes = stat?.votes ?? 0;
              const c = votes > 0 ? ratingColor(value) : colors.textDim;
              return (
                <StatRow
                  key={cat}
                  category={cat}
                  value={value}
                  hasVotes={votes > 0}
                  color={c}
                />
              );
            })}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            {elo !== null && (
              <View style={styles.footCell}>
                <Text style={styles.footValue}>{elo}</Text>
                <Text style={styles.footLabel}>ELO</Text>
              </View>
            )}
            <View style={styles.footCell}>
              <Text style={styles.footValue}>{season?.matches_played ?? 0}</Text>
              <Text style={styles.footLabel}>Jogos</Text>
            </View>
            <View style={styles.footCell}>
              <Text style={[styles.footValue, { color: '#fbbf24' }]}>
                {season?.goals ?? 0}
              </Text>
              <Text style={styles.footLabel}>Golos</Text>
            </View>
            <View style={styles.footCell}>
              <Text style={[styles.footValue, { color: '#34d399' }]}>
                {season?.assists ?? 0}
              </Text>
              <Text style={styles.footLabel}>Assist.</Text>
            </View>
          </View>

          <Text style={styles.brand}>jogadalimpa.app</Text>
        </Animated.View>

        <View style={styles.actions}>
          <Button
            label="↗ Partilhar player card"
            size="lg"
            haptic="medium"
            onPress={handleShare}
            full
          />
          <Text style={styles.hint}>
            Faz screenshot do cartão para o teres como imagem.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

function StatRow({
  category,
  value,
  hasVotes,
  color,
}: {
  category: StatCategory;
  value: number;
  hasVotes: boolean;
  color: string;
}) {
  const pct = Math.max(0, Math.min(99, value)) / 99;
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>
        {`${STAT_ICONS[category]}  ${STAT_LABELS[category]}`}
      </Text>
      <View style={styles.statBarWrap}>
        <View style={styles.statTrack}>
          <View
            style={[
              styles.statFill,
              {
                width: `${pct * 100}%`,
                backgroundColor: hasVotes ? color : '#3f3f3f',
              },
            ]}
          />
        </View>
      </View>
      <Text
        style={[
          styles.statValue,
          { color: hasVotes ? color : colors.textDim },
        ]}
      >
        {hasVotes ? value : '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, padding: 20, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    padding: 22,
    borderRadius: 24,
    backgroundColor: '#0f1a14',
    borderWidth: 1,
    borderColor: 'rgba(201,162,107,0.35)',
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overallBlock: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  overall: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1.4,
  },
  overallSub: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: -2,
  },
  flagBlock: { alignItems: 'flex-end' },
  flag: { fontSize: 22 },
  city: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  heroBlock: { alignItems: 'center', marginTop: 14 },
  avatarWrap: { position: 'relative' },
  jersey: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    minWidth: 36,
    height: 36,
    paddingHorizontal: 6,
    borderRadius: 18,
    backgroundColor: '#C9A26B',
    borderWidth: 3,
    borderColor: '#0f1a14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jerseyText: {
    color: '#0E1812',
    fontSize: 16,
    fontWeight: '900',
  },
  name: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 12,
    textAlign: 'center',
  },
  foot: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  statsBlock: { marginTop: 18, gap: 8 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statLabel: {
    flex: 1.2,
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  statBarWrap: { flex: 1.5 },
  statTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  statFill: { height: '100%', borderRadius: 3 },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    minWidth: 24,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  footCell: { flex: 1, alignItems: 'center' },
  footValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  footLabel: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  brand: {
    color: 'rgba(201,162,107,0.5)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 16,
  },
  actions: { gap: 8, paddingHorizontal: 4 },
  hint: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: 'center',
  },
});
