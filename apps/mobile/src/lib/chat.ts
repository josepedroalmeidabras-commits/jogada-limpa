import { supabase } from './supabase';
import { sendPushToUser } from './push';

export type ChatMessage = {
  id: string;
  team_id: string;
  author_id: string;
  text: string;
  created_at: string;
  author?: {
    id: string;
    name: string;
    photo_url: string | null;
  } | null;
};

export async function fetchTeamMessages(
  teamId: string,
  limit = 50,
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('team_messages')
    .select(
      `id, team_id, author_id, text, created_at,
       author:profiles!inner(id, name, photo_url)`,
    )
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) {
    console.error('fetchTeamMessages error', error);
    return [];
  }
  // ascending order in UI (older first, newer at bottom)
  return (data as unknown as ChatMessage[]).slice().reverse();
}

export async function sendTeamMessage(
  teamId: string,
  text: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, message: 'Mensagem vazia.' };
  if (trimmed.length > 1000) {
    return { ok: false, message: 'Mensagem demasiado longa.' };
  }
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return { ok: false, message: 'Sessão inválida.' };
  const { error } = await supabase.from('team_messages').insert({
    team_id: teamId,
    author_id: userId,
    text: trimmed,
  });
  if (error) {
    return {
      ok: false,
      message: error.message ?? 'Não foi possível enviar.',
    };
  }
  void fanOutChatPush({ teamId, authorId: userId, text: trimmed });
  return { ok: true };
}

async function fanOutChatPush(args: {
  teamId: string;
  authorId: string;
  text: string;
}) {
  const { data: team } = await supabase
    .from('teams')
    .select('name')
    .eq('id', args.teamId)
    .maybeSingle();
  const { data: author } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', args.authorId)
    .maybeSingle();
  const { data: members } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', args.teamId)
    .neq('user_id', args.authorId);
  if (!members) return;

  const teamName = team?.name ?? 'Equipa';
  const authorName = (author?.name ?? 'Alguém').split(' ')[0];
  const preview =
    args.text.length > 80 ? args.text.slice(0, 80) + '…' : args.text;

  await Promise.all(
    members.map((m) =>
      sendPushToUser(m.user_id, {
        title: teamName,
        body: `${authorName}: ${preview}`,
        data: {
          type: 'team_chat',
          team_id: args.teamId,
        },
      }),
    ),
  );
}

export async function markTeamChatRead(
  teamId: string,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('mark_team_chat_read', {
    p_team_id: teamId,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function fetchTeamUnreadCount(
  teamId: string,
  userId: string,
): Promise<number> {
  const { data: read } = await supabase
    .from('team_chat_reads')
    .select('last_read_at')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .maybeSingle();

  const since = read?.last_read_at ?? '1970-01-01T00:00:00Z';

  const { count, error } = await supabase
    .from('team_messages')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .gt('created_at', since)
    .neq('author_id', userId);

  if (error) return 0;
  return count ?? 0;
}

export async function fetchUnreadByTeam(
  teamIds: string[],
  userId: string,
): Promise<Record<string, number>> {
  if (teamIds.length === 0) return {};
  const results = await Promise.all(
    teamIds.map(async (id) => [id, await fetchTeamUnreadCount(id, userId)] as const),
  );
  return Object.fromEntries(results);
}

export function subscribeTeamMessages(
  teamId: string,
  onInsert: (msg: ChatMessage) => void,
) {
  const channel = supabase
    .channel(`team-chat-${teamId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'team_messages',
        filter: `team_id=eq.${teamId}`,
      },
      async (payload) => {
        const m = payload.new as Omit<ChatMessage, 'author'>;
        // hydrate author lazily
        const { data: author } = await supabase
          .from('profiles')
          .select('id, name, photo_url')
          .eq('id', m.author_id)
          .maybeSingle();
        onInsert({ ...m, author: author as ChatMessage['author'] });
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
