import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { InFormStatus } from '@/lib/in-form';

export function InFormBanner({ status }: { status: InFormStatus }) {
  const parts: string[] = [];
  if (status.mvpCount > 0) {
    parts.push(`${status.mvpCount} MVP${status.mvpCount === 1 ? '' : 's'}`);
  }
  if (status.goals > 0) {
    parts.push(`${status.goals} ${status.goals === 1 ? 'golo' : 'golos'}`);
  }
  if (status.assists > 0) {
    parts.push(
      `${status.assists} ${status.assists === 1 ? 'assistência' : 'assistências'}`,
    );
  }

  return (
    <View style={styles.outer}>
      <LinearGradient
        colors={['#FF8A3D', '#C9A26B', '#5A2D0C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.glowEdge}
      >
        <View style={styles.inner}>
          <View style={styles.iconCircle}>
            <Ionicons name="flame" size={20} color="#FFC489" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>EM FORMA · ÚLTIMOS 7 DIAS</Text>
            <Text style={styles.body}>{parts.join(' · ')}</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginTop: 14,
    borderRadius: 18,
    shadowColor: '#FF8A3D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
  },
  glowEdge: {
    borderRadius: 18,
    padding: 1.5,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16.5,
    backgroundColor: '#180A07',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 138, 61, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 61, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    color: '#FFC489',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  body: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginTop: 4,
  },
});
