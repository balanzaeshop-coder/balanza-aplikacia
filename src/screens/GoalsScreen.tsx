import React, { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadGoals, saveGoals, DailyGoals, DEFAULT_GOALS } from '../storage/goalsStorage';
import { colors } from '../theme';

interface GoalRowProps {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onDecrement: () => void;
  onIncrement: () => void;
}

function GoalRow({ label, unit, value, min, max, step, onDecrement, onIncrement }: GoalRowProps) {
  return (
    <View style={s.row}>
      <View style={s.rowLeft}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowUnit}>{unit}</Text>
      </View>
      <View style={s.rowControls}>
        <TouchableOpacity
          style={[s.btn, value <= min && s.btnDisabled]}
          onPress={onDecrement}
          disabled={value <= min}
        >
          <Text style={s.btnText}>−</Text>
        </TouchableOpacity>
        <Text style={s.rowValue}>{value}</Text>
        <TouchableOpacity
          style={[s.btn, value >= max && s.btnDisabled]}
          onPress={onIncrement}
          disabled={value >= max}
        >
          <Text style={s.btnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function GoalsScreen() {
  const [goals, setGoals] = useState<DailyGoals>(DEFAULT_GOALS);
  const [saved, setSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadGoals().then(setGoals);
      setSaved(false);
    }, [])
  );

  function updateGoal(key: keyof DailyGoals, delta: number) {
    setGoals(g => ({ ...g, [key]: g[key] + delta }));
    setSaved(false);
  }

  async function handleSave() {
    await saveGoals(goals);
    setSaved(true);
    Alert.alert('Uložené', 'Denné ciele boli uložené.');
  }

  function handleReset() {
    Alert.alert('Obnoviť predvolené?', 'Nastaví kroky na 8 000, km na 5 a čas na 60 min.', [
      { text: 'Zrušiť', style: 'cancel' },
      {
        text: 'Obnoviť',
        onPress: () => {
          setGoals(DEFAULT_GOALS);
          setSaved(false);
        },
      },
    ]);
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <Text style={s.intro}>Nastav si denné ciele. Kruhy na domovskej obrazovke sa budú plniť podľa tvojho pokroku.</Text>

      <View style={s.card}>
        <GoalRow
          label="Kroky"
          unit="krokov"
          value={goals.steps}
          min={1000}
          max={30000}
          step={500}
          onDecrement={() => updateGoal('steps', -500)}
          onIncrement={() => updateGoal('steps', 500)}
        />
        <View style={s.divider} />
        <GoalRow
          label="Vzdialenosť"
          unit="km"
          value={goals.km}
          min={1}
          max={30}
          step={1}
          onDecrement={() => updateGoal('km', -1)}
          onIncrement={() => updateGoal('km', 1)}
        />
        <View style={s.divider} />
        <GoalRow
          label="Aktívny čas"
          unit="min"
          value={goals.minutes}
          min={5}
          max={240}
          step={5}
          onDecrement={() => updateGoal('minutes', -5)}
          onIncrement={() => updateGoal('minutes', 5)}
        />
      </View>

      <TouchableOpacity style={[s.btnSave, saved && s.btnSaved]} onPress={handleSave}>
        <Text style={s.btnSaveText}>{saved ? '✓ Uložené' : 'Uložiť ciele'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.btnReset} onPress={handleReset}>
        <Text style={s.btnResetText}>Obnoviť predvolené</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingBottom: 48 },
  intro: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 24 },

  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  rowLeft: { flex: 1 },
  rowLabel: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  rowUnit: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  rowControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  rowValue: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', minWidth: 56, textAlign: 'center' },

  btn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  btnDisabled: { opacity: 0.3 },
  btnText: { color: colors.accent, fontSize: 22, fontWeight: '700', lineHeight: 24 },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },

  btnSave: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnSaved: { backgroundColor: '#27AE60' },
  btnSaveText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  btnReset: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnResetText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
});
