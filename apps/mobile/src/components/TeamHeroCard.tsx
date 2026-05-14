import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from './Avatar';
import { FormStrip, type FormResult } from './FormStrip';
import { colors, gradients } from '@/theme';

export type TeamHeroContributor = {
  user_id: string;
  name: string;
  photo_url: string | null;
  value: number;
};

type Props = {
  name: string;
  city: string;
  photoUrl: string | null;
  memberCount: number;
  winPct: number | null;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  topScorer?: TeamHeroContributor | null;
  topAssist?: TeamHeroContributor | null;
  form?: FormResult[];
  onScorerPress?: () => void;
  onAssistPress?: () => void;
};

export function TeamHeroCard({
  name,
  city,
  photoUrl,
  memberCount,
  winPct,
  wins,
  draws,
  losses,
  goalsFor,
  goalsAgainst,
  topScorer,
  topAssist,
  form = [],
  onScorerPress,
  onAssistPress,
}: Props) {
  return (
    <View style={styles.outer}>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.card}
      >
        <View style={styles.header}>
          <View style={styles.crestWrap}>
            <Avatar url={photoUrl} name={name} size={80} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={2}>
              {name}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {`${city} · ${memberCount} ${memberCount === 1 ? 'membro' : 'membros'}`.toLocaleUpperCase('pt-PT')}
            </Text>
          </View>
        </View>

        <View style={styles.winBlock}>
          <Text style={styles.winValue}>
            {winPct !== null ? `${winPct}%` : '—'}
          </Text>
          <Text style={styles.winLabel}>VITÓRIAS</Text>
        </View>

        <View style={styles.recordRow}>
          <RecordCell value={wins} label="V" color={colors.success} />
          <View style={styles.recordDivider} />
          <RecordCell value={draws} label="E" color={colors.warning} />
          <View style={styles.recordDivider} />
          <RecordCell value={losses} label="D" color={colors.danger} />
        </View>

        <View style={styles.goalsRow}>
          <View style={styles.goalsCell}>
            <Ionicons name="arrow-up" size={12} color={colors.warning} />
            <Text style={styles.goalsValue}>{goalsFor}</Text>
            <Text style={styles.goalsLabel}>Marcados</Text>
          </View>
          <View style={styles.goalsCell}>
            <Ionicons name="arrow-down" size={12} color={colors.danger} />
            <Text style={styles.goalsValue}>{goalsAgainst}</Text>
            <Text style={styles.goalsLabel}>Sofridos</Text>
          </View>
        </View>

        {form.length > 0 && (
          <View style={styles.formRow}>
            <Text style={styles.formLabel}>FORMA</Text>
            <FormStrip results={form} size="sm" />
          </View>
        )}

        {(topScorer || topAssist) && (
          <View style={styles.contribRow}>
            {topScorer && (
              <Pressable
                onPress={onScorerPress}
                style={[styles.contribPill, { flex: 1 }]}
              >
                <Avatar
                  url={topScorer.photo_url}
                  name={topScorer.name}
                  size={28}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.contribRole}>GOLEADOR</Text>
                  <Text style={styles.contribName} numberOfLines={1}>
                    {topScorer.name.split(' ')[0]}
                  </Text>
                </View>
                <Text style={[styles.contribValue, { color: colors.warning }]}>
                  {topScorer.value}
                </Text>
              </Pressable>
            )}
            {topAssist && (
              <Pressable
                onPress={onAssistPress}
                style={[styles.contribPill, { flex: 1 }]}
              >
                <Avatar
                  url={topAssist.photo_url}
                  name={topAssist.name}
                  size={28}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.contribRole}>ASSISTÊNCIA</Text>
                  <Text style={styles.contribName} numberOfLines={1}>
                    {topAssist.name.split(' ')[0]}
                  </Text>
                </View>
                <Text style={[styles.contribValue, { color: colors.success }]}>
                  {topAssist.value}
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

function RecordCell({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <View style={styles.recordCell}>
      <Text style={[styles.recordValue, { color }]}>{value}</Text>
      <Text style={styles.recordLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: 22,
    shadowColor: '#C9A26B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  card: {
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  crestWrap: {
    shadowColor: '#C9A26B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.6,
    lineHeight: 26,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 4,
  },
  winBlock: {
    marginTop: 20,
    alignItems: 'center',
  },
  winValue: {
    color: colors.goldDeep,
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -2.5,
    lineHeight: 58,
  },
  winLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 2,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  recordCell: { flex: 1, alignItems: 'center' },
  recordValue: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  recordLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginTop: 2,
  },
  recordDivider: {
    width: 1,
    height: 26,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  goalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 14,
  },
  goalsCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  goalsValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  goalsLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 2,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  formLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  contribRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  contribPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  contribRole: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  contribName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginTop: 2,
  },
  contribValue: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
});
