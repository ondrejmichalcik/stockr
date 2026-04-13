// ============================================================================
// Stockr – Detail bedny
// List layout se swipe-to-delete, realtime subscription, FAB +Naskladnit
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
  CATEGORY_EMOJI,
  EXPIRY_COLORS,
  formatExpiry,
  getExpiryStatus,
} from '@/src/types/database';

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
      setError(e?.message ?? 'Nelze načíst bednu.');
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
      'Smazat bednu',
      `Opravdu smazat „${box.name}"? Všechny položky v této bedně se smažou spolu s ní.`,
      [
        { text: 'Zrušit', style: 'cancel' },
        {
          text: 'Smazat',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBox(box.id);
              router.replace('/');
            } catch (e: any) {
              Alert.alert('Chyba', e?.message ?? 'Nelze smazat.');
            }
          },
        },
      ],
    );
  };

  const showBoxActionSheet = () => {
    const options = ['🏷 Zobrazit QR štítek', '✏️ Upravit bednu', '🗑 Smazat bednu', 'Zrušit'];
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
    Alert.alert('Smazat položku', `Opravdu smazat „${item.name}"?`, [
      {
        text: 'Zrušit',
        style: 'cancel',
        onPress: close,
      },
      {
        text: 'Smazat',
        style: 'destructive',
        onPress: async () => {
          close();
          try {
            await deleteItem(item.id);
            // Realtime sub refreshne listu, ale pro responzivní UX ji refreshnem lokálně
            setItems((prev) => prev.filter((x) => x.id !== item.id));
          } catch (e: any) {
            Alert.alert('Chyba', e?.message ?? 'Nelze smazat.');
          }
        },
      },
    ]);
  };

  const nearest = useMemo(() => box?.nearest_expiry ?? null, [box]);
  const nearestStatus = getExpiryStatus(nearest);
  const nearestPalette =
    nearestStatus === 'none' ? { bg: '#EFEFEF', fg: '#666' } : EXPIRY_COLORS[nearestStatus];

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (error && !box) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={styles.errorTitle}>Něco se pokazilo</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={[styles.btn, styles.btnPrimary, styles.retryBtn]} onPress={retry}>
          <Text style={styles.btnPrimaryText}>Zkusit znovu</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnSecondary, styles.retryBtn]}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.btnSecondaryText}>Zpět na dashboard</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!box) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorTitle}>Bedna nenalezena</Text>
        <Pressable style={[styles.btn, styles.btnPrimary, styles.retryBtn]} onPress={() => router.replace('/')}>
          <Text style={styles.btnPrimaryText}>Zpět na dashboard</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: box.name,
          headerRight: () => (
            <Pressable
              hitSlop={12}
              onPress={showBoxActionSheet}
              style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.5 }]}
            >
              <Text style={styles.headerBtnMore}>⋯</Text>
            </Pressable>
          ),
        }}
      />

      {/* Header */}
      <View style={styles.header}>
        {box.location ? <Text style={styles.location}>📍 {box.location}</Text> : null}
        <View style={styles.headerRow}>
          <Text style={styles.count}>
            {box.item_count} {box.item_count === 1 ? 'položka' : box.item_count < 5 ? 'položky' : 'položek'}
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
            <Text style={[styles.segmentText, viewMode === 'list' && styles.segmentTextActive]}>
              ☰ Seznam
            </Text>
          </Pressable>
          <Pressable
            onPress={viewMode === 'list' ? toggleViewMode : undefined}
            style={[styles.segment, viewMode === 'grid' && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, viewMode === 'grid' && styles.segmentTextActive]}>
              ▦ Mřížka
            </Text>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📥</Text>
            <Text style={styles.emptyTitle}>Bedna je prázdná</Text>
            <Text style={styles.emptyText}>Naskladni první položky.</Text>
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
          <Text style={styles.btnPrimaryText}>+ Naskladnit</Text>
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
      // Noop – Clipboard selhání je nekritické
    }
  };

  return (
    <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>QR štítek</Text>
        <Pressable hitSlop={12} onPress={onClose}>
          <Text style={styles.modalClose}>Zavřít</Text>
        </Pressable>
      </View>

      <View style={styles.modalBody}>
        <Text style={styles.labelBoxName}>{box.name}</Text>
        {box.location ? <Text style={styles.labelLocation}>📍 {box.location}</Text> : null}

        <View style={styles.labelQrWrap}>
          <QRCode value={box.qr_code} size={220} backgroundColor="#fff" />
        </View>

        <Pressable
          onPress={handleCopy}
          style={({ pressed }) => [styles.labelCodeWrap, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.labelCode} numberOfLines={1}>
            {box.qr_code}
          </Text>
          <Text style={[styles.labelCopyHint, copied && styles.labelCopyHintActive]}>
            {copied ? '✓ Zkopírováno' : '📋 Kopírovat'}
          </Text>
        </Pressable>

        <View style={styles.labelHint}>
          <Text style={styles.labelHintText}>
            Tento QR zůstává stejný po celou dobu existence bedny. Přilep ho zvenku a při skenování appka
            okamžitě otevře detail.
          </Text>
        </View>

        <Pressable style={[styles.btn, styles.btnDisabled]} disabled>
          <Text style={styles.btnDisabledText}>🖨 Tisknout na Niimbot (Sprint 3)</Text>
        </Pressable>
      </View>
    </SafeAreaView>
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
  const palette = status === 'none' ? { bg: '#EFEFEF', fg: '#666' } : EXPIRY_COLORS[status];
  const emoji = item.category ? CATEGORY_EMOJI[item.category] : '📦';
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
            <Text style={styles.rowEmoji}>{emoji}</Text>
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
  const palette = status === 'none' ? { bg: '#EFEFEF', fg: '#666' } : EXPIRY_COLORS[status];
  const emoji = item.category ? CATEGORY_EMOJI[item.category] : '📦';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.cardImageWrap}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.cardImage} />
        ) : (
          <Text style={styles.cardEmoji}>{emoji}</Text>
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
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  center: {
    flex: 1,
    backgroundColor: '#F5F5F7',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorEmoji: { fontSize: 56, marginBottom: 16 },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 8 },
  errorText: { color: '#666', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  retryBtn: { alignSelf: 'stretch', marginTop: 8 },
  btnSecondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E0E0' },
  btnSecondaryText: { color: '#111', fontWeight: '600', fontSize: 16 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  location: { color: '#666', fontSize: 13, marginBottom: 6 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  count: { color: '#111', fontSize: 15, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '600' },

  // Segmented control
  segmented: {
    flexDirection: 'row',
    marginTop: 12,
    backgroundColor: '#EFEFF2',
    borderRadius: 10,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontSize: 13, color: '#666', fontWeight: '600' },
  segmentTextActive: { color: '#111', fontWeight: '700' },

  // List rows
  listContent: { paddingBottom: 24 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#E5E5E7', marginLeft: 80 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    gap: 12,
  },
  rowPressed: { backgroundColor: '#F0F0F2' },
  rowImageWrap: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#F5F5F7',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  rowImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  rowEmoji: { fontSize: 28 },
  rowBody: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '600', color: '#111' },
  rowQty: { fontSize: 13, color: '#666', marginTop: 2 },
  rowBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    maxWidth: 120,
  },
  rowBadgeText: { fontSize: 11, fontWeight: '700' },

  // Grid
  gridContent: { padding: 8, paddingBottom: 24 },
  gridRow: { gap: 8 },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
    alignItems: 'center',
    minHeight: 150,
  },
  cardImageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#F5F5F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    overflow: 'hidden',
  },
  cardImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  cardEmoji: { fontSize: 36 },
  cardName: { fontSize: 12, fontWeight: '600', color: '#111', textAlign: 'center' },
  cardQty: { fontSize: 11, color: '#666', marginTop: 2 },
  cardBadge: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cardBadgeText: { fontSize: 10, fontWeight: '700' },

  // Swipe delete action
  deleteAction: {
    backgroundColor: '#E23B3B',
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
  },
  deleteActionText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Empty
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 8 },
  emptyText: { color: '#666', textAlign: 'center' },

  // Actions
  actions: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  btn: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#111' },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnDisabled: { backgroundColor: '#F0F0F0' },
  btnDisabledText: { color: '#999', fontWeight: '600', fontSize: 16 },

  // Header button
  headerBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  headerBtnText: { fontSize: 15, color: '#007AFF', fontWeight: '600' },
  headerBtnMore: { fontSize: 26, color: '#007AFF', fontWeight: '700', lineHeight: 26 },

  // Label modal
  modalContainer: { flex: 1, backgroundColor: '#F5F5F7' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
    backgroundColor: '#fff',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  modalClose: { fontSize: 16, color: '#007AFF', fontWeight: '600' },
  modalBody: { flex: 1, padding: 24, alignItems: 'center' },
  labelBoxName: { fontSize: 24, fontWeight: '800', color: '#111', marginTop: 8 },
  labelLocation: { fontSize: 14, color: '#666', marginTop: 4 },
  labelQrWrap: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  labelCodeWrap: {
    marginTop: 16,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  labelCode: {
    fontSize: 11,
    color: '#999',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    maxWidth: 280,
  },
  labelCopyHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  labelCopyHintActive: { color: '#27500A' },
  labelHint: {
    backgroundColor: '#EAF3DE',
    borderRadius: 10,
    padding: 12,
    marginTop: 20,
    alignSelf: 'stretch',
  },
  labelHintText: { color: '#27500A', fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
