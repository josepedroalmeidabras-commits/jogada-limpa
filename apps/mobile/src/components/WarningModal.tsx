import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Button } from '@/components/Button';
import { colors } from '@/theme';

export function WarningModal({
  visible,
  onAcknowledge,
  acknowledging,
}: {
  visible: boolean;
  onAcknowledge: () => void;
  acknowledging: boolean;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View entering={ZoomIn.duration(280)} style={styles.card}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>⚠️</Text>
          </View>
          <Text style={styles.title}>Aviso da S7VN</Text>
          <Text style={styles.body}>
            Foram recebidas denúncias contra ti num jogo. Comportamento
            anti-desportivo, faltas repetidas ou insultos podem suspender a
            tua conta.
          </Text>
          <Text style={styles.warning}>
            Se receberes denúncias num segundo jogo, a conta é suspensa
            automaticamente.
          </Text>
          <View style={{ height: 20 }} />
          <Button
            label="Compreendi"
            onPress={onAcknowledge}
            loading={acknowledging}
            full
            size="lg"
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.bgElevated,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconText: { fontSize: 32 },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 12,
  },
  warning: {
    color: '#fbbf24',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
});
