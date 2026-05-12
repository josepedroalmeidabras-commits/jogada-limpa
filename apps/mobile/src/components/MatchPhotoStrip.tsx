import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  addMatchPhoto,
  deleteMatchPhoto,
  fetchMatchPhotos,
  type MatchPhoto,
} from '@/lib/match-photos';
import { pickImage } from '@/lib/photos';
import { useAuth } from '@/providers/auth';
import { Card } from './Card';
import { Eyebrow } from './Heading';
import { colors } from '@/theme';

type Props = {
  matchId: string;
  canUpload: boolean;
};

export function MatchPhotoStrip({ matchId, canUpload }: Props) {
  const { session } = useAuth();
  const [photos, setPhotos] = useState<MatchPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<MatchPhoto | null>(null);

  const load = useCallback(async () => {
    const list = await fetchMatchPhotos(matchId);
    setPhotos(list);
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd() {
    const img = await pickImage({ allowsEditing: false });
    if (!img) return;
    setUploading(true);
    const r = await addMatchPhoto({ matchId, image: img });
    setUploading(false);
    if (!r.ok) {
      Alert.alert('Erro', r.message);
      return;
    }
    setPhotos((prev) => [r.photo, ...prev]);
  }

  function confirmDelete(photo: MatchPhoto) {
    Alert.alert('Apagar foto?', 'Não pode ser desfeito.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          const r = await deleteMatchPhoto(photo);
          if (!r.ok) {
            Alert.alert('Erro', r.message ?? 'Falhou.');
            return;
          }
          setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
          setPreview(null);
        },
      },
    ]);
  }

  if (loading) return null;
  if (photos.length === 0 && !canUpload) return null;

  return (
    <View style={{ marginTop: 24 }}>
      <View style={styles.headerRow}>
        <Eyebrow>{`Fotos · ${photos.length}`}</Eyebrow>
        {canUpload && (
          <Pressable
            onPress={handleAdd}
            disabled={uploading}
            style={[styles.addBtn, uploading && { opacity: 0.5 }]}
          >
            <Ionicons name="camera" size={14} color={colors.brand} />
            <Text style={styles.addBtnText}>
              {uploading ? 'A carregar...' : 'Adicionar'}
            </Text>
          </Pressable>
        )}
      </View>

      {photos.length === 0 ? (
        <Card style={{ marginTop: 8 }}>
          <Text style={styles.empty}>
            Ainda sem fotos. Sê o primeiro a partilhar uma memória.
          </Text>
        </Card>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
        >
          {photos.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => setPreview(p)}
              style={styles.thumbWrap}
            >
              <Image source={{ uri: p.public_url }} style={styles.thumb} />
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Modal
        visible={preview !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreview(null)}
      >
        <TouchableWithoutFeedback onPress={() => setPreview(null)}>
          <View style={styles.modalBg}>
            <Pressable
              onPress={() => setPreview(null)}
              hitSlop={16}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
            {preview && (
              <View style={styles.modalContent}>
                <Image
                  source={{ uri: preview.public_url }}
                  style={styles.fullImg}
                  resizeMode="contain"
                />
                {preview.caption && (
                  <Text style={styles.caption}>{preview.caption}</Text>
                )}
                <Text style={styles.author}>
                  {preview.uploader?.name ?? 'Anónimo'}
                </Text>
                {session?.user.id === preview.user_id && (
                  <Pressable
                    onPress={() => confirmDelete(preview)}
                    style={styles.deleteBtn}
                  >
                    <Ionicons name="trash" size={16} color="#f87171" />
                    <Text style={styles.deleteText}>Apagar</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const THUMB = 96;

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
  },
  addBtnText: { color: colors.brand, fontSize: 12, fontWeight: '700' },
  empty: { color: colors.textMuted, fontSize: 13 },
  strip: { gap: 8, paddingVertical: 12 },
  thumbWrap: {
    width: THUMB,
    height: THUMB,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.bgElevated,
  },
  thumb: { width: '100%', height: '100%' },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: { width: '100%', alignItems: 'center', padding: 16 },
  fullImg: { width: '100%', height: '70%', maxHeight: 600 },
  caption: {
    color: '#fff',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  author: { color: '#a3a3a3', fontSize: 12, marginTop: 8 },
  closeBtn: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 10,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.4)',
    backgroundColor: 'rgba(248,113,113,0.12)',
    marginTop: 16,
  },
  deleteText: { color: '#f87171', fontWeight: '700', fontSize: 13 },
});
