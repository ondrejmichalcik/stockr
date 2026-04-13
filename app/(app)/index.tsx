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
import { ScreenBackground } from '@/src/components/ScreenBackground';
import { Icon } from '@/src/components/Icon';
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
      setError(e?.message ?? 'Cannot load warehouse.');
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
      <ScreenBackground>
        <SafeAreaView style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  // Error screen – jen pokud nemáme žádná cached data
  if (error && boxes.length === 0) {
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
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Stockr</Text>
        </View>

        {criticalCount > 0 && (
          <View style={styles.alertBanner}>
            <Icon name="warning" size={20} />
            <Text style={styles.alertText}>
              {criticalCount} {criticalCount === 1 ? 'box has' : 'boxes have'} critical expiry
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
            <Icon name="box-generic" size={96} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>No boxes yet</Text>
            <Text style={styles.emptyText}>
              Create your first box and stick a QR label on it.
            </Text>
            <Pressable
              style={[styles.btn, styles.btnPrimary, styles.emptyBtn]}
              onPress={() => router.push('/box/new' as any)}
            >
              <View style={styles.btnContent}>
                <Icon name="plus" size={18} />
                <Text style={styles.btnPrimaryText}>Create first box</Text>
              </View>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => <BoxCard box={item} onPress={() => router.push(`/box/${item.id}` as any)} />}
      />

      {/* Scan + new box actions */}
      <View style={styles.actions}>
        <Pressable style={[styles.btn, styles.btnSecondary]} onPress={() => router.push('/scan' as any)}>
          <View style={styles.btnContent}>
            <Icon name="scan-qr" size={18} />
            <Text style={styles.btnSecondaryText}>Scan QR</Text>
          </View>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => router.push('/box/new' as any)}>
          <View style={styles.btnContent}>
            <Icon name="plus" size={18} />
            <Text style={styles.btnPrimaryText}>New box</Text>
          </View>
        </Pressable>
      </View>

        {/* Temporary sign-out button — moves to settings in a later sprint */}
        <Pressable onPress={() => signOut()} style={styles.signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </SafeAreaView>
    </ScreenBackground>
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
        {box.location ? (
          <View style={styles.cardMetaItem}>
            <Icon name="pin" size={14} />
            <Text style={styles.cardMetaText}>{box.location}</Text>
          </View>
        ) : null}
        <Text style={styles.cardMetaText}>
          {box.item_count} {box.item_count === 1 ? 'item' : 'items'}
        </Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: 'transparent',
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
    backgroundColor: 'transparent',
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
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
    flex: 1,
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
  cardMeta: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  cardMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardMetaText: {
    ...typography.footnote,
    color: colors.textMuted,
  },
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
  signOut: { alignItems: 'center', paddingVertical: spacing.md },
  signOutText: {
    ...typography.footnote,
    color: colors.textSubtle,
  },
});
