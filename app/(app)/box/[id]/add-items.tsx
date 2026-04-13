// ============================================================================
// Stockr – Naskladňovací batch session
// Flow: EAN scan → OFF lookup → form → queue → save all
// ============================================================================
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
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
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import {
  addItemsBatch,
  findCustomProduct,
  getMyWarehouse,
  supabase,
  upsertCustomProduct,
} from '@/src/lib/supabase';
import { lookupByBarcode } from '@/src/lib/openFoodFacts';
import {
  CATEGORIES,
  CATEGORY_EMOJI,
  EXPIRY_COLORS,
  UNITS,
  formatDateCs,
  formatExpiry,
  fromIsoDate,
  getExpiryStatus,
  toIsoDate,
} from '@/src/types/database';
import type { Category, Unit } from '@/src/types/database';
import { colors, radius, spacing, typography } from '@/src/theme';

// ---------------------------------------------------------------------------
// Queue item – local state before batch save
// ---------------------------------------------------------------------------

interface Draft {
  localId: string;
  name: string;
  quantity: number;
  unit: Unit;
  expiry_date: string; // YYYY-MM-DD, required
  barcode: string | null;
  image_url: string | null;
  category: Category | null;
}

type Mode = 'scan' | 'form' | 'queue';
type DraftSource = 'custom' | 'off' | 'manual' | null;

