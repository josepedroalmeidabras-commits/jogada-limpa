import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeOutUp,
  SlideInUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme';

export type ToastType = 'success' | 'error' | 'info';

type Toast = {
  id: number;
  message: string;
  type: ToastType;
};

type ShowToastOptions = {
  type?: ToastType;
  duration?: number;
};

type ToastCtx = {
  showToast: (message: string, options?: ShowToastOptions) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

const TYPE_ICON: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
};

const TYPE_ACCENT: Record<ToastType, string> = {
  success: colors.brand,
  error: colors.danger,
  info: colors.compete,
};

const TYPE_GRADIENT: Record<ToastType, [string, string]> = {
  success: ['rgba(201,162,107,0.20)', 'rgba(201,162,107,0.04)'],
  error: ['rgba(248,113,113,0.20)', 'rgba(248,113,113,0.04)'],
  info: ['rgba(91,176,255,0.20)', 'rgba(91,176,255,0.04)'],
};

const TYPE_BORDER: Record<ToastType, string> = {
  success: colors.brandSoftBorder,
  error: colors.dangerSoftBorder,
  info: colors.competeDim,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextIdRef = useRef(1);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message: string, options: ShowToastOptions = {}) => {
      const type = options.type ?? 'info';
      const duration = options.duration ?? (type === 'error' ? 4500 : 2800);
      const id = nextIdRef.current++;
      setToasts((prev) => [...prev, { id, message, type }]);
      void Haptics.notificationAsync(
        type === 'success'
          ? Haptics.NotificationFeedbackType.Success
          : type === 'error'
            ? Haptics.NotificationFeedbackType.Error
            : Haptics.NotificationFeedbackType.Warning,
      );
      const timer = setTimeout(() => dismiss(id), duration);
      timersRef.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <View
        pointerEvents="box-none"
        style={[
          styles.host,
          { top: insets.top + 8 },
        ]}
      >
        {toasts.map((t) => (
          <Animated.View
            key={t.id}
            entering={SlideInUp.duration(220).easing(
              Easing.bezier(0.23, 1, 0.32, 1),
            )}
            exiting={FadeOutUp.duration(180)}
            style={styles.toastWrap}
          >
            <Pressable onPress={() => dismiss(t.id)}>
              <LinearGradient
                colors={TYPE_GRADIENT[t.type]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.toast,
                  { borderColor: TYPE_BORDER[t.type] },
                ]}
              >
                <ToastIconRing type={t.type} />
                <Text style={styles.message} numberOfLines={3}>
                  {t.message}
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </Ctx.Provider>
  );
}

function ToastIconRing({ type }: { type: ToastType }) {
  // Subtle "look at me" scale-up no enter: 1 → 1.12 → 1 em ~600ms.
  // Emil's principle: rare moments podem ter delight extra.
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.12, {
        duration: 220,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
      }),
      withTiming(1, {
        duration: 380,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
      }),
    );
  }, [scale]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View
      style={[
        styles.iconRing,
        { borderColor: TYPE_BORDER[type] },
        animatedStyle,
      ]}
    >
      <Ionicons name={TYPE_ICON[type]} size={18} color={TYPE_ACCENT[type]} />
    </Animated.View>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Fallback no-op so screens don't crash if rendered outside provider
    return {
      showToast: () => {
        if (__DEV__) {
          console.warn('useToast used outside <ToastProvider>');
        }
      },
    };
  }
  return ctx;
}

// One-liner export — sugar para flows simples (success / error)
export function toastSuccess(showToast: ToastCtx['showToast'], message: string) {
  showToast(message, { type: 'success' });
}
export function toastError(showToast: ToastCtx['showToast'], message: string) {
  showToast(message, { type: 'error' });
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    zIndex: 9999,
    gap: 8,
  },
  toastWrap: {
    width: '100%',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    paddingRight: 18,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: colors.bg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  iconRing: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  message: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
    lineHeight: 19,
  },
});

