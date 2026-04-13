// ============================================================================
// Stockr – (app) stack layout
// ============================================================================
import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack>
      {/*
        Dashboard bez nav headeru — má vlastní layout (SafeAreaView + FlatList)
        a systémový "Stockr" title překrýval první kartu kvůli
        headerLargeTitle integration bugu.
      */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
