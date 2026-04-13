// ============================================================================
// Stockr – Dashboard (seznam beden)
// ============================================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ensureWarehouse,
  listBoxes,
  signOut,
  subscribeBoxes,
  supabase,
} from '@/src/lib/supabase';
import type { Box, Warehouse } from '@/src/types/database';
import {
  EXPIRY_COLORS,
  compareBoxesByExpiry,
  formatExpiry,
  getExpiryStatus,
} from '@/src/types/database';

export default function DashboardScreen() {
  const router = useRouter();
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;
      if (!userId) return;
      const wh = await ensureWarehouse(userId);
      setWarehouse(wh);
      const rows = await listBoxes(wh.id);
      setBoxes(rows);
    } catch (e: any) {
      setError(e?.message ?? 'Nelze načíst sklad.');
      throw e;
    }
  }, []);

  const retry = async () => {
    setLoading(true);
    try {
      await load();
    } catch {
      // Error už je v state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  // Refresh při návratu na screen (např. po createBox v box/new)
  // expo-router drží screeny v memory, takže useEffect nereagne — useFocusEffect ano.
  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [load]),
  );

  // Realtime subscription na boxes (vyžaduje enabled replication v Supabase)
  useEffect(() => {
    if (!warehouse) return;
    const unsubscribe = subscribeBoxes(warehouse.id, () => {
      listBoxes(warehouse.id).then(setBoxes).catch(() => {});
    });
    return unsubscribe;
  }, [warehouse]);

  const sortedBoxes = useMemo(() => [...boxes].sort(compareBoxesByExpiry), [boxes]);

  const criticalCount = useMemo(
    () =>
      boxes.filter((b) => {
        const s = getExpiryStatus(b.nearest_expiry);
        return s === 'critical' || s === 'expired';
      }).length,
    [boxes],
  );

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

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  // Error screen – jen pokud nemáme žádná cached data
  if (error && boxes.length === 0) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={styles.errorTitle}>Něco se pokazilo</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={[styles.btn, styles.btnPrimary, styles.retryBtn]} onPress={retry}>
          <Text style={styles.btnPrimaryText}>Zkusit znovu</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Stockr</Text>
      </View>

      {criticalCount > 0 && (
        <View style={styles.alertBanner}>
          <Text style={styles.alertText}>
            ⚠️ {criticalCount} {criticalCount === 1 ? 'bedna má' : 'beden má'} kritickou expiraci
          </Text>
        </View>
      )}

      <FlatList
        data={sortedBoxes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyTitle}>Zatím žádné bedny</Text>
            <Text style={styles.emptyText}>
              Vytvoř první bednu a přilep si na ni QR štítek.
            </Text>
            <Pressable
              style={[styles.btn, styles.btnPrimary, styles.emptyBtn]}
              onPress={() => router.push('/box/new' as any)}
            >
              <Text style={styles.btnPrimaryText}>+ Vytvořit první bednu</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => <BoxCard box={item} onPress={() => router.push(`/box/${item.id}` as any)} />}
      />

      {/* Tlačítka – Skenovat + Nová bedna */}
      <View style={styles.actions}>
        <Pressable style={[styles.btn, styles.btnSecondary]} onPress={() => router.push('/scan' as any)}>
          <Text style={styles.btnSecondaryText}>📷 Skenovat QR</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => router.push('/box/new' as any)}>
          <Text style={styles.btnPrimaryText}>+ Nová bedna</Text>
        </Pressable>
      </View>

      {/* Dočasné odhlášení – přesune se do settings v dalším sprintu */}
      <Pressable onPress={() => signOut()} style={styles.signOut}>
        <Text style={styles.signOutText}>Odhlásit</Text>
      </Pressable>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// BoxCard
// ---------------------------------------------------------------------------

function BoxCard({ box, onPress }: { box: Box; onPress: () => void }) {
  const status = getExpiryStatus(box.nearest_expiry);
  const palette = status === 'none' ? { bg: '#EFEFEF', fg: '#666' } : EXPIRY_COLORS[status];

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{box.name}</Text>
        <View style={[styles.badge, { backgroundColor: palette.bg }]}>
          <Text style={[styles.badgeText, { color: palette.fg }]}>
            {formatExpiry(box.nearest_expiry)}
          </Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        {box.location ? <Text style={styles.cardMetaText}>📍 {box.location}</Text> : null}
        <Text style={styles.cardMetaText}>
          {box.item_count} {box.item_count === 1 ? 'položka' : box.item_count < 5 ? 'položky' : 'položek'}
        </Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#111',
    letterSpacing: -0.5,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F5F5F7',
  },
  errorEmoji: { fontSize: 56, marginBottom: 16 },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 8 },
  errorText: { color: '#666', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  retryBtn: { alignSelf: 'stretch', marginTop: 8 },
  alertBanner: {
    backgroundColor: '#FCEBEB',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  alertText: { color: '#791F1F', fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 24, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#111', flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  cardMeta: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cardMetaText: { color: '#666', fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 8 },
  emptyText: { color: '#666', textAlign: 'center', marginBottom: 24 },
  emptyBtn: { alignSelf: 'stretch', marginTop: 8 },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: '#111' },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
  btnSecondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E0E0' },
  btnSecondaryText: { color: '#111', fontWeight: '600' },
  signOut: { alignItems: 'center', paddingVertical: 12 },
  signOutText: { color: '#999', fontSize: 13 },
});
