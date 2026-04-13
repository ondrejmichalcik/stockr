import { colors } from './colors';
import { spacing } from './spacing';
import { typography } from './typography';
import { radius } from './radius';
import { shadows } from './shadows';

export { colors, spacing, typography, radius, shadows };
export type { Colors } from './colors';
export type { Spacing } from './spacing';
export type { Typography } from './typography';
export type { Radius } from './radius';
export type { Shadows } from './shadows';

// Bundled theme object for components that want a single import.
export const theme = {
  colors,
  spacing,
  typography,
  radius,
  shadows,
} as const;

export type Theme = typeof theme;