export default function AddItemsScreen() {
  const router = useRouter();
  const { id: boxId } = useLocalSearchParams<{ id: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>('scan');

  // Forma pro aktuálně skenovaný produkt
  const [draft, setDraft] = useState<Partial<Draft> | null>(null);
  const [draftSource, setDraftSource] = useState<DraftSource>(null);
  const [looking, setLooking] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Fronta položek čekajících na batch save
  const [queue, setQueue] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);

  // Svítilna (torch)
  const [torch, setTorch] = useState(false);

  // Toast po přidání do fronty
  const [toast, setToast] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // Debounce skeneru
  const lastBarcodeRef = useRef<string | null>(null);

  // --- Toast animace ---
  useEffect(() => {
    if (toast) {
      Animated.sequence([
        Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.delay(1500),
        Animated.timing(toastOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setToast(null);
      });
    }
  }, [toast, toastOpacity]);

  // --------------------------------------------------------------
  // Scan handler – EAN z kamery
  // --------------------------------------------------------------
  const handleScan = async (barcode: string) => {
    if (looking || mode !== 'scan' || lastBarcodeRef.current === barcode) return;
    lastBarcodeRef.current = barcode;
    setLooking(true);
    try {
      // 1. Lokální custom_products
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;
      if (!userId) throw new Error('Nejsi přihlášen.');
      const wh = await getMyWarehouse(userId);
      if (!wh) throw new Error('Chybí sklad.');

      const custom = await findCustomProduct(wh.id, barcode);
      if (custom) {
        setDraft({
          name: custom.name,
          quantity: 1,
          unit: 'ks',
          expiry_date: '',
          barcode,
          image_url: custom.image_url,
          category: custom.category,
        });
        setDraftSource('custom');
        Haptics.selectionAsync();
        setMode('form');
        return;
      }

      // 2. Open Food Facts
      const off = await lookupByBarcode(barcode);
      if (off) {
        setDraft({
          name: off.name,
          quantity: 1,
          unit: 'ks',
          expiry_date: '',
          barcode,
          image_url: off.image_url,
          category: off.category,
        });
        setDraftSource('off');
        Haptics.selectionAsync();
        setMode('form');
        return;
      }

      // 3. Fallback – ruční zadání (OFF 404)
      setDraft({
        name: '',
        quantity: 1,
        unit: 'ks',
        expiry_date: '',
        barcode,
        image_url: null,
        category: null,
      });
      setDraftSource('manual');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setMode('form');
    } catch (e: any) {
      Alert.alert('Chyba', e?.message ?? 'Nelze načíst produkt.');
      lastBarcodeRef.current = null;
    } finally {
      setLooking(false);
    }
  };

  // --------------------------------------------------------------
  // Manuální přidání – bez EAN
  // --------------------------------------------------------------
  const handleManual = () => {
    setDraft({
      name: '',
      quantity: 1,
      unit: 'ks',
      expiry_date: '',
      barcode: null,
      image_url: null,
      category: null,
    });
    setDraftSource('manual');
    setMode('form');
  };

  // --------------------------------------------------------------
  // „Stejné, jiné datum" – zachovat aktuální draft, vyčistit datum
  // --------------------------------------------------------------
  const handleSameAgain = (lastDraft: Draft) => {
    setDraft({
      ...lastDraft,
      localId: undefined,
      expiry_date: '',
    } as Partial<Draft>);
    setDraftSource(lastDraft.barcode ? 'custom' : 'manual');
    setMode('form');
  };

  // --------------------------------------------------------------
  // Přidání draftu do fronty
  // --------------------------------------------------------------
  const handleAddToQueue = async () => {
    if (!draft) return;
    const { name, quantity, unit, expiry_date } = draft;
    if (!name?.trim()) {
      Alert.alert('Chybí název', 'Zadej název produktu.');
      return;
    }
    if (!quantity || quantity <= 0) {
      Alert.alert('Chybí množství', 'Zadej kladné množství.');
      return;
    }
    if (!expiry_date || !/^\d{4}-\d{2}-\d{2}$/.test(expiry_date)) {
      Alert.alert('Chybí datum expirace', 'Vyber datum pomocí kalendáře.');
      return;
    }

    const entry: Draft = {
      localId: `${Date.now()}-${Math.random()}`,
      name: name.trim(),
      quantity,
      unit: unit ?? 'ks',
      expiry_date,
      barcode: draft.barcode ?? null,
      image_url: draft.image_url ?? null,
      category: draft.category ?? null,
    };
    setQueue((q) => [...q, entry]);

    // Pokud má barcode a custom_product to není, zapamatuj si pro příště
    if (entry.barcode) {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const userId = sess.session?.user.id;
        if (userId) {
          const wh = await getMyWarehouse(userId);
          if (wh) {
            await upsertCustomProduct({
              warehouse_id: wh.id,
              barcode: entry.barcode,
              name: entry.name,
              category: entry.category,
              image_url: entry.image_url,
              typical_expiry_days: null,
              created_by: userId,
            });
          }
        }
      } catch {
        // Non-fatal, logujeme tiše
      }
    }

    // Haptic success + toast
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setToast(entry.name);

    // Reset, zpět na scan
    setDraft(null);
    setDraftSource(null);
    setShowDatePicker(false);
    lastBarcodeRef.current = null;
    setMode('scan');
  };

  const handleRemoveFromQueue = (localId: string) => {
    setQueue((q) => q.filter((x) => x.localId !== localId));
  };

  // --------------------------------------------------------------
  // Batch save
  // --------------------------------------------------------------
  const handleSaveAll = async () => {
    if (!boxId || queue.length === 0) return;
    try {
      setSaving(true);
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;
      if (!userId) throw new Error('Nejsi přihlášen.');
      await addItemsBatch(
        boxId,
        userId,
        queue.map((d) => ({
          name: d.name,
          quantity: d.quantity,
          unit: d.unit,
          expiry_date: d.expiry_date,
          barcode: d.barcode,
          image_url: d.image_url,
          category: d.category,
        })),
      );
      router.replace(`/box/${boxId}` as any);
    } catch (e: any) {
      Alert.alert('Chyba ukládání', e?.message ?? 'Nelze uložit.');
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------------------
  // Render
  // --------------------------------------------------------------
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
        <Stack.Screen options={{ title: 'Naskladnit' }} />
        <Text style={styles.permTitle}>Potřebuju kameru</Text>
        <Text style={styles.permText}>
          Pro skenování čárových kódů produktů potřebuji přístup k fotoaparátu.
        </Text>
        <Pressable style={styles.btnPrimary} onPress={requestPermission}>
          <Text style={styles.btnPrimaryText}>Povolit kameru</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnSecondary]} onPress={handleManual}>
          <Text style={styles.btnSecondaryText}>Přidat ručně</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Naskladnit' }} />

      {mode === 'scan' && (
        <>
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torch}
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
              }}
              onBarcodeScanned={({ data }) => handleScan(data)}
            />
            {/* Torch toggle (top-right) */}
            <Pressable
              style={styles.torchBtn}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setTorch((t) => !t);
              }}
            >
              <Text style={styles.torchIcon}>{torch ? '🔦' : '💡'}</Text>
            </Pressable>

            <View style={styles.scanOverlay} pointerEvents="none">
              <View style={styles.scanFrame} />
              <Text style={styles.scanText}>
                {looking ? 'Hledám produkt…' : 'Zamiř na čárový kód'}
              </Text>
            </View>
          </View>

          <View style={styles.scanActions}>
            <Pressable style={[styles.smallBtn, styles.btnSecondary]} onPress={handleManual}>
              <Text style={styles.btnSecondaryText}>Přidat ručně</Text>
            </Pressable>
          </View>
        </>
      )}

      {mode === 'form' && draft && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
            {draft.image_url ? (
              <Image source={{ uri: draft.image_url }} style={styles.draftImage} />
            ) : (
              <View style={styles.draftImagePlaceholder}>
                <Text style={{ fontSize: 56 }}>
                  {draft.category ? CATEGORY_EMOJI[draft.category] : '📦'}
                </Text>
              </View>
            )}

            <SourceBanner source={draftSource} barcode={draft.barcode ?? null} />

            <Text style={styles.label}>Název</Text>
            <TextInput
              value={draft.name ?? ''}
              onChangeText={(v) => setDraft({ ...draft, name: v })}
              placeholder="Název produktu"
              placeholderTextColor={colors.textSubtle}
              style={styles.input}
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Množství</Text>
                <TextInput
                  value={draft.quantity?.toString() ?? ''}
                  onChangeText={(v) =>
                    setDraft({ ...draft, quantity: parseFloat(v.replace(',', '.')) || 0 })
                  }
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Jednotka</Text>
                <ChipRow
                  options={UNITS}
                  value={draft.unit ?? 'ks'}
                  onChange={(u) => u && setDraft({ ...draft, unit: u })}
                />
              </View>
            </View>

            <Text style={styles.label}>Datum expirace</Text>
            <Pressable
              style={[styles.input, styles.dateField]}
              onPress={() => setShowDatePicker((s) => !s)}
            >
              <Text style={[styles.dateText, !draft.expiry_date && styles.datePlaceholder]}>
                {draft.expiry_date ? formatDateCs(draft.expiry_date) : 'Vyber datum'}
              </Text>
              <Text style={styles.dateChevron}>{showDatePicker ? '▴' : '▾'}</Text>
            </Pressable>
            {showDatePicker && (
              <View style={styles.datePickerWrap}>
                <DateTimePicker
                  value={fromIsoDate(draft.expiry_date ?? '') ?? new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  minimumDate={new Date(2000, 0, 1)}
                  locale="cs-CZ"
                  onChange={(event: DateTimePickerEvent, selected?: Date) => {
                    // Android: close on any event. iOS inline: only update state.
                    if (Platform.OS === 'android') setShowDatePicker(false);
                    if (event.type === 'dismissed') return;
                    if (selected) {
                      setDraft({ ...draft, expiry_date: toIsoDate(selected) });
                    }
                  }}
                />
              </View>
            )}

            <Text style={styles.label}>Kategorie</Text>
            <ChipRow
              options={CATEGORIES}
              value={draft.category ?? null}
              onChange={(c) => setDraft({ ...draft, category: c })}
              renderLabel={(c) => `${CATEGORY_EMOJI[c]} ${c}`}
              allowNull
            />

            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleAddToQueue}>
              <Text style={styles.btnPrimaryText}>+ Přidat do fronty</Text>
            </Pressable>

            <Pressable
              style={[styles.btn, styles.btnSecondary]}
              onPress={() => {
                setDraft(null);
                setDraftSource(null);
                setShowDatePicker(false);
                lastBarcodeRef.current = null;
                setMode('scan');
              }}
            >
              <Text style={styles.btnSecondaryText}>Zrušit</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* Fronta – vždy pod obsahem */}
      {queue.length > 0 && mode === 'scan' && (
        <View style={styles.queueContainer}>
          <View style={styles.queueHeader}>
            <Text style={styles.queueTitle}>Fronta ({queue.length})</Text>
            <Pressable onPress={handleSaveAll} disabled={saving}>
              <Text style={[styles.saveAllText, saving && { opacity: 0.5 }]}>
                {saving ? 'Ukládám…' : 'Uložit vše'}
              </Text>
            </Pressable>
          </View>
          <FlatList
            data={queue}
            keyExtractor={(item) => item.localId}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.queueList}
            renderItem={({ item }) => (
              <QueueChip
                draft={item}
                onRemove={() => handleRemoveFromQueue(item.localId)}
                onSameAgain={() => handleSameAgain(item)}
              />
            )}
          />
        </View>
      )}

      {saving && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator color="#FFFFFF" size="large" />
          <Text style={styles.savingText}>Ukládám {queue.length} položek…</Text>
        </View>
      )}

      {/* Toast: ✓ Přidáno */}
      {toast && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]} pointerEvents="none">
          <Text style={styles.toastText} numberOfLines={1}>
            ✓ Přidáno: {toast}
          </Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// SourceBanner – J: info odkud draft pochází
