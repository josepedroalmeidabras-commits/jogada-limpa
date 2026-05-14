import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, gradients } from '@/theme';

export type MatchKind = 'match' | 'internal' | 'open';

type Option = {
  kind: MatchKind;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  gradient: [string, string];
  borderColor: string;
  title: string;
  description: string;
};

const OPTIONS: Option[] = [
  {
    kind: 'match',
    icon: 'shield',
    iconColor: '#9CC6FF',
    gradient: ['rgba(91,176,255,0.22)', 'rgba(91,176,255,0.04)'],
    borderColor: 'rgba(91,176,255,0.35)',
    title: 'Contra outra equipa',
    description: 'Jogo amigável entre dois clubes — V/D conta no ranking.',
  },
  {
    kind: 'internal',
    icon: 'flame',
    iconColor: '#FFC489',
    gradient: ['rgba(255,138,61,0.26)', 'rgba(201,162,107,0.06)'],
    borderColor: 'rgba(255,138,61,0.4)',
    title: 'Peladinha interna',
    description: 'Coletes contra Sem Coletes. Diversão entre malta da equipa.',
  },
  {
    kind: 'open',
    icon: 'megaphone',
    iconColor: '#FBD774',
    gradient: ['rgba(251,191,36,0.22)', 'rgba(251,191,36,0.04)'],
    borderColor: 'rgba(251,191,36,0.35)',
    title: 'Desafio aberto',
    description: 'Lança a data e local, deixa outras equipas pedirem o jogo.',
  },
];

export function MatchKindSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (kind: MatchKind) => void;
}) {
  function handlePick(kind: MatchKind) {
    void Haptics.selectionAsync();
    onSelect(kind);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          entering={FadeInUp.duration(320).easing(
            Easing.bezier(0.32, 0.72, 0, 1),
          )}
          style={styles.sheetWrap}
          // Stop propagation — taps on sheet shouldn't close
          onStartShouldSetResponder={() => true}
        >
          <LinearGradient
            colors={gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.sheet}
          >
            <View style={styles.handle} />

            <Text style={styles.title}>Marcar jogo</Text>
            <Text style={styles.subtitle}>
              Que tipo de jogo queres marcar?
            </Text>

            <View style={{ marginTop: 22, gap: 10 }}>
              {OPTIONS.map((opt, i) => (
                <Animated.View
                  key={opt.kind}
                  entering={FadeIn.delay(80 + i * 40).duration(240)}
                >
                  <Pressable
                    onPress={() => handlePick(opt.kind)}
                    style={({ pressed }) => [
                      styles.optionRow,
                      pressed && styles.optionRowPressed,
                    ]}
                  >
                    <LinearGradient
                      colors={opt.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[
                        styles.optionIcon,
                        { borderColor: opt.borderColor },
                      ]}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={22}
                        color={opt.iconColor}
                      />
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionTitle}>{opt.title}</Text>
                      <Text style={styles.optionDescription}>
                        {opt.description}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={colors.textDim}
                    />
                  </Pressable>
                </Animated.View>
              ))}
            </View>

            <Pressable onPress={onClose} style={styles.cancel}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  sheet: {
    borderRadius: 26,
    padding: 24,
    paddingTop: 14,
    borderWidth: 1,
    borderColor: colors.goldDim,
    shadowColor: '#C9A26B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 6,
    letterSpacing: -0.1,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  optionRowPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    transform: [{ scale: 0.99 }],
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  optionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  optionDescription: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  cancel: {
    marginTop: 18,
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
