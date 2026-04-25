// ============================================================================
// Kalta – Realtime echo suppression
// Tracks recent local mutations so the realtime subscription handlers
// can ignore the server's echo of our own writes. The local SQLite is
// already up-to-date after the optimistic write; firing onChange() for
// the echo just causes a redundant load() and re-render with identical
// data.
// ============================================================================

interface RecentWrite {
  table: string;
  rowId: string;
  ts: number;
}

const RECENT_WRITES: RecentWrite[] = [];

/** Window during which a realtime event is treated as our own echo. */
const ECHO_WINDOW_MS = 5_000;

/** Hard cap on tracker size — defensive against runaway growth. */
const MAX_TRACKED = 200;

/**
 * Record that this client just mutated `(table, rowId)`. Realtime
 * events arriving within ECHO_WINDOW_MS for the same row will be
 * suppressed. Called from `enqueueChange` so every write is covered.
 */
export function markRecentLocalWrite(table: string, rowId: string): void {
  const now = Date.now();
  RECENT_WRITES.push({ table, rowId, ts: now });
  pruneStale(now);
  if (RECENT_WRITES.length > MAX_TRACKED) {
    RECENT_WRITES.splice(0, RECENT_WRITES.length - MAX_TRACKED);
  }
}

/**
 * Returns true if the (table, rowId) was written locally within the
 * suppression window — caller should skip the realtime callback.
 */
export function wasRecentLocalWrite(table: string, rowId: string): boolean {
  const now = Date.now();
  pruneStale(now);
  return RECENT_WRITES.some(
    (w) => w.table === table && w.rowId === rowId && now - w.ts < ECHO_WINDOW_MS,
  );
}

function pruneStale(now: number): void {
  while (RECENT_WRITES.length > 0 && now - RECENT_WRITES[0].ts >= ECHO_WINDOW_MS) {
    RECENT_WRITES.shift();
  }
}
