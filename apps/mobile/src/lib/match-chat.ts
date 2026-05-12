import { supabase } from './supabase';
import { sendPushToUser } from './push';

export type MatchChatMessage = {
  id: string;
  match_id: string;
  author_id: string;
  text: string;
  created_at: string;
  author?: {
    id: string;
    name: string;
    photo_url: string | null;
  } | null;
};

export async function fetchMatchMessages(
  matchId: string,
  limit = 100,
): Promise<MatchChatMessage[]> {
  const { data, error } = await supabase
    .from('match_messages')
    .select(
      `id, match_id, author_id, text, created_at,
       author:profiles!inner(id, name, photo_url)`,
    )
    .eq('match_id', matchId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) {
    console.error('fetchMatchMessages error', error);
    return [];
  }
  return (data as unknown as MatchChatMessage[]).slice().reverse();
}

export async function sendMatchMessage(
  matchId: string,
  text: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, message: 'Mensagem vazia.' };
  if (trimmed.length > 1000) {
    return { ok: false, message: 'Mensagem demasiado longa.' };
  }
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return { ok: false, message: 'Sessão inválida.' };

  const { error } = await supabase.from('match_messages').insert({
    match_id: matchId,
    author_id: userId,
    text: trimmed,
  });
  if (error) {
    return {
      ok: false,
      message: error.message ?? 'Não foi possível enviar.',
    };
  }
  void fanOutMatchChatPush({ matchId, authorId: userId, text: trimmed });
  return { ok: true };
}

async function fanOutMatchChatPush(args: {
  matchId: string;
  authorId: string;
  text: string;
}) {
  // Pull both teams + their names so the push title can show "Time A vs Time B"
  const { data: sides } = await supabase
    .from('match_sides')
    .select('team_id, team:teams!inner(name)')
    .eq('match_id', args.matchId);
  if (!sides) return;

  const teamIds = sides.map((s: any) => s.team_id as string);
  const title = sides.map((s: any) => s.team?.name as string).join(' vs ');

  const { data: members } = await supabase
    .from('team_members')
    .select('user_id')
    .in('team_id', teamIds)
    .neq('user_id', args.authorId);
  if (!members) return;

  const { data: author } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', args.authorId)
    .maybeSingle();

  const authorName = (author?.name ?? 'Alguém').split(' ')[0];
  const preview =
    args.text.length > 80 ? args.text.slice(0, 80) + '…' : args.text;
  const recipients = Array.from(
    new Set(members.map((m: any) => m.user_id as string)),
  );

  await Promise.all(
    recipients.map((uid) =>
      sendPushToUser(uid, {
        title,
        body: `${authorName}: ${preview}`,
        data: {
          type: 'match_chat',
          match_id: args.matchId,
        },
      }),
    ),
  );
}

export function subscribeMatchMessages(
  matchId: string,
  onInsert: (msg: MatchChatMessage) => void,
) {
  const channel = supabase
    .channel(`match-chat-${matchId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'match_messages',
        filter: `match_id=eq.${matchId}`,
      },
      async (payload) => {
        const m = payload.new as Omit<MatchChatMessage, 'author'>;
        const { data: author } = await supabase
          .from('profiles')
          .select('id, name, photo_url')
          .eq('id', m.author_id)
          .maybeSingle();
        onInsert({ ...m, author: author as MatchChatMessage['author'] });
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function markMatchChatRead(
  matchId: string,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('mark_match_chat_read', {
    p_match_id: matchId,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function fetchMatchUnreadCount(
  matchId: string,
  userId: string,
): Promise<number> {
  const { data: read } = await supabase
    .from('match_chat_reads')
    .select('last_read_at')
    .eq('match_id', matchId)
    .eq('user_id', userId)
    .maybeSingle();

  const since = read?.last_read_at ?? '1970-01-01T00:00:00Z';

  const { count, error } = await supabase
    .from('match_messages')
    .select('id', { count: 'exact', head: true })
    .eq('match_id', matchId)
    .gt('created_at', since)
    .neq('author_id', userId);

  if (error) return 0;
  return count ?? 0;
}
