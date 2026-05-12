import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

export type PickedImage = {
  uri: string;
  mimeType: string;
};

export async function pickImage(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.75,
    base64: false,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0]!;
  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? 'image/jpeg',
  };
}

function extFromMime(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
}

async function uriToBlob(uri: string): Promise<Blob> {
  // RN fetch can read file:// URIs
  const res = await fetch(uri);
  return await res.blob();
}

export async function uploadAvatar(
  userId: string,
  image: PickedImage,
): Promise<{ ok: true; publicUrl: string } | { ok: false; message: string }> {
  const ext = extFromMime(image.mimeType);
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  try {
    const blob = await uriToBlob(image.uri);
    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, blob, {
        contentType: image.mimeType,
        upsert: true,
      });
    if (error) {
      return {
        ok: false,
        message: error.message ?? 'Falhou o upload.',
      };
    }
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    return { ok: true, publicUrl: pub.publicUrl };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Erro desconhecido.',
    };
  }
}

export async function uploadTeamLogo(
  teamId: string,
  image: PickedImage,
): Promise<{ ok: true; publicUrl: string } | { ok: false; message: string }> {
  const ext = extFromMime(image.mimeType);
  const path = `${teamId}/logo-${Date.now()}.${ext}`;
  try {
    const blob = await uriToBlob(image.uri);
    const { error } = await supabase.storage
      .from('team-logos')
      .upload(path, blob, {
        contentType: image.mimeType,
        upsert: true,
      });
    if (error) {
      return {
        ok: false,
        message: error.message ?? 'Falhou o upload.',
      };
    }
    const { data: pub } = supabase.storage
      .from('team-logos')
      .getPublicUrl(path);
    return { ok: true, publicUrl: pub.publicUrl };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Erro desconhecido.',
    };
  }
}
