import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/providers/auth';
import { fetchProfile, type Profile } from '@/lib/profile';
import { fetchMvpOfWeek } from '@/lib/mvp';
import { fetchCityPulse, type CityPulse } from '@/lib/city';
import {
  fetchCityActivity,
  type CityActivity,
} from '@/lib/matches';
import {
  fetchFriendsRecentMatches,
  type FriendMatchEvent,
} from '@/lib/friends';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Skeleton } from '@/components/Skeleton';
import { Avatar } from '@/components/Avatar';
import { MatchResultRow } from '@/components/MatchResultRow';
import { colors } from '@/theme';

type Tab = 'friends' | 'city';

export default function ActivityScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<Tab>('friends');
  const [friendsActivity, setFriendsActivity] = useState<FriendMatchEvent[]>([]);
  const [cityActivity, setCityActivity] = useState<CityActivity[]>([]);
  const [cityPulse, setCityPulse] = useState<CityPulse | null>(null);
  const [mvpWeek, setMvpWeek] = useState<{
    user_id: string;
    name: string;
    photo_url: string | null;
    votes: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const p = await fetchProfile(session.user.id);
    if (!p) return;
    setProfile(p);
    const [fa, ca] = await Promise.all([
      fetchFriendsRecentMatches(20),
      fetchCityActivity(p.city, 20),
    ]);
    setFriendsActivity(fa);
    setCityActivity(ca);
    if (p.city) {
      const [mw, cp] = await Promise.all([
        fetchMvpOfWeek(p.city),
        fetchCityPulse(p.city),
      ]);
      setMvpWeek(mw);
      setCityPulse(cp);
    }
    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Atividade',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ffffff"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ gap: 12 }}>
            <Skeleton width={180} height={32} />
            <Skeleton height={80} radius={16} style={{ marginTop: 12 }} />
            <Skeleton height={80} radius={16} />
            <Skeleton height={80} radius={16} />
          </View>
        ) : (
          <>
            {mvpWeek ? (
              <Animated.View
                entering={FadeInDown.delay(80).springify()}
              >
                <Pressable
                  onPress={() => router.push(`/(app)/users/${mvpWeek.user_id}`)}
                >
                  <LinearGradient
                    colors={[
                      'rgba(224,185,124,0.20)',
                      'rgba(201,162,107,0.04)',
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.mvpCard}
                  >
                    <View style={styles.mvpIcon}>
                      <Ionicons name="trophy" size={20} color={colors.goldDeep} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mvpEyebrow}>MVP DA SEMANA</Text>
                      <Text style={styles.mvpName} numberOfLines={1}>
                        {mvpWeek.name}
                      </Text>
                      <Text style={styles.mvpMeta}>
                        {`${mvpWeek.votes} voto${mvpWeek.votes === 1 ? '' : 's'} ${mvpWeek.votes === 1 ? 'esta' : 'esta'} semana`}
                      </Text>
                    </View>
                    <Avatar
                      url={mvpWeek.photo_url}
                      name={mvpWeek.name}
                      size={56}
                    />
                  </LinearGradient>
                </Pressable>
              </Animated.View>
            ) : null}

            {cityPulse &&
            cityPulse.matches_7d + cityPulse.active_teams > 0 ? (
              <Animated.View
                entering={FadeInDown.delay(120).springify()}
                style={{ marginTop: 12 }}
              >
                <View style={styles.pulseRow}>
                  <View style={styles.pulseCell}>
                    <Text style={styles.pulseValue}>{cityPulse.matches_7d}</Text>
                    <Text style={styles.pulseLabel}>JOGOS 7D</Text>
                  </View>
                  <View style={styles.pulseDivider} />
                  <View style={styles.pulseCell}>
                    <Text style={styles.pulseValue}>{cityPulse.active_teams}</Text>
                    <Text style={styles.pulseLabel}>EQUIPAS</Text>
                  </View>
                  <View style={styles.pulseDivider} />
                  <View style={styles.pulseCell}>
                    <Text style={styles.pulseValue}>{cityPulse.active_players}</Text>
                    <Text style={styles.pulseLabel}>JOGADORES</Text>
                  </View>
                </View>
              </Animated.View>
            ) : null}

            <Animated.View
              entering={FadeInDown.delay(160).springify()}
              style={styles.tabRow}
            >
              <Pressable
                onPress={() => setTab('friends')}
                style={[styles.tab, tab === 'friends' && styles.tabActive]}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === 'friends' && styles.tabTextActive,
                  ]}
                >
                  Amigos
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setTab('city')}
                style={[styles.tab, tab === 'city' && styles.tabActive]}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === 'city' && styles.tabTextActive,
                  ]}
                >
                  Cidade
                </Text>
              </Pressable>
            </Animated.View>

            {tab === 'friends' ? (
              <View style={{ marginTop: 14, gap: 8 }}>
                {friendsActivity.length > 0 ? (
                  friendsActivity.map((m, i) => (
                    <Animated.View
                      key={m.match_id}
                      entering={FadeInDown.delay(180 + i * 30).springify()}
                    >
                      <View style={styles.feedCardOuter}>
                        <Pressable
                          onPress={() => router.push(`/(app)/users/${m.friend_id}`)}
                          style={styles.friendChip}
                        >
                          <Avatar
                            url={m.friend_photo}
                            name={m.friend_name}
                            size={22}
                          />
                          <Text style={styles.friendChipName} numberOfLines={1}>
                            {m.friend_name}
                          </Text>
                        </Pressable>
                        <MatchResultRow
                          scheduledAt={m.scheduled_at}
                          isInternal={m.is_internal}
                          status="validated"
                          sideAName={m.side_a_name}
                          sideBName={m.side_b_name}
                          sideAPhoto={m.side_a_photo}
                          sideBPhoto={m.side_b_photo}
                          scoreA={m.final_score_a}
                          scoreB={m.final_score_b}
                          mySide={m.friend_side}
                          myGoals={m.friend_goals}
                          myAssists={m.friend_assists}
                          onPress={() => router.push(`/(app)/matches/${m.match_id}`)}
                        />
                      </View>
                    </Animated.View>
                  ))
                ) : (
                  <Card
                    variant="subtle"
                    onPress={() => router.push('/(app)/profile/find-friends')}
                  >
                    <View style={styles.emptyRow}>
                      <View style={styles.emptyIcon}>
                        <Ionicons
                          name="people-outline"
                          size={22}
                          color={colors.goldDeep}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.emptyTitle}>
                          Ainda não tens amigos no S7VN
                        </Text>
                        <Text style={styles.emptyBody}>
                          Encontra-os e vê aqui o que jogam.
                        </Text>
                      </View>
                      <Ionicons name="arrow-forward" size={16} color={colors.brand} />
                    </View>
                  </Card>
                )}
              </View>
            ) : (
              <View style={{ marginTop: 14, gap: 8 }}>
                {cityActivity.length > 0 ? (
                  cityActivity.map((m, i) => (
                    <Animated.View
                      key={m.match_id}
                      entering={FadeInDown.delay(180 + i * 30).springify()}
                    >
                      <View style={styles.feedCardOuter}>
                        <MatchResultRow
                          scheduledAt={m.scheduled_at}
                          isInternal={m.is_internal}
                          status="validated"
                          sideAName={m.side_a_name}
                          sideBName={m.side_b_name}
                          sideAPhoto={m.side_a_photo}
                          sideBPhoto={m.side_b_photo}
                          scoreA={m.final_score_a}
                          scoreB={m.final_score_b}
                          onPress={() => router.push(`/(app)/matches/${m.match_id}`)}
                        />
                      </View>
                    </Animated.View>
                  ))
                ) : (
                  <Card variant="subtle">
                    <View style={styles.emptyRow}>
                      <View style={styles.emptyIcon}>
                        <Ionicons name="flame-outline" size={22} color={colors.goldDeep} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.emptyTitle}>
                          {`Ainda sem jogos em ${profile?.city ?? 'Coimbra'}`}
                        </Text>
                        <Text style={styles.emptyBody}>
                          Marca o primeiro jogo e arranca a cena local.
                        </Text>
                      </View>
                    </View>
                  </Card>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 100 },
  mvpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  mvpIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
    backgroundColor: colors.brandSoft,
  },
  mvpEyebrow: {
    color: colors.brand,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  mvpName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  mvpMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  pulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgElevated,
  },
  pulseCell: { flex: 1, alignItems: 'center', gap: 2 },
  pulseValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  pulseLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  pulseDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.borderSubtle,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 22,
    padding: 4,
    borderRadius: 14,
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  tabTextActive: {
    color: colors.brand,
  },
  feedCardOuter: {
    borderRadius: 16,
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 10,
    gap: 8,
  },
  friendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  friendChipName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 180,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
    backgroundColor: colors.brandSoft,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
});
