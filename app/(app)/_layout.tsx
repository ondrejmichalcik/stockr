// ============================================================================
// Stockr – (app) stack layout
// ============================================================================
import { Stack } from 'expo-router';

export default function AppLayout() {
  // All screens in (app) use custom in-screen headers. The native stack
  // header is always hidden to preserve the sage-green gradient background.
  return <Stack screenOptions={{ headerShown: false }} />;
}
