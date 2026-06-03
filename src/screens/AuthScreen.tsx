import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { auth } from '../firebase/config';
import { colors, fonts } from '../theme';

GoogleSignin.configure({
  webClientId: '456011197309-76eph4f6c58k2jnlg62q0q2of85flp4e.apps.googleusercontent.com',
});

export default function AuthScreen({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const { data } = await GoogleSignin.signIn();
      if (!data?.idToken) throw new Error('Nepodarilo sa prihlásiť cez Google.');
      const credential = GoogleAuthProvider.credential(data.idToken);
      await signInWithCredential(auth, credential);
      onDone();
    } catch (e: any) {
      if (e.code !== 'SIGN_IN_CANCELLED') {
        Alert.alert('Chyba', e.message ?? 'Google prihlásenie zlyhalo.');
      }
    }
    setGoogleLoading(false);
  }

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Chýbajúce údaje', 'Zadaj email aj heslo.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
      onDone();
    } catch (e: any) {
      const msg: Record<string, string> = {
        'auth/invalid-email': 'Neplatný email.',
        'auth/wrong-password': 'Nesprávne heslo.',
        'auth/invalid-credential': 'Nesprávny email alebo heslo.',
        'auth/user-not-found': 'Účet neexistuje.',
        'auth/email-already-in-use': 'Email je už zaregistrovaný.',
        'auth/weak-password': 'Heslo musí mať aspoň 6 znakov.',
      };
      Alert.alert('Chyba', msg[e.code] ?? e.message);
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.inner} keyboardShouldPersistTaps="handled">
        <Image source={require('../../assets/logo_balanza_new.png')} style={s.logo} resizeMode="contain" />
        <Text style={s.subtitle}>
          {mode === 'login' ? 'Prihlás sa do svojho účtu' : 'Vytvor si účet'}
        </Text>

        {/* Google button */}
        <TouchableOpacity
          style={[s.googleBtn, googleLoading && { opacity: 0.6 }]}
          onPress={handleGoogle}
          disabled={googleLoading}
        >
          {googleLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={s.googleBtnInner}>
              <Text style={s.googleIcon}>G</Text>
              <Text style={s.googleBtnText}>Pokračovať cez Google</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>alebo</Text>
          <View style={s.dividerLine} />
        </View>

        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={s.input}
          placeholder="Heslo"
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[s.btn, loading && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={colors.bg} />
            : <Text style={s.btnText}>{mode === 'login' ? 'Prihlásiť sa' : 'Zaregistrovať sa'}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={s.switchBtn} onPress={() => setMode(m => m === 'login' ? 'register' : 'login')}>
          <Text style={s.switchText}>
            {mode === 'login' ? 'Nemáš účet? Zaregistruj sa' : 'Máš účet? Prihlás sa'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 32 },
  logo: { width: 220, height: 72, alignSelf: 'center', marginBottom: 8 },
  subtitle: { fontFamily: fonts.regular, fontSize: 16, color: colors.textSecondary, textAlign: 'center', marginBottom: 32 },

  googleBtn: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 50,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 4,
  },
  googleBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  googleIcon: { fontSize: 18, fontWeight: '700', color: '#fff' },
  googleBtnText: { fontFamily: fonts.semiBold, fontSize: 16, color: '#fff' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 13 },

  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 18,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 14,
  },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: { fontFamily: fonts.bold, fontSize: 18, color: colors.bg },
  switchBtn: { paddingVertical: 16, alignItems: 'center' },
  switchText: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 14 },
});
