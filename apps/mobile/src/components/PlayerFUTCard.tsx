import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from './Avatar';
import { FormStrip, type FormResult } from './FormStrip';
import { formatDisplayName, FOOT_LABEL, type Profile } from '@/lib/profile';
import {
  categoriesForPosition,
  overallRating,
  ratingColor,
  STAT_SHORT,
  type AggregateStat,
} from '@/lib/player-stats';
import { POSITION_LABEL } from '@/lib/teams';
import { colors } from '@/theme';

type Tier = {
  name: string;
  border: string;
  gradient: [string, string, string];
  brand: string; // accent for name/team label
  glow?: string; // outer shadow color for premium tiers
};

const IN_FORM_TIER: Tier = {
  name: 'IN FORM',
  border: '#FFB36B',
  gradient: ['#3A1810', '#180A07', '#3A1810'],
  brand: '#FFC489',
  glow: '#FF8A3D',
};

function tierFor(overall: number): Tier {
  if (overall >= 85) {
    // Elite — saturated gold + lighter inner glow
    return {
      name: 'ELITE',
      border: '#E7C58A',
      gradient: ['#2a2017', '#1a1410', '#2a2017'],
      brand: '#E7C58A',
    };
  }
  if (overall >= 75) {
    // Gold — brand
    return {
      name: 'OURO',
      border: '#C9A26B',
      gradient: ['#1f1810', '#120e0a', '#1f1810'],
      brand: '#C9A26B',
    };
  }
  if (overall >= 60) {
    // Silver
    return {
      name: 'PRATA',
      border: '#9aa3a0',
      gradient: ['#1c2220', '#101513', '#1c2220'],
      brand: '#c4cbc8',
    };
  }
  if (overall >= 40) {
    // Bronze
    return {
      name: 'BRONZE',
      border: '#a86a3d',
      gradient: ['#241712', '#15100c', '#241712'],
      brand: '#cd854f',
    };
  }
  // Unrated — neutral
  return {
    name: '',
    border: 'rgba(201,162,107,0.30)',
    gradient: ['#1a2b22', '#0e1812', '#1a2b22'],
    brand: 'rgba(201,162,107,0.6)',
  };
}

type Props = {
  profile: Profile;
  stats: AggregateStat[];
  position?: string | null;
  winPct?: number | null;
  matches?: number;
  goals?: number;
  assists?: number;
  teamName?: string | null;
  form?: FormResult[];
  inForm?: boolean;
  onPress?: () => void;
};

