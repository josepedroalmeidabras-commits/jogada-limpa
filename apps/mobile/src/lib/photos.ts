import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

export type PickedImage = {
  uri: string;
  mimeType: string;
  base64: string | null;
};

export async function pickImage(opts?: {
  allowsEditing?: boolean;
  aspect?: [number, number];
}): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: opts?.allowsEditing ?? true,
    aspect: opts?.aspect ?? [1, 1],
    quality: 0.6,
    base64: true,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0]!;
  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? 'image/jpeg',
    base64: asset.base64 ?? null,
  };
}

function extFromMime(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function uriToArrayBuffer(uri: string): Promise<ArrayBuffer | null> {
  return new Promise((resolve) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.responseType = 'arraybuffer';
      xhr.onload = () => {
        if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
          resolve(xhr.response as ArrayBuffer);
        } else {
          resolve(null);
        }
      };
      xhr.onerror = () => resolve(null);
      xhr.open('GET', uri);
      xhr.send();
    } catch {
      resolve(null);
    }
  });
}

async function getImageBytes(
  image: PickedImage,
): Promise<{ ok: true; bytes: Uint8Array; via: string } | { ok: false; message: string }> {
  // Path A: base64 from picker (no file:// reading at all).
  if (image.base64) {
    const bytes = base64ToBytes(image.base64);
    if (bytes.byteLength > 0) return { ok: true, bytes, via: 'base64' };
  }
  // Path B: read file:// via XMLHttpRequest as ArrayBuffer.
  const buf = await uriToArrayBuffer(image.uri);
  if (buf && buf.byteLength > 0) {
    return { ok: true, bytes: new Uint8Array(buf), via: 'xhr' };
  }
  // Path C: fetch().arrayBuffer() — last resort.
  try {
    const res = await fetch(image.uri);
    const ab = await res.arrayBuffer();
    if (ab.byteLength > 0) {
      return { ok: true, bytes: new Uint8Array(ab), via: 'fetch' };
    }
  } catch {}
  return {
    ok: false,
    message:
      'Não consegui ler a imagem (todos os métodos devolveram 0 bytes). Tenta outra foto ou outra app.',
  };
}

async function uploadBytesToBucket(
  bucket: string,
  path: string,
  image: PickedImage,
  upsert: boolean,
): Promise<{ ok: true; via: string } | { ok: false; message: string }> {
  const bytesRes = await getImageBytes(image);
  if (!bytesRes.ok) return bytesRes;
  const { bytes, via } = bytesRes;

  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: image.mimeType,
    upsert,
  });
  if (error) {
    return {
      ok: false,
      message: `Upload falhou (${bytes.byteLength}B via ${via}): ${error.message}`,
    };
  }
  return { ok: true, via };
}

export async function uploadAvatar(
  userId: string,
  image: PickedImage,
): Promise<{ ok: true; publicUrl: string } | { ok: false; message: string }> {
  const ext = extFromMime(image.mimeType);
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const r = await uploadBytesToBucket('avatars', path, image, true);
  if (!r.ok) return r;
  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
  return { ok: true, publicUrl: pub.publicUrl };
}

export async function uploadMatchPhoto(
  matchId: string,
  image: PickedImage,
): Promise<{ ok: true; publicUrl: string; path: string } | { ok: false; message: string }> {
  const ext = extFromMime(image.mimeType);
  const path = `${matchId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const r = await uploadBytesToBucket('match-photos', path, image, false);
  if (!r.ok) return r;
  const { data: pub } = supabase.storage.from('match-photos').getPublicUrl(path);
  return { ok: true, publicUrl: pub.publicUrl, path };
}

export async function uploadTeamLogo(
  teamId: string,
  image: PickedImage,
): Promise<{ ok: true; publicUrl: string } | { ok: false; message: string }> {
  const ext = extFromMime(image.mimeType);
  const path = `${teamId}/logo-${Date.now()}.${ext}`;
  const r = await uploadBytesToBucket('team-logos', path, image, true);
  if (!r.ok) return r;
  const { data: pub } = supabase.storage.from('team-logos').getPublicUrl(path);
  return { ok: true, publicUrl: pub.publicUrl };
}
