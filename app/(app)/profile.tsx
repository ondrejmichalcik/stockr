// ============================================================================
// Stockr – Profile / global settings
// Per-device settings that don't belong to a single warehouse: signed-in
// user, Anthropic API key for Claude Vision, sign out. Pushed from the
// profile icon on the Warehouses list screen.
// ============================================================================
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { signOut, supabase } from '@/src/lib/supabase';
import {
  clearAnthropicKey,
  getAnthropicKey,
  setAnthropicKey,
} from '@/src/lib/secureStore';
import { testAnthropicKey } from '@/src/lib/vision';
import { colors, radius, shadows, spacing, typography } from '@/src/theme';
import { Icon } from '@/src/components/Icon';

export default function ProfileScreen() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [keyStatus, setKeyStatus] = useState<'loading' | 'absent' | 'present'>('loading');
  const [testing, setTesting] = useState(false);

  const loadProfile = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (user) {
      setEmail(user.email ?? null);
      // Best-effort: read display_name from the public.users row
      const { data } = await supabase
        .from('users')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle();
      setDisplayName((data as { display_name: string | null } | null)?.display_name ?? null);
    }
    const key = await getAnthropicKey();
    setKeyStatus(key ? 'present' : 'absent');
  }, []);

  useEffect(() => {
    loadProfile().catch(() => {});
  }, [loadProfile]);

  useFocusEffect(
    useCallback(() => {
      loadProfile().catch(() => {});
    }, [loadProfile]),
  );

  // ---- API key management --------------------------------------------------

  const promptForKey = (existing?: string) => {
    Alert.prompt(
      existing ? 'Change API key' : 'Set Anthropic API key',
      'Paste your Anthropic API key from console.anthropic.com. It stays on this device — we never send it to our servers.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (text?: string) => {
            const trimmed = (text ?? '').trim();
            if (!trimmed) return;
            if (!trimmed.startsWith('sk-ant-')) {
              Alert.alert(
                'Invalid format',
                'Anthropic API keys start with "sk-ant-". Double-check you copied the full key.',
              );
              return;
            }
            try {
              await setAnthropicKey(trimmed);
              setKeyStatus('present');
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Cannot save key.');
            }
          },
        },
      ],
      'secure-text',
      '',
    );
  };

  const handleTestKey = async () => {
    try {
      setTesting(true);
      const key = await getAnthropicKey();
      if (!key) {
        Alert.alert('No key', 'Set an API key first.');
        return;
      }
      await testAnthropicKey(key);
      Alert.alert('Key works', 'Successfully connected to api.anthropic.com.');
    } catch (e: any) {
      Alert.alert('Key test failed', e?.message ?? 'Unknown error.');
    } finally {
      setTesting(false);
    }
  };

  const handleRemoveKey = () => {
    Alert.alert(
      'Remove API key',
      'Claude Vision identification will stop working on this device until you set a new key.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await clearAnthropicKey();
            setKeyStatus('absent');
          },
        },
      ],
    );
  };

  // ---- Sign out ------------------------------------------------------------

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          signOut().catch(() => {});
        },
      },
    ]);
  };

  // ---- Render --------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable
          hitSlop={12}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.topBarBtn, pressed && { opacity: 0.5 }]}
        >
          <Icon sf="chevron.left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle}>Profile</Text>
        <View style={styles.topBarBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Account card */}
        <Text style={styles.sectionHeader}>ACCOUNT</Text>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Icon sf="person.fill" size={24} color={colors.primary} />
          </View>
          <View style={styles.accountBody}>
            <Text style={styles.accountName} numberOfLines={1}>
              {displayName ?? email ?? 'Signed in'}
            </Text>
            {email && displayName && email !== displayName ? (
              <Text style={styles.accountEmail} numberOfLines={1}>
                {email}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Claude Vision section */}
        <Text style={styles.sectionHeader}>CLAUDE VISION</Text>
        <View style={styles.card}>
          <View style={styles.visionIntro}>
            <Icon sf="sparkles" size={20} color={colors.primary} />
            <Text style={styles.visionTitle}>AI product identification</Text>
          </View>
          <Text style={styles.visionDescription}>
            Identify products by photo when barcode lookup comes up empty. Needs your own
            Anthropic API key from console.anthropic.com — it stays on this device, not on
            our servers.
          </Text>

          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                keyStatus === 'present'
                  ? { backgroundColor: colors.success }
                  : { backgroundColor: colors.textSubtle },
              ]}
            />
            <Text style={styles.statusText}>
              {keyStatus === 'loading'
                ? 'Checking…'
                : keyStatus === 'present'
                  ? 'API key configured'
                  : 'No API key set'}
            </Text>
          </View>

          {keyStatus === 'present' ? (
            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
                onPress={() => promptForKey('exists')}
              >
                <Text style={styles.actionBtnText}>Change</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
                onPress={handleTestKey}
                disabled={testing}
              >
                {testing ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={styles.actionBtnText}>Test</Text>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.actionBtnDestructive,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={handleRemoveKey}
              >
                <Text style={styles.actionBtnDestructiveText}>Remove</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }]}
              onPress={() => promptForKey()}
            >
              <Icon sf="key.fill" size={16} color={colors.textOnPrimary} />
              <Text style={styles.primaryBtnText}>Set API key</Text>
            </Pressable>
          )}
        </View>

        {/* Sign out */}
        <Text style={styles.sectionHeader}>SESSION</Text>
        <Pressable
          style={({ pressed }) => [styles.signOutBtn, pressed && { opacity: 0.7 }]}
          onPress={handleSignOut}
        >
          <Icon sf="rectangle.portrait.and.arrow.right" size={18} color={colors.danger} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  topBarBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    ...typography.headline,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  sectionHeader: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.sm,
  },

  // Account row
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountBody: { gap: 2 },
  accountName: {
    ...typography.headline,
    color: colors.text,
  },
  accountEmail: {
    ...typography.footnote,
    color: colors.textMuted,
  },

  // Vision section
  visionIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  visionTitle: {
    ...typography.headline,
    color: colors.text,
  },
  visionDescription: {
    ...typography.footnote,
    color: colors.textMuted,
    lineHeight: 19,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    ...typography.footnote,
    color: colors.text,
    fontWeight: '600',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
  },
  primaryBtnText: {
    ...typography.bodyStrong,
    color: colors.textOnPrimary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    ...typography.footnote,
    color: colors.text,
    fontWeight: '700',
  },
  actionBtnDestructive: {
    borderColor: colors.dangerBgStrong,
    backgroundColor: colors.dangerBg,
  },
  actionBtnDestructiveText: {
    ...typography.footnote,
    color: colors.danger,
    fontWeight: '700',
  },

  // Sign out
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
  },
  signOutText: {
    ...typography.body,
    color: colors.danger,
    fontWeight: '600',
  },
});
