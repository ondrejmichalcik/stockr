// ============================================================================
// Stockr – QR scanner
// Fullscreen kamera, detekce QR → getBoxByQr → navigate na detail
// ============================================================================
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { getBoxByQr } from '@/src/lib/supabase';
import { colors, radius, spacing, typography } from '@/src/theme';

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [processing, setProcessing] = useState(false);
  // Debounce: expo-camera volá onBarcodeScanned pro každý frame.
  // Držíme si poslední zpracovaný kód v ref, abychom ho znovu neotevírali.
  const lastCodeRef = useRef<string | null>(null);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const handleCode = async (code: string) => {
    if (processing || lastCodeRef.current === code) return;
    lastCodeRef.current = code;
    setProcessing(true);
    try {
      const box = await getBoxByQr(code);
      if (!box) {
        Alert.alert('Neznámý QR kód', 'Tato bedna není v tvém skladu.', [
          {
            text: 'OK',
            onPress: () => {
              lastCodeRef.current = null;
              setProcessing(false);
            },
          },
        ]);
        return;
      }
      router.replace(`/box/${box.id}` as any);
    } catch (e: any) {
      Alert.alert('Chyba', e?.message ?? 'Nelze načíst bednu.', [
        {
          text: 'OK',
          onPress: () => {
            lastCodeRef.current = null;
            setProcessing(false);
          },
        },
      ]);
    }
  };

  // ---- Permission states ----
  if (!permission) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.hint}>Připravuji kameru…</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Stack.Screen options={{ title: 'Skenovat QR' }} />
        <Text style={styles.permTitle}>Potřebuju kameru</Text>
        <Text style={styles.permText}>
          Stockr potřebuje přístup k fotoaparátu pro skenování QR kódů beden.
        </Text>
        <Pressable style={styles.btnPrimary} onPress={requestPermission}>
          <Text style={styles.btnPrimaryText}>Povolit kameru</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Skenovat QR', headerTransparent: true, headerTintColor: '#fff' }} />
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => handleCode(data)}
      />
      {/* Overlay s hledáčkem */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.frame} />
        <Text style={styles.overlayText}>
          {processing ? 'Načítám bednu…' : 'Zamiř na QR kód bedny'}
        </Text>
      </View>

      <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
        <Pressable style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Zrušit</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  hint: {
    ...typography.subhead,
    color: colors.textMuted,
  },
  permTitle: {
    ...typography.title2,
    color: colors.text,
    marginBottom: spacing.md,
  },
  permText: {
    ...typography.subhead,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
  },
  btnPrimaryText: {
    ...typography.bodyStrong,
    color: colors.textOnPrimary,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frame: {
    width: 260,
    height: 260,
    borderRadius: radius.xxl,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  overlayText: {
    ...typography.callout,
    color: '#FFFFFF',
    fontWeight: '600',
    marginTop: spacing.xl,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  cancelBtn: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radius.xxl,
    marginBottom: spacing.lg,
  },
  cancelText: {
    ...typography.callout,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
