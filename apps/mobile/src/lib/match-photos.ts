import { supabase } from './supabase';
import { uploadMatchPhoto } from './photos';
import type { PickedImage } from './photos';

export type MatchPhoto = {
  id: string;
  match_id: string;
  user_id: string;
  storage_path: string;
  public_url: string;
  caption: string | null;
  created_at: string;
  uploader: {
    id: string;
    name: string;
    photo_url: string | null;
  } | null;
};

export async function fetchMatchPhotos(matchId: string): Promise<MatchPhoto[]> {
  const { data, error } = await supabase
    .from('match_photos')
    .select(
      `id, match_id, user_id, storage_path, public_url, caption, created_at,
       uploader:profiles!match_photos_user_id_fkey(id, name, photo_url)`,
    )
    .eq('match_id', matchId)
    .order('created_at', { ascending: false });
  if (error || !data) {
    console.error('fetchMatchPhotos error', error);
    return [];
  }
  return data as unknown as MatchPhoto[];
}

export async function addMatchPhoto(args: {
  matchId: string;
  image: PickedImage;
  caption?: string;
}): Promise<{ ok: true; photo: MatchPhoto } | { ok: false; message: string }> {
  const up = await uploadMatchPhoto(args.matchId, args.image);
  if (!up.ok) return { ok: false, message: up.message };

  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return { ok: false, message: 'Sem sessão.' };

  const { data, error } = await supabase
    .from('match_photos')
    .insert({
      match_id: args.matchId,
      user_id: me,
      storage_path: up.path,
      public_url: up.publicUrl,
      caption: args.caption?.trim() || null,
    })
    .select(
      `id, match_id, user_id, storage_path, public_url, caption, created_at,
       uploader:profiles!match_photos_user_id_fkey(id, name, photo_url)`,
    )
    .single();
  if (error || !data) {
    // best-effort cleanup of the orphaned object
    await supabase.storage.from('match-photos').remove([up.path]);
    return { ok: false, message: error?.message ?? 'Falhou guardar a foto.' };
  }
  return { ok: true, photo: data as unknown as MatchPhoto };
}

export async function deleteMatchPhoto(
  photo: MatchPhoto,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase
    .from('match_photos')
    .delete()
    .eq('id', photo.id);
  if (error) return { ok: false, message: error.message };
  await supabase.storage.from('match-photos').remove([photo.storage_path]);
  return { ok: true };
}