export function PlayerFUTCard({
  profile,
  stats,
  position = null,
  winPct = null,
  matches = 0,
  goals = 0,
  assists = 0,
  teamName = null,
  form = [],
  inForm = false,
  onPress,
}: Props) {
  // IN FORM = FIFA TOTW-style boost: +3 across all rated stats, capped at 99.
  // Stats sem votos (value=0) ficam a 0 (mostra "—") — não inventamos rating.
  const IN_FORM_BOOST = 3;
  const displayStats = inForm
    ? stats.map((s) =>
        s.value > 0
          ? { ...s, value: Math.min(99, s.value + IN_FORM_BOOST) }
          : s,
      )
    : stats;
  const overall = overallRating(displayStats);
  const cats = categoriesForPosition(position);
  const isGk = position === 'gr';
  const overallColor = inForm ? '#FFC489' : overall > 0 ? ratingColor(overall) : '#737373';
  const positionShort = isGk
    ? 'GR'
    : position === 'def'
      ? 'DEF'
      : position === 'med'
        ? 'MED'
        : position === 'ata'
          ? 'ATA'
          : 'JOG';
  const tier = inForm ? IN_FORM_TIER : tierFor(overall);

  const inner = (
    <LinearGradient
      colors={tier.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { borderColor: tier.border }]}
    >
        {/* Top row: rating block + flag */}
        <View style={styles.topRow}>
          <View style={styles.ratingBlock}>
            <Text style={[styles.overall, { color: overallColor }]}>
              {overall > 0 ? overall : '—'}
            </Text>
            <Text style={[styles.position, { color: overallColor }]}>
              {positionShort}
            </Text>
            {profile.preferred_foot && (
              <Text style={styles.foot}>
                {FOOT_LABEL[profile.preferred_foot].slice(0, 3).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.heroAvatar}>
            <Avatar
              url={profile.photo_url}
              name={profile.name}
              size={120}
            />
            {profile.jersey_number !== null &&
              profile.jersey_number !== undefined && (
                <View style={styles.jersey}>
                  <Text style={styles.jerseyText}>
                    {profile.jersey_number}
                  </Text>
                </View>
              )}
          </View>
          <View style={styles.flagBlock}>
            <Text style={styles.flag}>🇵🇹</Text>
            <Text style={styles.city} numberOfLines={1}>
              {profile.city}
            </Text>
          </View>
        </View>

        {/* Name */}
        <Text style={styles.name} numberOfLines={1}>
          {formatDisplayName(profile).toLocaleUpperCase('pt-PT')}
        </Text>
        {teamName && (
          <Text style={[styles.team, { color: tier.brand }]} numberOfLines={1}>
            {teamName.toLocaleUpperCase('pt-PT')}
          </Text>
        )}

        {/* Stats grid 2 cols x 3 rows */}
        <View style={styles.statsGrid}>
          {cats.map((cat) => {
            const stat = displayStats.find((s) => s.category === cat);
            const value = stat?.value ?? 0;
            const hasVotes = (stat?.votes ?? 0) > 0;
            const color = hasVotes ? ratingColor(value) : '#737373';
            return (
              <View key={cat} style={styles.statCell}>
                <Text style={[styles.statValue, { color }]}>
                  {hasVotes ? value : '—'}
                </Text>
                <Text style={styles.statShort}>{STAT_SHORT[cat]}</Text>
              </View>
            );
          })}
        </View>

        {/* Footer line */}
        <View style={styles.footer}>
          <FootCell label="Vit." value={winPct !== null ? `${winPct}%` : '—'} />
          <View style={styles.divider} />
          <FootCell label="Jogos" value={String(matches)} />
          <View style={styles.divider} />
          <FootCell label="Golos" value={String(goals)} tone="#fbbf24" />
          <View style={styles.divider} />
          <FootCell label="Assists" value={String(assists)} tone="#34d399" />
        </View>

        {form.length > 0 && (
          <View style={styles.formRow}>
            <Text style={styles.formLabel}>FORMA</Text>
            <FormStrip results={form} size="sm" />
          </View>
        )}

        <View style={styles.brandRow}>
          {tier.name ? (
            <Text style={[styles.tierTag, { color: tier.brand }]}>
              {tier.name}
            </Text>
          ) : null}
          <Text style={styles.brand}>S 7 V N</Text>
          <View style={{ width: tier.name ? 50 : 0 }} />
        </View>
      </LinearGradient>
  );

  const outerStyle = inForm
    ? [
        styles.outer,
        {
          shadowColor: tier.glow ?? '#FF8A3D',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 24,
          elevation: 14,
        },
      ]
    : styles.outer;

  return (
    <View style={outerStyle}>
      {onPress ? (
        <Pressable onPress={onPress} android_ripple={{ color: 'rgba(255,255,255,0.04)' }}>
          {inner}
        </Pressable>
      ) : (
        inner
      )}
    </View>
  );
}

function FootCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <View style={styles.footCell}>
      <Text style={[styles.footValue, tone ? { color: tone } : null]}>
        {value}
      </Text>
      <Text style={styles.footLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  card: {
    padding: 22,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(201,162,107,0.45)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ratingBlock: {
    width: 60,
    alignItems: 'flex-start',
    gap: 2,
  },
  overall: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 46,
  },
  position: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
  },
  foot: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 6,
  },
  heroAvatar: { position: 'relative' },
  jersey: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    minWidth: 32,
    height: 32,
    paddingHorizontal: 5,
    borderRadius: 16,
    backgroundColor: '#C9A26B',
    borderWidth: 3,
    borderColor: '#0e1812',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jerseyText: { color: '#0E1812', fontSize: 14, fontWeight: '900' },
  flagBlock: { width: 72, alignItems: 'center' },
  flag: { fontSize: 22 },
  city: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 4,
    textAlign: 'center',
  },
  name: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.8,
    textAlign: 'center',
    marginTop: 18,
  },
  team: {
    color: 'rgba(201,162,107,0.85)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 22,
    paddingTop: 18,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  statCell: {
    width: '33.333%',
    alignItems: 'center',
    paddingVertical: 6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  statShort: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  footCell: { alignItems: 'center', flex: 1 },
  footValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  footLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  brand: {
    color: 'rgba(201,162,107,0.55)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 6,
    textAlign: 'center',
    flex: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  tierTag: {
    width: 50,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.6,
    opacity: 0.85,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  formLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
});
