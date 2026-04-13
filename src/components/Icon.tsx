// ============================================================================
// Stockr – Icon
// Renders one of the pre-rendered 3D sage-green icons from assets/icons/.
// Icons are monochrome sage green with baked-in shading. Default display
// preserves the 3D look; pass `tintColor` to mask the icon to a flat color
// (loses shading but useful on buttons where color must match the design).
// ============================================================================
import { Image } from 'react-native';
import type { ImageStyle, StyleProp } from 'react-native';

const ICONS = {
  // Navigation & chrome
  'chevron-left': require('@/assets/icons/chevron-left.png'),
  'chevron-right': require('@/assets/icons/chevron-right.png'),
  'chevron-down': require('@/assets/icons/chevron-down.png'),
  'chevron-up': require('@/assets/icons/chevron-up.png'),
  'close': require('@/assets/icons/close.png'),
  'more': require('@/assets/icons/more.png'),

  // Actions
  'plus': require('@/assets/icons/plus.png'),
  'check': require('@/assets/icons/check.png'),
  'edit': require('@/assets/icons/edit.png'),
  'trash': require('@/assets/icons/trash.png'),
  'copy': require('@/assets/icons/copy.png'),
  'share': require('@/assets/icons/share.png'),
  'printer': require('@/assets/icons/printer.png'),
  'retry': require('@/assets/icons/retry.png'),

  // Input & display
  'camera': require('@/assets/icons/camera.png'),
  'flashlight-on': require('@/assets/icons/flashlight-on.png'),
  'flashlight-off': require('@/assets/icons/flashlight-off.png'),
  'scan-qr': require('@/assets/icons/scan-qr.png'),
  'grid': require('@/assets/icons/grid.png'),
  'list': require('@/assets/icons/list.png'),
  'pin': require('@/assets/icons/pin.png'),

  // Status
  'warning': require('@/assets/icons/warning.png'),
  'inbox': require('@/assets/icons/inbox.png'),
  'tag': require('@/assets/icons/tag.png'),

  // Categories
  'food-can': require('@/assets/icons/food-can.png'),
  'medicine-pill': require('@/assets/icons/medicine-pill.png'),
  'water-drop': require('@/assets/icons/water-drop.png'),
  'disinfectant-bottle': require('@/assets/icons/disinfectant-bottle.png'),
  'tool-wrench': require('@/assets/icons/tool-wrench.png'),
  'battery': require('@/assets/icons/battery.png'),
  'document': require('@/assets/icons/document.png'),
  'box-generic': require('@/assets/icons/box-generic.png'),
} as const;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  size?: number;
  tintColor?: string;
  style?: StyleProp<ImageStyle>;
}

export function Icon({ name, size = 24, tintColor, style }: IconProps) {
  return (
    <Image
      source={ICONS[name]}
      style={[
        { width: size, height: size },
        tintColor ? { tintColor } : null,
        style,
      ]}
      resizeMode="contain"
    />
  );
}
