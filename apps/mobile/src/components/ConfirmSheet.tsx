import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, gradients } from '@/theme';

export type ConfirmTone = 'neutral' | 'danger';

export type ConfirmOption = {
  label: string;
  onPress: () => void;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  tone?: ConfirmTone;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  options: ConfirmOption[];
  cancelLabel?: string;
};

export function ConfirmSheet({
  visible,
  onClose,
  title,
  subtitle,
  options,
  cancelLabel = 'Cancelar',
}: Props) {
  function handlePick(opt: ConfirmOption) {
    void Haptics.selectionAsync();
    opt.onPress();
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
          entering={FadeInUp.duration(280).springify()}
          style={styles.sheetWrap}
          onStartShouldSetResponder={() => true}
        >
          <LinearGradient
            colors={gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.sheet}
          >
            <View style={styles.handle} />

            <Text style={styles.title}>{title}</Text>
            {subtitle ? (
              <Text style={styles.subtitle}>{subtitle}</Text>
            ) : null}

            <View style={{ marginTop: 20, gap: 10 }}>
              {options.map((opt, i) => {
                const isDanger = opt.tone === 'danger';
                return (
                  <Animated.View
                    key={`${opt.label}-${i}`}
                    entering={FadeIn.delay(60 + i * 40).duration(220)}
                  >
                    <Pressable
                      onPress={() => handlePick(opt)}
                      style={({ pressed }) => [
                        styles.optionRow,
                        isDanger && styles.optionDanger,
                        pressed && styles.optionPressed,
                      ]}
                    >
                      {opt.icon ? (
                        <View
                          style={[
                            styles.optionIcon,
                            isDanger && styles.optionIconDanger,
                          ]}
                        >
                          <Ionicons
                            name={opt.icon}
                            size={18}
                            color={
                              opt.iconColor ??
                              (isDanger ? colors.danger : colors.brand)
                            }
                          />
                        </View>
                      ) : null}
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.optionTitle,
                            isDanger && { color: colors.danger },
                          ]}
                        >
                          {opt.label}
                        </Text>
                        {opt.description ? (
                          <Text style={styles.optionDescription}>
                            {opt.description}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={colors.textDim}
                      />
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>

            <Pressable onPress={onClose} style={styles.cancel}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
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
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 6,
    letterSpacing: -0.1,
    lineHeight: 20,
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
  optionDanger: {
    borderColor: colors.dangerSoftBorder,
    backgroundColor: colors.dangerSoft,
  },
  optionPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    transform: [{ scale: 0.99 }],
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
    backgroundColor: colors.brandSoft,
  },
  optionIconDanger: {
    borderColor: colors.dangerSoftBorder,
    backgroundColor: colors.dangerSoft,
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
