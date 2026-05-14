import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from './Avatar';
import { FormStrip, type FormResult } from './FormStrip';
import {
  OUTFIELD_CATEGORIES,
  ratingColor,
  STAT_SHORT,
  type StatCategory,
} from '@/lib/player-stats';
import { colors } from '@/theme';

type Tier = {
  name: string;
  border: string;
  gradient: [string, string, string];
  brand: string;
};

function tierFor(overall: number): Tier {
  if (overall >= 85) {
    return {
      name: 'ELITE',
      border: '#E7C58A',
      gradient: ['#2a2017', '#1a1410', '#2a2017'],
      brand: '#E7C58A',
    };
  }
  if (overall >= 75) {
    return {
      name: 'OURO',
      border: '#C9A26B',
      gradient: ['#1f1810', '#120e0a', '#1f1810'],
      brand: '#C9A26B',
    };
  }
  if (overall >= 60) {
    return {
      name: 'PRATA',
      border: '#9aa3a0',
      gradient: ['#1c2220', '#101513', '#1c2220'],
      brand: '#c4cbc8',
    };
  }
  if (overall >= 40) {
    return {
      name: 'BRONZE',
      border: '#a86a3d',
      gradient: ['#241712', '#15100c', '#241712'],
      brand: '#cd854f',
    };
  }
  return {
    name: '',
    border: 'rgba(201,162,107,0.30)',
    gradient: ['#1a2b22', '#0e1812', '#1a2b22'],
    brand: 'rgba(201,162,107,0.6)',
  };
}

export type TeamStat = {
  category: StatCategory;
  value: number;
  hasVotes: boolean;
};

type Props = {
  name: string;
  city: string;
  sportName: string | null;
  photoUrl: string | null;
  memberCount: number;
  stats: TeamStat[];
  winPct?: number | null;
  matches?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  form?: FormResult[];
};

export function TeamFUTCard({
  name,
  city,
  sportName,
  photoUrl,
  memberCount,
  stats,
  winPct = null,
  matches = 0,
  goalsFor = 0,
  goalsAgainst = 0,
  form = [],
}: Props) {
  const rated = stats.filter((s) => s.hasVotes);
  const overall =
    rated.length === 0
      ? 0
      : Math.round(rated.reduce((acc, s) => acc + s.value, 0) / rated.length);
  const overallColor = overall > 0 ? ratingColor(overall) : colors.textDim;
  const tier = tierFor(overall);

  return (
    <View style={styles.outer}>
      <LinearGradient
        colors={tier.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, { borderColor: tier.border }]}
      >
        <View style={styles.topRow}>
          <View style={styles.ratingBlock}>
            <Text style={[styles.overall, { color: overallColor }]}>
              {overall > 0 ? overall : '—'}
            </Text>
            <Text style={[styles.position, { color: overallColor }]}>
              EQUIPA
            </Text>
            <Text style={styles.foot}>
              {memberCount} {memberCount === 1 ? 'membro' : 'membros'}
            </Text>
          </View>
          <View style={styles.heroAvatar}>
            <Avatar url={photoUrl} name={name} size={120} />
          </View>
          <View style={styles.flagBlock}>
            <Text style={styles.flag}>🇵🇹</Text>
            <Text style={styles.city} numberOfLines={1}>
              {city.slice(0, 3).toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {sportName && (
          <Text style={[styles.subtitle, { color: tier.brand }]}>
            {sportName.toUpperCase()}
          </Text>
        )}

        <View style={styles.statsGrid}>
          {OUTFIELD_CATEGORIES.map((cat) => {
            const stat = stats.find((s) => s.category === cat);
            const value = stat?.value ?? 0;
            const hasVotes = stat?.hasVotes ?? false;
            const color = hasVotes ? ratingColor(value) : colors.textDim;
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

        <View style={styles.footer}>
          <FootCell label="Vit." value={winPct !== null ? `${winPct}%` : '—'} />
          <View style={styles.divider} />
          <FootCell label="Jogos" value={String(matches)} />
          <View style={styles.divider} />
          <FootCell label="GF" value={String(goalsFor)} tone="#fbbf24" />
          <View style={styles.divider} />
          <FootCell label="GS" value={String(goalsAgainst)} tone="#f87171" />
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
  outer: { borderRadius: 24, overflow: 'hidden' },
  card: {
    padding: 22,
    borderRadius: 24,
    borderWidth: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ratingBlock: { width: 60, alignItems: 'flex-start', gap: 2 },
  overall: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 46,
  },
  position: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  foot: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 6,
  },
  heroAvatar: { position: 'relative' },
  flagBlock: { width: 60, alignItems: 'flex-end' },
  flag: { fontSize: 22 },
  city: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  name: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.8,
    textAlign: 'center',
    marginTop: 18,
    textTransform: 'uppercase',
  },
  subtitle: {
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
  statCell: { width: '33.333%', alignItems: 'center', paddingVertical: 6 },
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
  divider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.08)' },
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
});
