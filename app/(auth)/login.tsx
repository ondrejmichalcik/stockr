// ============================================================================
// Stockr – Login (Apple Sign In + dev email fallback)
// ============================================================================
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ensureWarehouse, signInWithApple, supabase } from '@/src/lib/supabase';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [devEmail, setDevEmail] = useState('');
  const [devPassword, setDevPassword] = useState('');
  const [devLoading, setDevLoading] = useState(false);

  const handleAppleSignIn = async () => {
    try {
      setLoading(true);

      // Nonce pro Supabase ID token sign-in
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        throw new Error('Apple nevrátil identity token.');
      }

      const { data, error } = await signInWithApple(credential.identityToken, rawNonce);
      if (error) throw error;
      if (!data.session) throw new Error('Přihlášení se nezdařilo.');

      // Aktualizuj display_name z Apple credential (jen při prvním přihlášení)
      if (credential.fullName?.givenName) {
        const displayName = [credential.fullName.givenName, credential.fullName.familyName]
          .filter(Boolean)
          .join(' ');
        await supabase
          .from('users')
          .update({ display_name: displayName })
          .eq('id', data.session.user.id);
      }

      // Zajisti, že existuje sklad
      await ensureWarehouse(data.session.user.id);
    } catch (e: any) {
      if (e?.code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert('Chyba přihlášení', e?.message ?? 'Neznámá chyba');
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // DEV ONLY: Email + Password login pro bypass Apple Sign In v simulátoru.
  // V production buildu (__DEV__ === false) se tato sekce vůbec nerenderuje.
  // --------------------------------------------------------------------------
  const handleDevLogin = async () => {
    const email = devEmail.trim();
    const password = devPassword;
    if (!email || !password) {
      Alert.alert('Chybí údaje', 'Zadej email a heslo.');
      return;
    }
    try {
      setDevLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session) throw new Error('Přihlášení se nezdařilo.');
      await ensureWarehouse(data.session.user.id);
    } catch (e: any) {
      Alert.alert('Dev login selhal', e?.message ?? 'Neznámá chyba');
    } finally {
      setDevLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <Text style={styles.logo}>📦</Text>
            <Text style={styles.title}>Stockr</Text>
            <Text style={styles.subtitle}>Evidence nouzových zásob</Text>
          </View>

          <View style={styles.footer}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={12}
              style={styles.appleBtn}
              onPress={handleAppleSignIn}
            />
            {loading && <Text style={styles.loading}>Přihlašuji…</Text>}

            {__DEV__ && (
              <View style={styles.devSection}>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>DEV ONLY</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TextInput
                  value={devEmail}
                  onChangeText={setDevEmail}
                  placeholder="test@stockr.local"
                  placeholderTextColor="#B0B0B0"
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="username"
                />
                <TextInput
                  value={devPassword}
                  onChangeText={setDevPassword}
                  placeholder="heslo"
                  placeholderTextColor="#B0B0B0"
                  style={styles.input}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={handleDevLogin}
                />
                <Pressable
                  style={[styles.devBtn, devLoading && { opacity: 0.6 }]}
                  onPress={handleDevLogin}
                  disabled={devLoading}
                >
                  {devLoading ? (
                    <ActivityIndicator color="#666" />
                  ) : (
                    <Text style={styles.devBtnText}>Dev login (skip Apple)</Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  logo: { fontSize: 72, marginBottom: 16 },
  title: { fontSize: 40, fontWeight: '800', color: '#111' },
  subtitle: { fontSize: 16, color: '#666', marginTop: 8 },
  footer: { paddingBottom: 32, paddingTop: 16 },
  appleBtn: { width: '100%', height: 52 },
  loading: { textAlign: 'center', marginTop: 12, color: '#666' },

  // Dev section
  devSection: { marginTop: 32 },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#D0D0D0',
  },
  dividerText: {
    fontSize: 11,
    color: '#999',
    fontWeight: '700',
    letterSpacing: 1.5,
    marginHorizontal: 10,
  },
  input: {
    backgroundColor: '#F5F5F7',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  devBtn: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#EFEFF2',
    alignItems: 'center',
  },
  devBtnText: { color: '#444', fontWeight: '600', fontSize: 14 },
});
