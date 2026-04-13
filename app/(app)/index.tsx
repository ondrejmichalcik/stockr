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
import { colors, radius, spacing, typography } from '@/src/theme';

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
        <ActivityIndicator color={colors.primary} />
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textMuted}
          />
        }
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
  const palette =
    status === 'none'
      ? { bg: colors.expiryNoneBg, fg: colors.expiryNoneText }
      : EXPIRY_COLORS[status];

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
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    ...typography.largeTitle,
    color: colors.text,
    letterSpacing: -0.5,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
    backgroundColor: colors.background,
  },
  errorEmoji: { fontSize: 56, marginBottom: spacing.lg },
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
  alertBanner: {
    backgroundColor: colors.dangerBg,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.dangerBgStrong,
  },
  alertText: {
    ...typography.subhead,
    color: colors.dangerText,
    fontWeight: '600',
  },
  listContent: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.headline,
    color: colors.text,
    flex: 1,
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
  cardMeta: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  cardMetaText: {
    ...typography.footnote,
    color: colors.textMuted,
  },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: spacing.xxl },
  emptyEmoji: { fontSize: 64, marginBottom: spacing.lg },
  emptyTitle: {
    ...typography.title3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.subhead,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  emptyBtn: { alignSelf: 'stretch', marginTop: spacing.sm },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  btn: {
    flex: 1,
    paddingVertical: spacing.md + 2,
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
  signOut: { alignItems: 'center', paddingVertical: spacing.md },
  signOutText: {
    ...typography.footnote,
    color: colors.textSubtle,
  },
});
