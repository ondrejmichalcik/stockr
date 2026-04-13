// ============================================================================
// Stockr – Box detail
// List layout with swipe-to-delete, realtime subscription, "Add items" FAB
// ============================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import QRCode from 'react-native-qrcode-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { ItemEditSheet } from '@/src/components/ItemEditSheet';
import { BoxEditSheet } from '@/src/components/BoxEditSheet';
import { ScreenBackground } from '@/src/components/ScreenBackground';
import { Icon, type IconName } from '@/src/components/Icon';

type ViewMode = 'list' | 'grid';
const VIEW_MODE_KEY = 'stockr:boxViewMode';
import {
  deleteBox,
  deleteItem,
  getBoxById,
  listItems,
  subscribeItems,
} from '@/src/lib/supabase';
import type { Box, Item } from '@/src/types/database';
import {
  CATEGORY_ICON,
  EXPIRY_COLORS,
  formatExpiry,
  getExpiryStatus,
} from '@/src/types/database';
import { colors, radius, spacing, typography } from '@/src/theme';

export default function BoxDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [box, setBox] = useState<Box | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showLabel, setShowLabel] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [error, setError] = useState<string | null>(null);

  // Načti uloženou preferenci view mode (globálně pro všechny bedny)
  useEffect(() => {
    AsyncStorage.getItem(VIEW_MODE_KEY).then((v) => {
      if (v === 'list' || v === 'grid') setViewMode(v);
    });
  }, []);

  const toggleViewMode = () => {
    const next: ViewMode = viewMode === 'list' ? 'grid' : 'list';
    setViewMode(next);
    AsyncStorage.setItem(VIEW_MODE_KEY, next).catch(() => {});
  };

  // Reference na otevřený Swipeable – abychom ho mohli zavřít při interakci jinde
  const openSwipeableRef = useRef<Swipeable | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const [b, is] = await Promise.all([getBoxById(id), listItems(id)]);
      setBox(b);
      setItems(is);
    } catch (e: any) {
      setError(e?.message ?? 'Cannot load box.');
      throw e;
    }
  }, [id]);

  const retry = async () => {
    setLoading(true);
    try {
      await load();
    } catch {
      // chyba je v state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  // Refresh při návratu na screen (např. po save z add-items session)
  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [load]),
  );

  // Realtime (vyžaduje enabled replication v Supabase)
  useEffect(() => {
    if (!id) return;
    const unsubscribe = subscribeItems(id, () => {
      load().catch(() => {});
    });
    return unsubscribe;
  }, [id, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch {
      // chyba je v state
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeleteBox = () => {
    if (!box) return;
    Alert.alert(
      'Delete box',
      `Really delete "${box.name}"? All items in this box will be deleted with it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBox(box.id);
              router.replace('/');
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Cannot delete.');
            }
          },
        },
      ],
    );
  };

  const showBoxActionSheet = () => {
    const options = ['Show QR label', 'Edit box', 'Delete box', 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        destructiveButtonIndex: 2,
        cancelButtonIndex: 3,
        title: box?.name ?? undefined,
      },
      (idx) => {
        if (idx === 0) setShowLabel(true);
        else if (idx === 1) setShowEdit(true);
        else if (idx === 2) handleDeleteBox();
      },
    );
  };

  const confirmDelete = (item: Item, close: () => void) => {
    Alert.alert('Delete item', `Really delete "${item.name}"?`, [
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: close,
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          close();
          try {
            await deleteItem(item.id);
            // The realtime sub will refresh eventually, but for snappy UX
            // we also remove it locally.
            setItems((prev) => prev.filter((x) => x.id !== item.id));
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Cannot delete.');
          }
        },
      },
    ]);
  };

  const nearest = useMemo(() => box?.nearest_expiry ?? null, [box]);
  const nearestStatus = getExpiryStatus(nearest);
  const nearestPalette =
    nearestStatus === 'none'
      ? { bg: colors.expiryNoneBg, fg: colors.expiryNoneText }
      : EXPIRY_COLORS[nearestStatus];

  if (loading) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  if (error && !box) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.center}>
          <Icon name="warning" size={96} style={styles.errorIcon} />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={[styles.btn, styles.btnPrimary, styles.retryBtn]} onPress={retry}>
            <View style={styles.btnContent}>
              <Icon name="retry" size={18} />
              <Text style={styles.btnPrimaryText}>Try again</Text>
            </View>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnSecondary, styles.retryBtn]}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.btnSecondaryText}>Back to dashboard</Text>
          </Pressable>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  if (!box) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.center}>
          <Text style={styles.errorTitle}>Box not found</Text>
          <Pressable style={[styles.btn, styles.btnPrimary, styles.retryBtn]} onPress={() => router.replace('/')}>
            <Text style={styles.btnPrimaryText}>Back to dashboard</Text>
          </Pressable>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Top nav bar */}
        <View style={styles.topBar}>
          <Pressable
            hitSlop={12}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.topBarBtn, pressed && { opacity: 0.5 }]}
          >
            <Icon name="chevron-left" size={28} />
          </Pressable>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {box.name}
          </Text>
          <Pressable
            hitSlop={12}
            onPress={showBoxActionSheet}
            style={({ pressed }) => [styles.topBarBtn, pressed && { opacity: 0.5 }]}
          >
            <Icon name="more" size={24} />
          </Pressable>
        </View>

        {/* Header */}
        <View style={styles.header}>
        {box.location ? (
          <View style={styles.locationRow}>
            <Icon name="pin" size={14} />
            <Text style={styles.location}>{box.location}</Text>
          </View>
        ) : null}
        <View style={styles.headerRow}>
          <Text style={styles.count}>
            {box.item_count} {box.item_count === 1 ? 'item' : 'items'}
          </Text>
          <View style={[styles.badge, { backgroundColor: nearestPalette.bg }]}>
            <Text style={[styles.badgeText, { color: nearestPalette.fg }]}>
              {formatExpiry(nearest)}
            </Text>
          </View>
        </View>

        {/* View mode toggle */}
        <View style={styles.segmented}>
          <Pressable
            onPress={viewMode === 'grid' ? toggleViewMode : undefined}
            style={[styles.segment, viewMode === 'list' && styles.segmentActive]}
          >
            <View style={styles.segmentContent}>
              <Icon name="list" size={14} />
              <Text style={[styles.segmentText, viewMode === 'list' && styles.segmentTextActive]}>
                List
              </Text>
            </View>
          </Pressable>
          <Pressable
            onPress={viewMode === 'list' ? toggleViewMode : undefined}
            style={[styles.segment, viewMode === 'grid' && styles.segmentActive]}
          >
            <View style={styles.segmentContent}>
              <Icon name="grid" size={14} />
              <Text style={[styles.segmentText, viewMode === 'grid' && styles.segmentTextActive]}>
                Grid
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      <FlatList
        // key musí switchnout mezi módy, jinak FlatList crashne na změnu numColumns
        key={viewMode}
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={viewMode === 'grid' ? 3 : 1}
        contentContainerStyle={viewMode === 'grid' ? styles.gridContent : styles.listContent}
        columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
        ItemSeparatorComponent={
          viewMode === 'list' ? () => <View style={styles.separator} /> : undefined
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textMuted}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="inbox" size={96} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>Box is empty</Text>
            <Text style={styles.emptyText}>Add your first items.</Text>
          </View>
        }
        renderItem={({ item }) =>
          viewMode === 'list' ? (
            <SwipeableRow
              item={item}
              onPress={() => setEditingItem(item)}
              onDelete={(close) => confirmDelete(item, close)}
              registerOpen={(ref) => {
                if (openSwipeableRef.current && openSwipeableRef.current !== ref) {
                  openSwipeableRef.current.close();
                }
                openSwipeableRef.current = ref;
              }}
            />
          ) : (
            <GridCard item={item} onPress={() => setEditingItem(item)} />
          )
        }
      />

      <View style={styles.actions}>
        <Pressable
          style={[styles.btn, styles.btnPrimary]}
          onPress={() => router.push(`/box/${box.id}/add-items` as any)}
        >
          <View style={styles.btnContent}>
            <Icon name="plus" size={18} />
            <Text style={styles.btnPrimaryText}>Add items</Text>
          </View>
        </Pressable>
      </View>

      {/* QR label modal */}
      <Modal
        visible={showLabel}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLabel(false)}
      >
        <LabelModalContent box={box} onClose={() => setShowLabel(false)} />
      </Modal>

      {/* Edit box modal */}
      <Modal
        visible={showEdit}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEdit(false)}
      >
        <BoxEditSheet
          box={box}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => {
            setBox(updated);
            setShowEdit(false);
          }}
        />
      </Modal>

      {/* Edit item modal */}
      <Modal
        visible={!!editingItem}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditingItem(null)}
      >
        {editingItem && (
          <ItemEditSheet
            item={editingItem}
            onClose={() => setEditingItem(null)}
            onSaved={(updated) => {
              setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
              setEditingItem(null);
            }}
            onDeleted={(itemId) => {
              setItems((prev) => prev.filter((x) => x.id !== itemId));
              setEditingItem(null);
            }}
          />
        )}
      </Modal>
      </SafeAreaView>
    </ScreenBackground>
  );
}

// ---------------------------------------------------------------------------
// LabelModalContent
// ---------------------------------------------------------------------------

function LabelModalContent({ box, onClose }: { box: Box; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(box.qr_code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Noop — clipboard failures are non-critical
    }
  };

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
        <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>QR label</Text>
        <Pressable hitSlop={12} onPress={onClose}>
          <Text style={styles.modalClose}>Close</Text>
        </Pressable>
      </View>

      <View style={styles.modalBody}>
        <Text style={styles.labelBoxName}>{box.name}</Text>
        {box.location ? (
          <View style={styles.locationRow}>
            <Icon name="pin" size={14} />
            <Text style={styles.labelLocation}>{box.location}</Text>
          </View>
        ) : null}

        <View style={styles.labelQrWrap}>
          <QRCode value={box.qr_code} size={220} backgroundColor="#FFFFFF" />
        </View>

        <Pressable
          onPress={handleCopy}
          style={({ pressed }) => [styles.labelCodeWrap, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.labelCode} numberOfLines={1}>
            {box.qr_code}
          </Text>
          <View style={styles.labelCopyRow}>
            <Icon name={copied ? 'check' : 'copy'} size={14} />
            <Text style={[styles.labelCopyHint, copied && styles.labelCopyHintActive]}>
              {copied ? 'Copied' : 'Copy'}
            </Text>
          </View>
        </Pressable>

        <View style={styles.labelHint}>
          <Text style={styles.labelHintText}>
            This QR stays the same for the box's entire lifetime. Stick it on the outside —
            scanning it opens the box detail instantly.
          </Text>
        </View>

        <Pressable style={[styles.btn, styles.btnDisabled]} disabled>
          <View style={styles.btnContent}>
            <Icon name="printer" size={18} />
            <Text style={styles.btnDisabledText}>Print (Sprint 3)</Text>
          </View>
        </Pressable>
      </View>
      </SafeAreaView>
    </ScreenBackground>
  );
}

// ---------------------------------------------------------------------------
// SwipeableRow
// ---------------------------------------------------------------------------

function SwipeableRow({
  item,
  onPress,
  onDelete,
  registerOpen,
}: {
  item: Item;
  onPress: () => void;
  onDelete: (close: () => void) => void;
  registerOpen: (ref: Swipeable | null) => void;
}) {
  const status = getExpiryStatus(item.expiry_date);
  const palette = status === 'none'
      ? { bg: colors.expiryNoneBg, fg: colors.expiryNoneText }
      : EXPIRY_COLORS[status];
  const iconName = (item.category ? CATEGORY_ICON[item.category] : 'box-generic') as IconName;
  const swipeRef = useRef<Swipeable>(null);

  const renderRightActions = () => (
    <Pressable
      style={styles.deleteAction}
      onPress={() => onDelete(() => swipeRef.current?.close())}
    >
      <Text style={styles.deleteActionText}>Smazat</Text>
    </Pressable>
  );

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
      onSwipeableWillOpen={() => registerOpen(swipeRef.current)}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <View style={styles.rowImageWrap}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.rowImage} />
          ) : (
            <Icon name={iconName} size={38} />
          )}
        </View>
        <View style={styles.rowBody}>
          <Text numberOfLines={2} style={styles.rowName}>
            {item.name}
          </Text>
          <Text style={styles.rowQty}>{formatQuantity(item.quantity, item.unit)}</Text>
        </View>
        {item.expiry_date ? (
          <View style={[styles.rowBadge, { backgroundColor: palette.bg }]}>
            <Text style={[styles.rowBadgeText, { color: palette.fg }]} numberOfLines={1}>
              {formatExpiry(item.expiry_date)}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </Swipeable>
  );
}

function formatQuantity(qty: number, unit: string): string {
  const n = Number.isInteger(qty) ? qty.toString() : qty.toFixed(1);
  return `${n} ${unit}`;
}

function formatShortExpiry(dateStr: string): string {
  // "2027-03-15" → "03/27"
  const [y, m] = dateStr.split('-');
  return `${m}/${y.slice(2)}`;
}

// ---------------------------------------------------------------------------
// GridCard – tap otevře edit (mazání přes edit sheet)
// ---------------------------------------------------------------------------

function GridCard({ item, onPress }: { item: Item; onPress: () => void }) {
  const status = getExpiryStatus(item.expiry_date);
  const palette = status === 'none'
      ? { bg: colors.expiryNoneBg, fg: colors.expiryNoneText }
      : EXPIRY_COLORS[status];
  const iconName = (item.category ? CATEGORY_ICON[item.category] : 'box-generic') as IconName;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.cardImageWrap}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.cardImage} />
        ) : (
          <Icon name={iconName} size={56} />
        )}
      </View>
      <Text numberOfLines={2} style={styles.cardName}>
        {item.name}
      </Text>
      <Text style={styles.cardQty}>{formatQuantity(item.quantity, item.unit)}</Text>
      {item.expiry_date && (
        <View style={[styles.cardBadge, { backgroundColor: palette.bg }]}>
          <Text style={[styles.cardBadgeText, { color: palette.fg }]} numberOfLines={1}>
            {formatShortExpiry(item.expiry_date)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  center: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorIcon: { marginBottom: spacing.lg },
  errorTitle: {
    ...typography.title3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.subhead,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  retryBtn: { alignSelf: 'stretch', marginTop: spacing.sm },
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: 'transparent',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs + 2,
  },
  location: {
    ...typography.footnote,
    color: colors.textMuted,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  count: {
    ...typography.subhead,
    color: colors.text,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '600',
  },

  // Segmented control
  segmented: {
    flexDirection: 'row',
    marginTop: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: radius.md,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm + 2,
    alignItems: 'center',
  },
  segmentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  segmentActive: {
    backgroundColor: colors.surfaceElevated,
  },
  segmentText: {
    ...typography.footnote,
    color: colors.textMuted,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.text,
    fontWeight: '700',
  },

  // List rows
  listContent: { paddingBottom: spacing.xl },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 80,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  rowPressed: { backgroundColor: colors.surfaceElevated },
  rowImageWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  rowImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  rowBody: { flex: 1 },
  rowName: {
    ...typography.subhead,
    color: colors.text,
    fontWeight: '600',
  },
  rowQty: {
    ...typography.footnote,
    color: colors.textMuted,
    marginTop: 2,
  },
  rowBadge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.full,
    maxWidth: 120,
  },
  rowBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Grid
  gridContent: { padding: spacing.sm, paddingBottom: spacing.xl },
  gridRow: { gap: spacing.sm },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    alignItems: 'center',
    minHeight: 150,
  },
  cardImageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.sm + 2,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    overflow: 'hidden',
  },
  cardImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  cardName: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  cardQty: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  cardBadge: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  cardBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Swipe delete action
  deleteAction: {
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
  },
  deleteActionText: {
    ...typography.subhead,
    color: colors.textOnDanger,
    fontWeight: '700',
  },

  // Empty
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: spacing.xxl },
  emptyIcon: { marginBottom: spacing.lg },
  emptyTitle: {
    ...typography.title3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.subhead,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // Actions
  actions: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  btn: {
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
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
  btnDisabled: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    opacity: 0.6,
  },
  btnDisabledText: {
    ...typography.body,
    color: colors.textSubtle,
    fontWeight: '600',
  },

  // Header button
  headerBtn: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
  headerBtnText: {
    ...typography.subhead,
    color: colors.primary,
    fontWeight: '600',
  },
  headerBtnMore: {
    fontSize: 26,
    color: colors.primary,
    fontWeight: '700',
    lineHeight: 26,
  },

  // Label modal
  modalContainer: { flex: 1, backgroundColor: 'transparent' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: 'transparent',
  },
  modalTitle: {
    ...typography.headline,
    color: colors.text,
  },
  modalClose: {
    ...typography.callout,
    color: colors.primary,
    fontWeight: '600',
  },
  modalBody: { flex: 1, padding: spacing.xl, alignItems: 'center' },
  labelBoxName: {
    ...typography.title1,
    color: colors.text,
    marginTop: spacing.sm,
  },
  labelLocation: {
    ...typography.footnote,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  labelQrWrap: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  labelCodeWrap: {
    marginTop: spacing.lg,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm + 2,
  },
  labelCode: {
    fontSize: 11,
    color: colors.textSubtle,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    maxWidth: 280,
  },
  labelCopyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 6,
  },
  labelCopyHint: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  labelCopyHintActive: { color: colors.successText },
  labelHint: {
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBgStrong,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xl,
    alignSelf: 'stretch',
  },
  labelHintText: {
    ...typography.footnote,
    color: colors.successText,
    textAlign: 'center',
    lineHeight: 18,
  },
});
