// ============================================================================
// Stockr – DB types + domain utilities
// ============================================================================
import { colors } from '@/src/theme';

export type Role = 'owner' | 'member';

export type Unit = 'ks' | 'g' | 'kg' | 'ml' | 'l' | 'bal';

export const UNITS: Unit[] = ['ks', 'g', 'kg', 'ml', 'l', 'bal'];

export type Category =
  | 'potraviny'
  | 'léky'
  | 'voda'
  | 'dezinfekce'
  | 'vybavení'
  | 'energie'
  | 'dokumenty'
  | 'ostatní';

export const CATEGORIES: Category[] = [
  'potraviny',
  'léky',
  'voda',
  'dezinfekce',
  'vybavení',
  'energie',
  'dokumenty',
  'ostatní',
];

export const CATEGORY_EMOJI: Record<Category, string> = {
  potraviny: '🥫',
  léky: '💊',
  voda: '💧',
  dezinfekce: '🧴',
  vybavení: '🔧',
  energie: '🔋',
  dokumenty: '📄',
  ostatní: '📦',
};

// ----------------------------------------------------------------------------
// Tables
// ----------------------------------------------------------------------------

export interface User {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Warehouse {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
}

export interface WarehouseMember {
  warehouse_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
}

export interface Invitation {
  id: string;
  warehouse_id: string;
  invited_by: string;
  email: string;
  token: string;
  role: 'member';
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface Box {
  id: string;
  warehouse_id: string;
  name: string;
  location: string | null;
  qr_code: string;
  nearest_expiry: string | null; // ISO date
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  box_id: string;
  name: string;
  quantity: number;
  unit: Unit;
  expiry_date: string | null;
  barcode: string | null;
  image_url: string | null;
  category: Category | null;
  notes: string | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomProduct {
  id: string;
  warehouse_id: string;
  barcode: string;
  name: string;
  category: Category | null;
  image_url: string | null;
  typical_expiry_days: number | null;
  created_by: string | null;
  created_at: string;
}

// ----------------------------------------------------------------------------
// Expiry status
// ----------------------------------------------------------------------------

export type ExpiryStatus = 'ok' | 'soon' | 'critical' | 'expired' | 'none';

export interface ExpiryPalette {
  bg: string;
  fg: string;
}

export const EXPIRY_COLORS: Record<Exclude<ExpiryStatus, 'none'>, ExpiryPalette> = {
  ok: { bg: colors.expiryOkBg, fg: colors.expiryOkText },
  soon: { bg: colors.expirySoonBg, fg: colors.expirySoonText },
  critical: { bg: colors.expiryCriticalBg, fg: colors.expiryCriticalText },
  expired: { bg: colors.expiryExpiredBg, fg: colors.expiryExpiredText },
};

/**
 * Rozdíl ve dnech mezi `dateStr` (ISO YYYY-MM-DD) a dneškem. Kladné → v budoucnu.
 */
export function daysUntil(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function getExpiryStatus(dateStr: string | null): ExpiryStatus {
  if (!dateStr) return 'none';
  const days = daysUntil(dateStr);
  if (days < 0) return 'expired';
  if (days <= 30) return 'critical';
  if (days <= 90) return 'soon';
  return 'ok';
}

/**
 * Převede ISO YYYY-MM-DD na český formát "15. 3. 2027".
 */
export function formatDateCs(dateStr: string | null): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return `${d}. ${m}. ${y}`;
}

/**
 * Převede JS Date na ISO YYYY-MM-DD (local timezone, ne UTC).
 */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Převede ISO YYYY-MM-DD na JS Date v local timezone.
 */
export function fromIsoDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function formatExpiry(dateStr: string | null): string {
  if (!dateStr) return 'Bez data';
  const days = daysUntil(dateStr);
  if (days < -1) return `Prošlo před ${Math.abs(days)} dny`;
  if (days === -1) return 'Prošlo včera';
  if (days === 0) return 'Expiruje dnes';
  if (days === 1) return 'Expiruje zítra';
  if (days <= 30) return `Expiruje za ${days} dní`;
  if (days <= 365) return `Expiruje za ${Math.round(days / 30)} měs.`;
  return `Expiruje za ${Math.round(days / 365)} r.`;
}

/**
 * Compare function pro řazení beden: expired → critical → soon → ok → none.
 * Uvnitř stejné kategorie: nejbližší expirace první.
 */
const STATUS_ORDER: Record<ExpiryStatus, number> = {
  expired: 0,
  critical: 1,
  soon: 2,
  ok: 3,
  none: 4,
};

export function compareBoxesByExpiry(a: Box, b: Box): number {
  const sa = getExpiryStatus(a.nearest_expiry);
  const sb = getExpiryStatus(b.nearest_expiry);
  if (sa !== sb) return STATUS_ORDER[sa] - STATUS_ORDER[sb];
  if (a.nearest_expiry && b.nearest_expiry) {
    return a.nearest_expiry.localeCompare(b.nearest_expiry);
  }
  return a.name.localeCompare(b.name);
}
