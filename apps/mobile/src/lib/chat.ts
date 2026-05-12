import { supabase } from './supabase';

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
  return { ok: true };
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
