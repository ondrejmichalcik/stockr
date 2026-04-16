// ============================================================================
// Stockr – ItemEditSheet
// Modal-like sheet for editing an existing item. Used from box/[id].tsx.
// ============================================================================
import { useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import {
  deleteItem,
  moveItemQuantity,
  openOneItem,
  supabase,
  updateItem,
} from '@/src/lib/supabase';
import { deleteProductImage, uploadProductImage } from '@/src/lib/storage';
import { BoxPicker } from './BoxPicker';
import {
  CATEGORIES,
  UNITS,
  formatDate,
  fromIsoDate,
  toIsoDate,
} from '@/src/types/database';
import type { Category, Item, Unit } from '@/src/types/database';
import { colors, radius, shadows, spacing, typography } from '@/src/theme';
import { Icon } from '@/src/components/Icon';

export interface ItemEditSheetProps {
  item: Item;
  /** Warehouse context for image uploads (path is `{warehouseId}/...`). */
  warehouseId: string;
  onClose: () => void;
  onSaved: (updated: Item) => void;
  onDeleted: (itemId: string) => void;
  /**
   * Called after a successful "Mark one as opened" split. The returned
   * row is the opened sibling (new or updated); the source row was
   * decremented or deleted in the same transaction. Parents usually
   * just close the sheet and trust their own reload path (realtime sub
   * on box detail, manual reload on Items tab).
   */
  onOpened?: (opened: Item) => void;
  /** Called after item was moved (partially or fully) to another box.
   *  Parents should reload their item list. */
  onMoved?: () => void;
}

interface Draft {
  name: string;
  quantity: number;
  unit: Unit;
  expiry_date: string | null;
  category: Category | null;
  pack_count: number | null;
  image_url: string | null;
}

export function ItemEditSheet({
  item,
  warehouseId,
  onClose,
  onSaved,
  onDeleted,
  onOpened,
  onMoved,
}: ItemEditSheetProps) {
  const [draft, setDraft] = useState<Draft>({
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    expiry_date: item.expiry_date,
    category: item.category,
    pack_count: item.pack_count,
    image_url: item.image_url,
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showBoxPicker, setShowBoxPicker] = useState(false);
  const [quantityText, setQuantityText] = useState(
    Number.isInteger(item.quantity) ? String(item.quantity) : item.quantity.toString(),
  );
  const [packCountText, setPackCountText] = useState(
    item.pack_count != null ? String(item.pack_count) : '',
  );

  // Reset form when the item changes (user closes and opens a different one)
  useEffect(() => {
    setDraft({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      expiry_date: item.expiry_date,
      category: item.category,
      pack_count: item.pack_count,
      image_url: item.image_url,
    });
    setQuantityText(
      Number.isInteger(item.quantity) ? String(item.quantity) : item.quantity.toString(),
    );
    setPackCountText(item.pack_count != null ? String(item.pack_count) : '');
    setShowDatePicker(false);
  }, [item.id]);

  // Show the split action only for sealed items with discrete units —
  // opening "1 kg" of rice is meaningless, and opened rows can't be
  // re-opened.
  const canOpen =
    !item.opened && (item.unit === 'pcs' || item.unit === 'pack') && item.quantity >= 1;

  // ---- Image picker flow --------------------------------------------------

  const runImageUpload = async (localUri: string) => {
    try {
      setUploadingImage(true);
      const previousUrl = draft.image_url;
      const newUrl = await uploadProductImage(warehouseId, localUri);
      setDraft((d) => ({ ...d, image_url: newUrl }));
      // Fire-and-forget: remove the old one. Errors here are non-fatal.
      if (previousUrl && previousUrl !== item.image_url) {
        deleteProductImage(previousUrl).catch(() => {});
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Cannot upload image.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera access needed', 'Enable camera access in iOS Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1,
      mediaTypes: ['images'],
    });
    if (result.canceled || !result.assets[0]) return;
    await runImageUpload(result.assets[0].uri);
  };

  const handlePickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photo library access needed', 'Enable photo library access in iOS Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 1,
      mediaTypes: ['images'],
    });
    if (result.canceled || !result.assets[0]) return;
    await runImageUpload(result.assets[0].uri);
  };

  const handleRemoveImage = () => {
    const current = draft.image_url;
    if (!current) return;
    setDraft((d) => ({ ...d, image_url: null }));
    // Only delete from storage if it was a freshly uploaded one we own.
    // For images that came with the DB row (e.g. from OFF), we leave the
    // remote file alone — they may belong to another item or a CDN.
    if (current !== item.image_url) {
      deleteProductImage(current).catch(() => {});
    }
  };

  const showImagePicker = () => {
    if (uploadingImage) return;
    const hasImage = draft.image_url != null;
    const options = hasImage
      ? ['Take photo', 'Choose from library', 'Remove photo', 'Cancel']
      : ['Take photo', 'Choose from library', 'Cancel'];
    const removeIdx = hasImage ? 2 : -1;
    const cancelIdx = options.length - 1;

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        destructiveButtonIndex: removeIdx >= 0 ? removeIdx : undefined,
        cancelButtonIndex: cancelIdx,
        title: 'Item photo',
      },
      (idx) => {
        if (idx === 0) handleTakePhoto();
        else if (idx === 1) handlePickFromLibrary();
        else if (idx === removeIdx) handleRemoveImage();
      },
    );
  };

  const handleMarkOpened = () => {
    Alert.alert(
      'Mark one as opened',
      `Decrement this row's sealed count by 1 and push one unit to an opened sibling. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark opened',
          onPress: async () => {
            try {
              setSaving(true);
              const result = await openOneItem(item.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              onOpened?.(result);
              onClose();
            } catch (e: any) {
              setSaving(false);
              Alert.alert('Error', e?.message ?? 'Cannot open.');
            }
          },
        },
      ],
    );
  };

  // ---- Move to another box -------------------------------------------------

  const handleMoveToBox = async (targetBox: { id: string; name: string }) => {
    setShowBoxPicker(false);

    const doMove = async (qty: number | 'all') => {
      try {
        setSaving(true);
        const { data: sess } = await supabase.auth.getSession();
        const userId = sess.session?.user.id ?? '';
        await moveItemQuantity(item.id, qty, targetBox.id, userId);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onMoved?.();
        onClose();
      } catch (e: any) {
        setSaving(false);
        Alert.alert('Error', e?.message ?? 'Cannot move item.');
      }
    };

    if (item.quantity <= 1) {
      // Only 1 unit — move it directly
      Alert.alert(
        'Move item',
        `Move "${item.name}" to "${targetBox.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Move', onPress: () => doMove('all') },
        ],
      );
    } else {
      // Multiple units — ask how many
      Alert.alert(
        'Move how many?',
        `"${item.name}" has ${item.quantity} ${item.unit}. Move all or just some to "${targetBox.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Move all', onPress: () => doMove('all') },
          {
            text: 'Choose amount',
            onPress: () => {
              Alert.prompt(
                'How many to move?',
                `Enter quantity (1–${item.quantity - 1}):`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Move',
                    onPress: (text?: string) => {
                      const n = parseInt(text ?? '', 10);
                      if (!n || n <= 0) {
                        Alert.alert('Invalid', 'Enter a positive number.');
                        return;
                      }
                      if (n >= item.quantity) {
                        doMove('all');
                      } else {
                        doMove(n);
                      }
                    },
                  },
                ],
                'plain-text',
                '1',
                'number-pad',
              );
            },
          },
        ],
      );
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete item', `Really delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setSaving(true);
            await deleteItem(item.id);
            onDeleted(item.id);
          } catch (e: any) {
            setSaving(false);
            Alert.alert('Error', e?.message ?? 'Cannot delete.');
          }
        },
      },
    ]);
  };

  const handleSave = async () => {
    const name = draft.name.trim();
    if (!name) {
      Alert.alert('Name required', 'Enter a product name.');
      return;
    }
    const qty = parseFloat(quantityText.replace(',', '.'));
    if (!qty || qty <= 0) {
      Alert.alert('Invalid quantity', 'Enter a positive number.');
      return;
    }
    try {
      setSaving(true);
      // pack_count: parse from text, null if empty or invalid
      const trimmedPack = packCountText.trim();
      let packCount: number | null = null;
      if (trimmedPack) {
        const parsed = parseInt(trimmedPack, 10);
        if (Number.isFinite(parsed) && parsed > 0) packCount = parsed;
      }
      const updated = await updateItem(item.id, {
        name,
        quantity: qty,
        unit: draft.unit,
        expiry_date: draft.expiry_date ?? null,
        category: draft.category,
        pack_count: packCount,
        image_url: draft.image_url,
      });
      onSaved(updated);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Cannot save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={onClose} disabled={saving}>
          <Text style={[styles.headerBtn, saving && { opacity: 0.4 }]}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Edit item</Text>
        <Pressable hitSlop={12} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={[styles.headerBtn, styles.headerBtnPrimary]}>Save</Text>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={showImagePicker}
            disabled={uploadingImage || saving}
            style={({ pressed }) => [styles.imageTile, pressed && { opacity: 0.7 }]}
          >
            {draft.image_url ? (
              <Image source={{ uri: draft.image_url }} style={styles.imagePreview} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Icon sf="camera.fill" size={32} color={colors.textMuted} />
                <Text style={styles.imagePlaceholderText}>Add photo</Text>
              </View>
            )}
            {uploadingImage && (
              <View style={styles.imageOverlay}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            )}
          </Pressable>

          <Text style={styles.label}>Name</Text>
          <TextInput
            value={draft.name}
            onChangeText={(v) => setDraft({ ...draft, name: v })}
            placeholder="Product name"
            placeholderTextColor={colors.textSubtle}
            style={styles.input}
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Quantity</Text>
              <TextInput
                value={quantityText}
                onChangeText={setQuantityText}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Unit</Text>
              <ChipRow
                options={UNITS}
                value={draft.unit}
                onChange={(u) => u && setDraft({ ...draft, unit: u })}
              />
            </View>
          </View>

          <Text style={styles.label}>Pcs per package (optional)</Text>
          <TextInput
            value={packCountText}
            onChangeText={setPackCountText}
            placeholder="e.g. 24"
            placeholderTextColor={colors.textSubtle}
            keyboardType="number-pad"
            style={styles.input}
          />

          <Text style={styles.label}>Expiry date</Text>
          <View style={styles.dateRow}>
            <Pressable
              style={[styles.input, styles.dateField, { flex: 1 }]}
              onPress={() => setShowDatePicker((s) => !s)}
            >
              <Text style={[styles.dateText, !draft.expiry_date && styles.datePlaceholder]}>
                {draft.expiry_date ? formatDate(draft.expiry_date) : 'No date'}
              </Text>
              <Icon
                sf={showDatePicker ? 'chevron.up' : 'chevron.down'}
                size={14}
                color={colors.textMuted}
              />
            </Pressable>
            {draft.expiry_date && (
              <Pressable
                style={styles.dateClearBtn}
                onPress={() => {
                  setDraft({ ...draft, expiry_date: null });
                  setShowDatePicker(false);
                }}
              >
                <Text style={styles.dateClearText}>Clear</Text>
              </Pressable>
            )}
          </View>
          {showDatePicker && (
            <View style={styles.datePickerWrap}>
              <DateTimePicker
                value={fromIsoDate(draft.expiry_date ?? '') ?? new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                themeVariant="light"
                minimumDate={new Date(2000, 0, 1)}
                locale="en-GB"
                onChange={(event: DateTimePickerEvent, selected?: Date) => {
                  if (Platform.OS === 'android') setShowDatePicker(false);
                  if (event.type === 'dismissed') return;
                  if (selected) {
                    setDraft({ ...draft, expiry_date: toIsoDate(selected) });
                  }
                }}
              />
            </View>
          )}

          <Text style={styles.label}>Category</Text>
          <ChipRow
            options={CATEGORIES}
            value={draft.category}
            onChange={(c) => setDraft({ ...draft, category: c })}
            renderLabel={(c) => c}
            allowNull
          />

          {canOpen && (
            <Pressable
              style={[styles.openBtn, saving && { opacity: 0.5 }]}
              onPress={handleMarkOpened}
              disabled={saving}
            >
              <View style={styles.openBtnContent}>
                <Icon sf="shippingbox.fill" size={18} color={colors.warningText} />
                <Text style={styles.openBtnText}>Mark one as opened</Text>
              </View>
            </Pressable>
          )}

          <Pressable
            style={[styles.moveBtn, saving && { opacity: 0.5 }]}
            onPress={() => setShowBoxPicker(true)}
            disabled={saving}
          >
            <View style={styles.moveBtnContent}>
              <Icon sf="arrow.right.arrow.left" size={18} color={colors.primary} />
              <Text style={styles.moveBtnText}>Move to another box</Text>
            </View>
          </Pressable>

          <Pressable
            style={[styles.deleteBtn, saving && { opacity: 0.5 }]}
            onPress={handleDelete}
            disabled={saving}
          >
            <View style={styles.deleteBtnContent}>
              <Icon sf="trash.fill" size={18} color={colors.danger} />
              <Text style={styles.deleteBtnText}>Delete item</Text>
            </View>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Box picker for move */}
      <Modal
        visible={showBoxPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowBoxPicker(false)}
      >
        <BoxPicker
          warehouseId={warehouseId}
          excludeBoxId={item.box_id}
          onSelect={(box) => handleMoveToBox(box)}
          onClose={() => setShowBoxPicker(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// ChipRow — internal helper
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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
    >
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    ...typography.headline,
    color: colors.text,
  },
  headerBtn: {
    ...typography.callout,
    color: colors.primary,
    fontWeight: '500',
  },
  headerBtnPrimary: { fontWeight: '700' },
  scroll: { padding: spacing.lg, gap: spacing.xs },
  imageTile: {
    alignSelf: 'center',
    width: 160,
    height: 160,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
  },
  imagePlaceholderText: {
    ...typography.footnote,
    color: colors.textMuted,
    fontWeight: '600',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
    marginTop: spacing.md + 2,
    marginBottom: spacing.xs + 2,
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
  row: { flexDirection: 'row', gap: spacing.md },
  dateRow: { flexDirection: 'row', gap: spacing.sm },
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
  dateClearBtn: {
    paddingHorizontal: spacing.md + 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateClearText: {
    ...typography.footnote,
    color: colors.danger,
    fontWeight: '600',
  },
  datePickerWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
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
  openBtn: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBgStrong,
    alignItems: 'center',
  },
  openBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  openBtnText: {
    ...typography.subhead,
    color: colors.warningText,
    fontWeight: '700',
  },
  moveBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primarySubtle,
    alignItems: 'center',
  },
  moveBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  moveBtnText: {
    ...typography.subhead,
    color: colors.primary,
    fontWeight: '700',
  },
  deleteBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBgStrong,
    alignItems: 'center',
  },
  deleteBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deleteBtnText: {
    ...typography.subhead,
    color: colors.danger,
    fontWeight: '700',
  },
});
