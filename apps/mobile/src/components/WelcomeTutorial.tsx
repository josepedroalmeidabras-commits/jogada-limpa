import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LogoMark } from './Logo';
import { Button } from './Button';
import { colors } from '@/theme';

type Step = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    icon: 'people',
    title: 'Junta a malta numa equipa',
    body:
      'Cria a tua equipa de S7VN e convida os teus jogadores com um código. Se já há equipa, entra com o código que o capitão partilhar.',
  },
  {
    icon: 'calendar',
    title: 'Marca jogos a sério ou peladinhas',
    body:
      'Capitães e sub-capitães marcam jogos contra outras equipas, anunciam peladinhas internas ou publicam desafios abertos. Quem joga recebe convite e confirma.',
  },
  {
    icon: 'star',
    title: 'Avalia depois do jogo',
    body:
      'No fim de cada jogo validado, avalia os outros em fair play, pontualidade e nível técnico. Anónimo até bilateral fechar — sem rancores.',
  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function WelcomeTutorial({ visible, onClose }: Props) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step]!;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <Animated.View
          entering={FadeIn.duration(220)}
          style={styles.inner}
        >
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.skipTop,
              pressed && { opacity: 0.6 },
            ]}
            hitSlop={12}
          >
            <Text style={styles.skipTopText}>Saltar</Text>
          </Pressable>

          <View style={styles.brand}>
            <LogoMark size={56} />
          </View>

          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === step && styles.dotActive]}
              />
            ))}
          </View>

          <Animated.View
            key={step}
            entering={FadeInDown.duration(280).springify()}
            style={styles.content}
          >
            <View style={styles.iconBubble}>
              <Ionicons
                name={current.icon}
                size={28}
                color={colors.brand}
              />
            </View>
            <Text style={styles.eyebrow}>{`Passo ${step + 1} de ${STEPS.length}`}</Text>
            <Text style={styles.title}>{current.title}</Text>
            <Text style={styles.body}>{current.body}</Text>
          </Animated.View>

          <View style={styles.footer}>
            <Button
              label={isLast ? 'Começar' : 'Próximo'}
              size="lg"
              haptic="light"
              onPress={() => {
                if (isLast) onClose();
                else setStep((s) => s + 1);
              }}
              full
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 48,
  },
  skipTop: {
    position: 'absolute',
    top: 64,
    right: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    zIndex: 10,
  },
  skipTopText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  brand: {
    alignItems: 'center',
    marginTop: 24,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderMuted,
  },
  dotActive: {
    backgroundColor: colors.brand,
    width: 22,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  iconBubble: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  eyebrow: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
    marginBottom: 16,
  },
  body: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    maxWidth: 320,
  },
  footer: {
    marginTop: 16,
  },
});
