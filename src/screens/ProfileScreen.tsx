import React, { useCallback, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadProfile, saveProfile, UserProfile } from '../storage/profileStorage';
import { initHealthKit } from '../health/appleHealth';
import { colors } from '../theme';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile>({ name: '', weight: 70, height: 175, age: 30, gender: 'male' });
  const [saved, setSaved] = useState(false);
  const [healthLinked, setHealthLinked] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadProfile().then(setProfile);
    }, [])
  );

  function update(key: keyof UserProfile, value: any) {
    setProfile(p => ({ ...p, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    if (profile.weight < 30 || profile.weight > 200) {
      Alert.alert('Neplatná váha', 'Zadaj váhu medzi 30 a 200 kg');
      return;
    }
    if (profile.height < 100 || profile.height > 250) {
      Alert.alert('Neplatná výška', 'Zadaj výšku medzi 100 a 250 cm');
      return;
    }
    if (profile.age < 10 || profile.age > 100) {
      Alert.alert('Neplatný vek', 'Zadaj vek medzi 10 a 100');
      return;
    }
    await saveProfile(profile);
    setSaved(true);
  }

  const bmi = profile.weight / Math.pow(profile.height / 100, 2);
  const bmiLabel = bmi < 18.5 ? 'Podváha' : bmi < 25 ? 'Normálna váha' : bmi < 30 ? 'Nadváha' : 'Obezita';
  const bmiColor = bmi < 18.5 ? '#F39C12' : bmi < 25 ? '#27AE60' : bmi < 30 ? '#F39C12' : '#E74C3C';

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Image source={require('../../assets/logo_balanza.png')} style={s.logo} resizeMode="contain" />

      <View style={s.card}>
        <Text style={s.cardTitle}>Osobné údaje</Text>
        <Text style={s.hint}>Slúžia na výpočet spálených kalórií</Text>

        <Field label="Váha (kg)">
          <TextInput
            style={s.input}
            value={String(profile.weight)}
            onChangeText={v => update('weight', parseFloat(v) || 0)}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />
        </Field>

        <Field label="Výška (cm)">
          <TextInput
            style={s.input}
            value={String(profile.height)}
            onChangeText={v => update('height', parseInt(v) || 0)}
            keyboardType="number-pad"
            returnKeyType="done"
          />
        </Field>

        <Field label="Vek">
          <TextInput
            style={s.input}
            value={String(profile.age)}
            onChangeText={v => update('age', parseInt(v) || 0)}
            keyboardType="number-pad"
            returnKeyType="done"
          />
        </Field>

        <Field label="Pohlavie">
          <View style={s.genderRow}>
            <TouchableOpacity
              style={[s.genderBtn, profile.gender === 'male' && s.genderBtnActive]}
              onPress={() => update('gender', 'male')}
            >
              <Text style={[s.genderText, profile.gender === 'male' && s.genderTextActive]}>Muž</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.genderBtn, profile.gender === 'female' && s.genderBtnActive]}
              onPress={() => update('gender', 'female')}
            >
              <Text style={[s.genderText, profile.gender === 'female' && s.genderTextActive]}>Žena</Text>
            </TouchableOpacity>
          </View>
        </Field>
      </View>

      {/* BMI card */}
      <View style={s.bmiCard}>
        <Text style={s.bmiLabel}>BMI</Text>
        <Text style={[s.bmiValue, { color: bmiColor }]}>{bmi.toFixed(1)}</Text>
        <Text style={[s.bmiCategory, { color: bmiColor }]}>{bmiLabel}</Text>
      </View>

      {Platform.OS === 'ios' && (
        <View style={s.healthCard}>
          <View style={s.healthRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.healthTitle}>Apple Health</Text>
              <Text style={s.healthSub}>Automaticky zapisovať tréningy, kroky a kalórie</Text>
            </View>
            <Switch
              value={healthLinked}
              onValueChange={async (val) => {
                if (val) {
                  const ok = await initHealthKit();
                  if (ok) setHealthLinked(true);
                  else Alert.alert('Chyba', 'Nepodarilo sa pripojiť Apple Health. Skontroluj povolenia v Nastaveniach.');
                } else {
                  setHealthLinked(false);
                }
              }}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>
          {healthLinked && <Text style={s.healthActive}>✓ Tréningy sa automaticky zapisujú do Apple Health</Text>}
        </View>
      )}

      <TouchableOpacity style={[s.btnSave, saved && s.btnSaved]} onPress={handleSave}>
        <Text style={s.btnSaveText}>{saved ? '✓ Uložené' : 'Uložiť profil'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingBottom: 48 },
  logo: { width: 140, height: 42, marginBottom: 24 },

  card: { backgroundColor: colors.bgCard, borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  cardTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  hint: { color: colors.textSecondary, fontSize: 13, marginBottom: 20 },

  field: { marginBottom: 16 },
  fieldLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  input: { backgroundColor: colors.bgCardAlt, borderRadius: 12, padding: 14, fontSize: 16, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border },

  genderRow: { flexDirection: 'row', gap: 10 },
  genderBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: colors.bgCardAlt, borderWidth: 1, borderColor: colors.border },
  genderBtnActive: { backgroundColor: colors.accentLight, borderColor: colors.accent },
  genderText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  genderTextActive: { color: colors.accent },

  bmiCard: { backgroundColor: colors.bgCard, borderRadius: 20, padding: 20, marginBottom: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  bmiLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  bmiValue: { fontSize: 48, fontWeight: '800' },
  bmiCategory: { fontSize: 15, fontWeight: '600', marginTop: 4 },

  healthCard: { backgroundColor: colors.bgCard, borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  healthRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  healthTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  healthSub: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  healthActive: { color: '#27AE60', fontSize: 13, fontWeight: '600', marginTop: 12 },
  btnSave: { backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  btnSaved: { backgroundColor: '#27AE60' },
  btnSaveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
