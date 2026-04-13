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
            <QRCode value={createdBox.qr_code} size={220} backgroundColor="#fff" />
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
            placeholderTextColor="#B0B0B0"
            style={styles.input}
            autoFocus
            returnKeyType="next"
          />

          <Text style={styles.label}>Umístění (volitelné)</Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="Police 2, řada 1"
            placeholderTextColor="#B0B0B0"
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
              <ActivityIndicator color="#fff" />
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
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  formScroll: { padding: 16, gap: 4 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111',
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  btn: {
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: '#111' },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnSecondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E0E0' },
  btnSecondaryText: { color: '#111', fontWeight: '600', fontSize: 16 },
  btnDisabled: { backgroundColor: '#F0F0F0' },
  btnDisabledText: { color: '#999', fontWeight: '600', fontSize: 16 },
  btnLoading: { opacity: 0.7 },
  // QR preview
  qrScroll: { padding: 24, alignItems: 'center' },
  qrTitle: { fontSize: 24, fontWeight: '800', color: '#111', marginTop: 8 },
  qrLocation: { fontSize: 14, color: '#666', marginTop: 4 },
  qrWrap: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  qrCodeText: {
    marginTop: 16,
    fontSize: 11,
    color: '#999',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  qrHint: {
    backgroundColor: '#EAF3DE',
    borderRadius: 10,
    padding: 12,
    marginTop: 20,
    alignSelf: 'stretch',
  },
  qrHintText: { color: '#27500A', fontSize: 13, textAlign: 'center' },
});