// ---------------------------------------------------------------------------

function SourceBanner({
  source,
  barcode,
}: {
  source: DraftSource;
  barcode: string | null;
}) {
  if (!source) return null;
  if (source === 'custom') {
    return (
      <View style={[styles.sourceBanner, styles.sourceCustom]}>
        <Text style={[styles.sourceText, { color: colors.successText }]}>
          ✓ Dříve přidaný produkt — doplň množství a datum
        </Text>
      </View>
    );
  }
  if (source === 'off') {
    return (
      <View style={[styles.sourceBanner, styles.sourceOff]}>
        <Text style={[styles.sourceText, { color: colors.infoText }]}>
          ✓ Načteno z Open Food Facts — zkontroluj a doplň datum
        </Text>
      </View>
    );
  }
  // manual
  return (
    <View style={[styles.sourceBanner, styles.sourceManual]}>
      <Text style={[styles.sourceText, { color: colors.warningText }]}>
        {barcode
          ? `⚠️ Produkt ${barcode} není v databázi — vyplň ručně`
          : 'Ruční zadání'}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ChipRow – generic selector s emoji labels
// ---------------------------------------------------------------------------

function ChipRow<T extends string>({
  options,
  value,
  onChange,
  renderLabel,
  allowNull,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (v: T | null) => void;
  renderLabel?: (v: T) => string;
  allowNull?: boolean;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(allowNull && active ? null : opt)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {renderLabel ? renderLabel(opt) : opt}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// QueueChip – karta ve frontě
// ---------------------------------------------------------------------------

function QueueChip({
  draft,
  onRemove,
  onSameAgain,
}: {
  draft: Draft;
  onRemove: () => void;
  onSameAgain: () => void;
}) {
  const status = getExpiryStatus(draft.expiry_date);
  const palette =
    status === 'none'
      ? { bg: colors.expiryNoneBg, fg: colors.expiryNoneText }
      : EXPIRY_COLORS[status];
  return (
    <View style={styles.queueChip}>
      <Pressable onPress={onRemove} style={styles.queueRemove}>
        <Text style={styles.queueRemoveText}>×</Text>
      </Pressable>
      {draft.image_url ? (
        <Image source={{ uri: draft.image_url }} style={styles.queueImage} />
      ) : (
        <Text style={styles.queueEmoji}>
          {draft.category ? CATEGORY_EMOJI[draft.category] : '📦'}
        </Text>
      )}
      <Text numberOfLines={2} style={styles.queueName}>
        {draft.name}
      </Text>
      <Text style={styles.queueQty}>
        {Number.isInteger(draft.quantity) ? draft.quantity : draft.quantity.toFixed(1)} {draft.unit}
      </Text>
      <View style={[styles.queueBadge, { backgroundColor: palette.bg }]}>
        <Text style={[styles.queueBadgeText, { color: palette.fg }]}>
          {formatExpiry(draft.expiry_date)}
        </Text>
      </View>
      <Pressable onPress={onSameAgain} style={styles.queueAgainBtn}>
        <Text style={styles.queueAgainText}>↻ Jiné datum</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
  // Scanner
  cameraWrap: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 280,
    height: 140,
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  scanText: {
    ...typography.subhead,
    color: '#FFFFFF',
    fontWeight: '600',
    marginTop: spacing.lg,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  scanActions: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: '#000',
  },
  smallBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  // Form
  formScroll: { padding: spacing.lg, gap: spacing.xs },
  draftImage: {
    width: 120,
    height: 120,
    borderRadius: radius.md,
    alignSelf: 'center',
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    resizeMode: 'contain',
  },
  draftImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: radius.md,
    alignSelf: 'center',
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md + 2,
  },
  dateText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  datePlaceholder: { color: colors.textSubtle, fontWeight: '400' },
  dateChevron: {
    fontSize: 16,
    color: colors.textMuted,
  },
  datePickerWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', gap: spacing.md },
  btn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
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
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.footnote,
    color: colors.text,
    fontWeight: '600',
  },
  chipTextActive: { color: colors.textOnPrimary },
  // Queue
  queueContainer: {
    backgroundColor: colors.surfaceElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  queueTitle: {
    ...typography.footnote,
    color: colors.text,
    fontWeight: '700',
  },
  saveAllText: {
    ...typography.footnote,
    color: colors.primary,
    fontWeight: '700',
  },
  queueList: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  queueChip: {
    width: 140,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    alignItems: 'center',
  },
  queueRemove: {
    position: 'absolute',
    top: 2,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  queueRemoveText: { color: '#FFFFFF', fontSize: 16, lineHeight: 18 },
  queueImage: { width: 50, height: 50, borderRadius: radius.sm + 2, resizeMode: 'contain' },
  queueEmoji: { fontSize: 36, marginVertical: 4 },
  queueName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginTop: 4,
  },
  queueQty: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  queueBadge: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  queueBadgeText: { fontSize: 9, fontWeight: '700' },
  queueAgainBtn: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  queueAgainText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text,
  },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.scrim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  savingText: {
    ...typography.subhead,
    color: '#FFFFFF',
    marginTop: spacing.md,
    fontWeight: '600',
  },

  // Torch
  torchBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  torchIcon: { fontSize: 22 },

  // Toast
  toast: {
    position: 'absolute',
    top: 60,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  toastText: {
    ...typography.footnote,
    color: colors.textOnPrimary,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Source banner (J)
  sourceBanner: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  sourceCustom: {
    backgroundColor: colors.successBg,
    borderColor: colors.successBgStrong,
  },
  sourceOff: {
    backgroundColor: colors.infoBg,
    borderColor: colors.infoBg,
  },
  sourceManual: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBgStrong,
  },
  sourceText: {
    ...typography.footnote,
    fontWeight: '600',
    textAlign: 'center',
  },
});
