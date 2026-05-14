import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  ZoomIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from './Button';
import { colors } from '@/theme';
import type { Achievement } from '@/lib/achievements';

type Props = {
  achievement: Achievement | null;
  onClose: () => void;
};

export function AchievementUnlockModal({ achievement, onClose }: Props) {
  const visible = !!achievement;
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {achievement && (
          <Animated.View
            entering={ZoomIn.duration(320).springify()}
            style={styles.cardWrap}
          >
            <Pressable onPress={() => {}} style={{ width: '100%' }}>
              <LinearGradient
                colors={[ '#1f1810', '#0e1812', '#1f1810' ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.card}
              >
                <Animated.Text
                  entering={FadeIn.delay(120).duration(280)}
                  style={styles.eyebrow}
                >
                  CONQUISTA DESBLOQUEADA
                </Animated.Text>
                <Text style={styles.emoji}>{achievement.emoji}</Text>
                <Text style={styles.title}>{achievement.title}</Text>
                <Text style={styles.body}>{achievement.description}</Text>
                <View style={styles.actions}>
                  <Button
                    label="Boa!"
                    size="lg"
                    haptic="medium"
                    onPress={onClose}
                    full
                  />
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  cardWrap: {
    width: '100%',
  },
  card: {
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 36,
    borderWidth: 1,
    borderColor: 'rgba(201,162,107,0.5)',
    alignItems: 'center',
  },
  eyebrow: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 18,
  },
  emoji: {
    fontSize: 72,
    marginBottom: 18,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.7,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  actions: {
    width: '100%',
    marginTop: 28,
  },
});
