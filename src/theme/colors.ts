// Dark-first palette derived from the login/splash hero image.
// The whole app uses this scheme — backgrounds are dark sage green,
// surfaces are subtle white overlays, text is light.

// Sage green scale — sampled from the app icon's radial gradient.
const sage = {
  50: '#E8F4EC',
  100: '#C2E3CE',
  200: '#96CFAC',
  300: '#68B589',
  400: '#4A9870',
  500: '#2E7A52',
  600: '#1E5F3E',
  700: '#174D32',
  800: '#103927',
  900: '#0A2519',
} as const;

// Status palettes — tuned for dark backgrounds (brighter, higher luminosity).
const red = {
  300: '#FCA5A5',
  400: '#F87171',
  500: '#EF4444',
  600: '#DC2626',
} as const;

const amber = {
  300: '#FCD34D',
  400: '#FBBF24',
  500: '#F59E0B',
  600: '#D97706',
} as const;

const blue = {
  300: '#93C5FD',
  400: '#60A5FA',
  500: '#3B82F6',
} as const;

// Semantic tokens. Use these in screens, not raw palettes above.
export const colors = {
  // Brand
  primary: sage[500],
  primaryDark: sage[600],
  primaryLight: sage[400],
  primarySubtle: 'rgba(74, 152, 112, 0.18)',
  primaryTint: 'rgba(74, 152, 112, 0.10)',

  // Surfaces — dark base, subtle lift for cards via white overlay
  background: sage[800],
  surface: 'rgba(255, 255, 255, 0.06)',
  surfaceElevated: 'rgba(255, 255, 255, 0.10)',
  surfaceInverted: '#FFFFFF',

  // Hero tokens — kept as aliases of the default surface/text colors since
  // the whole app is now dark. Retained for semantic clarity on auth/splash.
  heroBackground: sage[800],
  heroSurface: 'rgba(255, 255, 255, 0.10)',
  heroBorder: 'rgba(255, 255, 255, 0.18)',
  heroText: '#FFFFFF',
  heroTextMuted: 'rgba(255, 255, 255, 0.72)',
  heroTextSubtle: 'rgba(255, 255, 255, 0.45)',

  // Text
  text: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.72)',
  textSubtle: 'rgba(255, 255, 255, 0.45)',
  textOnPrimary: '#FFFFFF',
  textOnDanger: '#FFFFFF',
  textInverted: sage[900],

  // Borders
  border: 'rgba(255, 255, 255, 0.12)',
  borderStrong: 'rgba(255, 255, 255, 0.20)',
  borderFocus: sage[400],

  // Status — foreground colors (text / icons)
  danger: red[400],
  dangerDark: red[500],
  dangerBg: 'rgba(248, 113, 113, 0.14)',
  dangerBgStrong: 'rgba(248, 113, 113, 0.24)',
  dangerText: red[300],

  warning: amber[400],
  warningDark: amber[500],
  warningBg: 'rgba(251, 191, 36, 0.14)',
  warningBgStrong: 'rgba(251, 191, 36, 0.24)',
  warningText: amber[300],

  success: sage[300],
  successDark: sage[400],
  successBg: 'rgba(104, 181, 137, 0.16)',
  successBgStrong: 'rgba(104, 181, 137, 0.26)',
  successText: sage[200],

  info: blue[400],
  infoBg: 'rgba(96, 165, 250, 0.14)',
  infoText: blue[300],

  // Expiry state tokens — overlay tints that stack on the dark background
  expiryExpiredBg: 'rgba(248, 113, 113, 0.22)',
  expiryCriticalBg: 'rgba(248, 113, 113, 0.12)',
  expirySoonBg: 'rgba(251, 191, 36, 0.14)',
  expiryOkBg: 'rgba(104, 181, 137, 0.14)',
  expiryNoneBg: 'rgba(255, 255, 255, 0.06)',

  // Expiry state tokens — text / icon tint
  expiryExpiredText: red[300],
  expiryCriticalText: red[300],
  expirySoonText: amber[300],
  expiryOkText: sage[200],
  expiryNoneText: 'rgba(255, 255, 255, 0.55)',

  // Utility
  overlay: 'rgba(0, 0, 0, 0.55)',
  scrim: 'rgba(8, 18, 14, 0.65)',
  transparent: 'transparent',

  // Raw palettes re-exported for rare escape-hatch usage
  palette: { sage, red, amber, blue },
} as const;

export type Colors = typeof colors;
