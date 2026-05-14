import { supabase } from './supabase';
import { sendPushToUser } from './push';

export type FriendshipStatus =
  | 'none'
  | 'pending_sent'      // I sent a request, waiting on them
  | 'pending_received'  // They sent me a request, waiting on me
  | 'friends';

export type FriendProfile = {
  id: string;
  name: string;
  photo_url: string | null;
  city: string;
};

export type PendingRequest = FriendProfile & {
  created_at: string;
};

export async function fetchFriendshipStatus(
  otherId: string,
): Promise<FriendshipStatus> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return 'none';

  const { data, error } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id, status')
    .or(
      `and(requester_id.eq.${me},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${me})`,
    )
    .maybeSingle();

  if (error || !data) return 'none';
  if (data.status === 'accepted') return 'friends';
  if (data.requester_id === me) return 'pending_sent';
  return 'pending_received';
}

export async function fetchFriends(): Promise<FriendProfile[]> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return [];

  const { data, error } = await supabase
    .from('friendships')
    .select(
      `requester_id, addressee_id,
       requester:profiles!friendships_requester_id_fkey(id, name, photo_url, city, deleted_at),
       addressee:profiles!friendships_addressee_id_fkey(id, name, photo_url, city, deleted_at)`,
    )
    .eq('status', 'accepted');

  if (error || !data) return [];

  return (data as any[])
    .map((row) => (row.requester_id === me ? row.addressee : row.requester))
    .filter((p) => p && !p.deleted_at)
    .map((p) => ({
      id: p.id,
      name: p.name,
      photo_url: p.photo_url,
      city: p.city,
    })) as FriendProfile[];
}

export async function fetchIncomingRequests(): Promise<PendingRequest[]> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return [];

  const { data, error } = await supabase
    .from('friendships')
    .select(
      `created_at,
       requester:profiles!friendships_requester_id_fkey(id, name, photo_url, city, deleted_at)`,
    )
    .eq('addressee_id', me)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return (data as any[])
    .filter((r) => r.requester && !r.requester.deleted_at)
    .map((r) => ({
      id: r.requester.id,
      name: r.requester.name,
      photo_url: r.requester.photo_url,
      city: r.requester.city,
      created_at: r.created_at,
    }));
}

export async function fetchOutgoingRequests(): Promise<PendingRequest[]> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return [];

  const { data, error } = await supabase
    .from('friendships')
    .select(
      `created_at,
       addressee:profiles!friendships_addressee_id_fkey(id, name, photo_url, city, deleted_at)`,
    )
    .eq('requester_id', me)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return (data as any[])
    .filter((r) => r.addressee && !r.addressee.deleted_at)
    .map((r) => ({
      id: r.addressee.id,
      name: r.addressee.name,
      photo_url: r.addressee.photo_url,
      city: r.addressee.city,
      created_at: r.created_at,
    }));
}

export async function sendFriendRequest(
  targetId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('send_friend_request', {
    p_target_id: targetId,
  });
  if (error) {
    return {
      ok: false,
      message: error.message ?? 'Não foi possível enviar.',
    };
  }

  // Push notification (in-app row is inserted by the RPC)
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (me) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', me)
      .maybeSingle();
    const meName = (prof?.name ?? 'Alguém').split(' ')[0];
    void sendPushToUser(targetId, {
      title: 'Novo pedido de amizade',
      body: `${meName} quer ser teu amigo`,
      data: { type: 'friend_request', from_id: me },
    });
  }
  return { ok: true };
}

export async function acceptFriendRequest(
  requesterId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('accept_friend_request', {
    p_requester_id: requesterId,
  });
  if (error) return { ok: false, message: error.message };

  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (me) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', me)
      .maybeSingle();
    const meName = (prof?.name ?? 'Alguém').split(' ')[0];
    void sendPushToUser(requesterId, {
      title: 'Amizade aceite',
      body: `${meName} aceitou o teu pedido`,
      data: { type: 'friend_accepted', friend_id: me },
    });
  }
  return { ok: true };
}

export async function declineFriendRequest(
  requesterId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('decline_friend_request', {
    p_requester_id: requesterId,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function cancelFriendRequest(
  targetId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('cancel_friend_request', {
    p_target_id: targetId,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function removeFriend(
  otherId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('remove_friend', {
    p_other_id: otherId,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export type FriendMatchEvent = {
  match_id: string;
  scheduled_at: string;
  side_a_name: string;
  side_b_name: string;
  side_a_photo: string | null;
  side_b_photo: string | null;
  final_score_a: number;
  final_score_b: number;
  friend_id: string;
  friend_name: string;
  friend_photo: string | null;
  friend_side: 'A' | 'B';
  friend_goals: number;
  friend_assists: number;
  is_internal: boolean;
};

export type FriendLeaderboardEntry = {
  user_id: string;
  name: string;
  photo_url: string | null;
  win_pct: number;
  matches: number;
  is_self: boolean;
};

export async function fetchFriendsLeaderboard(
  sportId = 2,
): Promise<FriendLeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('friends_leaderboard', {
    p_sport_id: sportId,
  });
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    user_id: r.user_id,
    name: r.name,
    photo_url: r.photo_url ?? null,
    win_pct: Number(r.win_pct ?? 0),
    matches: r.matches ?? 0,
    is_self: !!r.is_self,
  }));
}

export async function fetchFriendsRecentMatches(
  limit = 8,
): Promise<FriendMatchEvent[]> {
  const { data, error } = await supabase.rpc('friends_recent_matches', {
    p_limit: limit,
  });
  if (error || !data) {
    console.error('fetchFriendsRecentMatches error', error);
    return [];
  }
  return (data as any[]).map((r) => ({
    match_id: r.match_id,
    scheduled_at: r.scheduled_at,
    side_a_name: r.side_a_name,
    side_b_name: r.side_b_name,
    side_a_photo: r.side_a_photo,
    side_b_photo: r.side_b_photo,
    final_score_a: r.final_score_a,
    final_score_b: r.final_score_b,
    friend_id: r.friend_id,
    friend_name: r.friend_name,
    friend_photo: r.friend_photo,
    friend_side: (r.friend_side === 'B' ? 'B' : 'A') as 'A' | 'B',
    friend_goals: r.friend_goals ?? 0,
    friend_assists: r.friend_assists ?? 0,
    is_internal: Boolean(r.is_internal),
  }));
}

export type MutualFriend = {
  id: string;
  name: string;
  photo_url: string | null;
  total: number; // total count (same on every row)
};

export async function fetchMutualFriends(
  otherId: string,
  limit = 5,
): Promise<{ list: MutualFriend[]; total: number }> {
  const { data, error } = await supabase.rpc('mutual_friends', {
    p_other_id: otherId,
    p_limit: limit,
  });
  if (error || !data) return { list: [], total: 0 };
  const list = data as MutualFriend[];
  return { list, total: list[0]?.total ?? 0 };
}

export async function fetchPendingFriendsCount(): Promise<number> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return 0;
  const { count, error } = await supabase
    .from('friendships')
    .select('requester_id', { count: 'exact', head: true })
    .eq('addressee_id', me)
    .eq('status', 'pending');
  if (error) return 0;
  return count ?? 0;
}
