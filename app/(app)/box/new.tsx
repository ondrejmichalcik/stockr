// ============================================================================
// Stockr – Create new box
// Form → createBox → shows a QR label preview ready to print
// ============================================================================
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { createBox, getMyWarehouse, supabase } from '@/src/lib/supabase';
import type { Box } from '@/src/types/database';
import { colors, radius, spacing, typography } from '@/src/theme';
import { ScreenBackground } from '@/src/components/ScreenBackground';
import { Icon } from '@/src/components/Icon';

export default function NewBoxScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [createdBox, setCreatedBox] = useState<Box | null>(null);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Give the box a name, e.g. "Meds A" or "Water cellar".');
      return;
    }
    try {
      setSaving(true);
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;
      if (!userId) throw new Error('Not signed in.');
      const wh = await getMyWarehouse(userId);
      if (!wh) throw new Error('No warehouse.');
      const box = await createBox({
        warehouse_id: wh.id,
        name: trimmed,
        location: location.trim() || null,
      });
      setCreatedBox(box);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Cannot save.');
    } finally {
      setSaving(false);
    }
  };

  // ---- Post-create: QR preview ----
  if (createdBox) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.topBar}>
            <Pressable
              hitSlop={12}
              onPress={() => router.replace('/')}
              style={({ pressed }) => [styles.topBarBtn, pressed && { opacity: 0.5 }]}
            >
              <Icon name="chevron-left" size={28} />
            </Pressable>
            <Text style={styles.topBarTitle}>QR label</Text>
            <View style={styles.topBarBtn} />
          </View>
          <ScrollView contentContainerStyle={styles.qrScroll}>
          <Text style={styles.qrTitle}>{createdBox.name}</Text>
          {createdBox.location ? (
            <View style={styles.qrLocationRow}>
              <Icon name="pin" size={14} />
              <Text style={styles.qrLocation}>{createdBox.location}</Text>
            </View>
          ) : null}

          <View style={styles.qrWrap}>
            <QRCode value={createdBox.qr_code} size={220} backgroundColor="#FFFFFF" />
          </View>

          <Text style={styles.qrCodeText}>{createdBox.qr_code}</Text>

          <View style={styles.qrHint}>
            <Text style={styles.qrHintText}>
              Stick this QR code on the box. Scanning it in the app opens its detail.
            </Text>
          </View>

          {/* Printing support lands in Sprint 3 */}
          <Pressable style={[styles.btn, styles.btnDisabled]} disabled>
            <View style={styles.btnContent}>
              <Icon name="printer" size={18} />
              <Text style={styles.btnDisabledText}>Print (Sprint 3)</Text>
            </View>
          </Pressable>

          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => router.replace(`/box/${createdBox.id}` as any)}
          >
            <Text style={styles.btnPrimaryText}>Open box detail</Text>
          </Pressable>

          <Pressable
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.btnSecondaryText}>Back to dashboard</Text>
          </Pressable>
          </ScrollView>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  // ---- Pre-create: form ----
  return (
    <ScreenBackground>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable
            hitSlop={12}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.topBarBtn, pressed && { opacity: 0.5 }]}
          >
            <Icon name="chevron-left" size={28} />
          </Pressable>
          <Text style={styles.topBarTitle}>New box</Text>
          <View style={styles.topBarBtn} />
        </View>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Box name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Meds A"
            placeholderTextColor={colors.textSubtle}
            style={styles.input}
            autoFocus
            returnKeyType="next"
          />

          <Text style={styles.label}>Location (optional)</Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="Shelf 2, row 1"
            placeholderTextColor={colors.textSubtle}
            style={styles.input}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <Pressable
            style={[styles.btn, styles.btnPrimary, saving && styles.btnLoading]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text style={styles.btnPrimaryText}>Create box</Text>
            )}
          </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
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
  formScroll: { padding: spacing.lg, gap: spacing.xs },
  label: {
    ...typography.label,
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.xs + 2,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: {
    ...typography.bodyStrong,
    color: colors.textOnPrimary,
  },
  btnSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnSecondaryText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  btnDisabled: { backgroundColor: colors.surface, opacity: 0.5 },
  btnDisabledText: {
    ...typography.body,
    color: colors.textSubtle,
    fontWeight: '600',
  },
  btnLoading: { opacity: 0.7 },
  // QR preview
  qrScroll: { padding: spacing.xl, alignItems: 'center' },
  qrTitle: {
    ...typography.title1,
    color: colors.text,
    marginTop: spacing.sm,
  },
  qrLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  qrLocation: {
    ...typography.footnote,
    color: colors.textMuted,
  },
  qrWrap: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  qrCodeText: {
    marginTop: spacing.lg,
    fontSize: 11,
    color: colors.textSubtle,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  qrHint: {
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBgStrong,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xl,
    alignSelf: 'stretch',
  },
  qrHintText: {
    ...typography.footnote,
    color: colors.successText,
    textAlign: 'center',
  },
});
