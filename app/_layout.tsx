// ============================================================================
// Stockr – root layout
// Auth guard + deep link handler pro stockr://invite/TOKEN
// ============================================================================
import 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Alert, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/src/lib/supabase';
import { acceptInvitation } from '@/src/lib/supabase';
import { colors } from '@/src/theme';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  // --- Session boot ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  // --- Auth guard (routing podle session) ---
  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [session, loading, segments]);

  // --- Deep link handler: stockr://invite/TOKEN ---
  useEffect(() => {
    const handle = async (url: string | null) => {
      if (!url) return;
      const parsed = Linking.parse(url);
      // Expo Linking: path např. "invite/abc-token"
      const path = parsed.path ?? '';
      const match = path.match(/^invite\/(.+)$/);
      if (!match) return;
      const token = match[1];

      const s = (await supabase.auth.getSession()).data.session;
      if (!s) {
        // Pokud nejsme přihlášeni, schovat do pendingInviteToken by šlo přes SecureStore.
        // Zatím jen upozorníme.
        Alert.alert('Pozvánka', 'Přihlaste se a otevřete odkaz znovu.');
        return;
      }
      try {
        await acceptInvitation(token, s.user.id);
        Alert.alert('Hotovo', 'Pozvánka přijata. Vítej ve sdíleném skladu!');
        router.replace('/(app)');
      } catch (e: any) {
        Alert.alert('Chyba pozvánky', e?.message ?? 'Neznámá chyba');
      }
    };

    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, []);

  if (loading) {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.background,
          }}
        >
          <ActivityIndicator color={colors.primary} />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </GestureHandlerRootView>
  );
}
