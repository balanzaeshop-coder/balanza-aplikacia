import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { colors, fonts } from '../theme';

export default function AuthScreen({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
        <Text style={s.logo}>Balanza</Text>
        <Text style={s.subtitle}>
          {mode === 'login' ? 'Prihlás sa do svojho účtu' : 'Vytvor si účet'}
        </Text>

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
  inner: { flex: 1, justifyContent: 'center', padding: 32 },
  logo: { fontFamily: 'CormorantGaramond-BoldItalic', fontSize: 52, color: '#fff', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontFamily: fonts.regular, fontSize: 16, color: colors.textSecondary, textAlign: 'center', marginBottom: 40 },
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
    marginTop: 8,
  },
  btnText: { fontFamily: fonts.bold, fontSize: 18, color: colors.bg },
  switchBtn: { paddingVertical: 16, alignItems: 'center' },
  switchText: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 14 },
});
