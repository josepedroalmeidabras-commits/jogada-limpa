import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { LogoMark } from '@/components/Logo';
import { Heading, Eyebrow } from '@/components/Heading';
import { colors } from '@/theme';

const version =
  (Constants.expoConfig?.version as string | undefined) ?? '0.0.0';
const buildId =
  ((Constants.expoConfig as any)?.ios?.buildNumber as string | undefined) ??
  ((Constants.expoConfig as any)?.android?.versionCode as
    | string
    | undefined) ??
  null;

const LINKS: Array<{
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  url?: string;
}> = [
  {
    label: 'Termos e condições',
    icon: 'document-text-outline',
    url: 'https://jogadalimpa.app/terms',
  },
  {
    label: 'Política de privacidade',
    icon: 'shield-checkmark-outline',
    url: 'https://jogadalimpa.app/privacy',
  },
  {
    label: 'Contactar suporte',
    icon: 'mail-outline',
    url: 'mailto:suporte@jogadalimpa.app',
  },
  {
    label: 'Reportar bug',
    icon: 'bug-outline',
    url: 'mailto:suporte@jogadalimpa.app?subject=Bug%20report',
  },
];

export default function AboutScreen() {
  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Sobre',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.duration(300).springify()}
          style={styles.hero}
        >
          <LogoMark size={64} />
          <Heading level={1} style={{ marginTop: 16 }}>
            Jogada Limpa
          </Heading>
          <Text style={styles.tagline}>O Strava do futebol amador.</Text>
          <Text style={styles.version}>
            {buildId ? `Versão ${version} (${buildId})` : `Versão ${version}`}
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(80).springify()}
          style={{ marginTop: 32 }}
        >
          <Eyebrow>Recursos</Eyebrow>
          <Card style={{ marginTop: 12, padding: 0 }}>
            {LINKS.map((link, i) => (
              <Pressable
                key={link.label}
                onPress={() => link.url && Linking.openURL(link.url)}
                style={[
                  styles.linkRow,
                  i < LINKS.length - 1 && styles.linkRowDivider,
                ]}
              >
                <Ionicons name={link.icon} size={20} color={colors.text} />
                <Text style={styles.linkLabel}>{link.label}</Text>
                <Ionicons
                  name="open-outline"
                  size={16}
                  color={colors.textDim}
                />
              </Pressable>
            ))}
          </Card>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(140).springify()}
          style={{ marginTop: 32 }}
        >
          <Eyebrow>Construído em</Eyebrow>
          <Card style={{ marginTop: 12 }}>
            <Text style={styles.body}>
              Coimbra, Portugal · 2026.{'\n\n'}Para amadores que querem jogar
              limpo, contra adversários do seu nível.
            </Text>
          </Card>
        </Animated.View>

        <View style={styles.foot}>
          <Text style={styles.footText}>
            © 2026 Jogada Limpa. Todos os direitos reservados.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
  hero: { alignItems: 'center', marginTop: 24 },
  tagline: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 8,
    letterSpacing: -0.1,
  },
  version: { color: colors.textDim, fontSize: 12, marginTop: 12 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  linkRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  linkLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  foot: { marginTop: 40, alignItems: 'center' },
  footText: { color: colors.textDim, fontSize: 11, letterSpacing: 0.2 },
});
