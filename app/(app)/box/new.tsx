// ============================================================================
// Stockr – Vytvoření nové bedny
// Formulář → createBox → zobrazí QR náhled k tisku
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
import { Stack, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { createBox, getMyWarehouse, supabase } from '@/src/lib/supabase';
import type { Box } from '@/src/types/database';
import { colors, radius, spacing, typography } from '@/src/theme';

export default function NewBoxScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [createdBox, setCreatedBox] = useState<Box | null>(null);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Chybí název', 'Pojmenuj bednu, např. „Léky A" nebo „Voda sklep".');
      return;
    }
    try {
      setSaving(true);
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;
      if (!userId) throw new Error('Nejsi přihlášen.');
      const wh = await getMyWarehouse(userId);
      if (!wh) throw new Error('Chybí sklad.');
      const box = await createBox({
        warehouse_id: wh.id,
        name: trimmed,
        location: location.trim() || null,
      });
      setCreatedBox(box);
    } catch (e: any) {
      Alert.alert('Chyba', e?.message ?? 'Nelze uložit.');
    } finally {
      setSaving(false);
    }
  };

  // ---- Post-create: QR náhled ----
  if (createdBox) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Stack.Screen options={{ title: 'QR štítek' }} />
        <ScrollView contentContainerStyle={styles.qrScroll}>
          <Text style={styles.qrTitle}>{createdBox.name}</Text>
          {createdBox.location ? (
            <Text style={styles.qrLocation}>📍 {createdBox.location}</Text>
          ) : null}

          <View style={styles.qrWrap}>
            <QRCode value={createdBox.qr_code} size={220} backgroundColor="#FFFFFF" />
          </View>

          <Text style={styles.qrCodeText}>{createdBox.qr_code}</Text>

          <View style={styles.qrHint}>
            <Text style={styles.qrHintText}>
              Přilep tento QR kód na bednu. Po naskenování v appce se otevře detail.
            </Text>
          </View>

          {/* Tisk přes Niimbot B21 přidáme v Sprintu 3 */}
          <Pressable style={[styles.btn, styles.btnDisabled]} disabled>
            <Text style={styles.btnDisabledText}>🖨 Tisknout (Sprint 3)</Text>
          </Pressable>

          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => router.replace(`/box/${createdBox.id}` as any)}
          >
            <Text style={styles.btnPrimaryText}>Přejít na detail</Text>
          </Pressable>

          <Pressable
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.btnSecondaryText}>Zpět na dashboard</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---- Pre-create: formulář ----
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Nová bedna' }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Název bedny</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Léky A"
            placeholderTextColor={colors.textSubtle}
            style={styles.input}
            autoFocus
            returnKeyType="next"
          />

          <Text style={styles.label}>Umístění (volitelné)</Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="Police 2, řada 1"
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
              <Text style={styles.btnPrimaryText}>Vytvořit bednu</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
  qrLocation: {
    ...typography.footnote,
    color: colors.textMuted,
    marginTop: spacing.xs,
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
