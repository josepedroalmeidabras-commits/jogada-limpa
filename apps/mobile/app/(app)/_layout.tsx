import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '@/providers/auth';
import {
  acknowledgeWarning,
  fetchModerationFlags,
  type ModerationFlags,
} from '@/lib/moderation';
import { SuspendedScreen } from '@/components/SuspendedScreen';
import { WarningModal } from '@/components/WarningModal';

export default function AppLayout() {
  const { session, signOut } = useAuth();
  const userId = session?.user.id ?? null;
  const [flags, setFlags] = useState<ModerationFlags | null>(null);
  const [checked, setChecked] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setFlags(null);
      setChecked(true);
      return;
    }
    const f = await fetchModerationFlags(userId);
    setFlags(f);
    setChecked(true);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleAcknowledge() {
    setAcknowledging(true);
    const r = await acknowledgeWarning();
    setAcknowledging(false);
    if (r.ok) {
      setFlags((f) => (f ? { ...f, warningPending: false } : f));
    }
  }

  if (!checked) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0E1812',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  if (flags?.isSuspended) {
    return (
      <SuspendedScreen
        suspendedAt={flags.suspendedAt}
        onSignOut={() => {
          void signOut();
        }}
      />
    );
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0E1812' },
          headerBackTitle: '',
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      <WarningModal
        visible={!!flags?.warningPending}
        onAcknowledge={handleAcknowledge}
        acknowledging={acknowledging}
      />
    </>
  );
}
