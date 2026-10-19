import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  useColorScheme,
  Alert,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { RustModule } from './src/RustModule';

export default function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const insets = useSafeAreaInsets();

  // Arithmetic State
  const [numA, setNumA] = useState<string>('20');
  const [numB, setNumB] = useState<string>('22');
  const [calcResult, setCalcResult] = useState<string | null>('42');
  const [calcOp, setCalcOp] = useState<string>('20 + 22 = 42');

  // Greeting State
  const [name, setName] = useState<string>('Alex');
  const [greetingResult, setGreetingResult] = useState<string | null>('Hello, Alex!');

  // Rust Data Store State (16 slots)
  const [slotIndex, setSlotIndex] = useState<string>('0');
  const [slotValue, setSlotValue] = useState<string>('12.5');
  const [dataSlots, setDataSlots] = useState<number[]>([]);
  const [storeStatus, setStoreStatus] = useState<string>('Initial state');

  // Diagnostic Test Suite State
  const [testResults, setTestResults] = useState<
    { name: string; expected: string; actual: string; passed: boolean }[] | null
  >(null);

  // Load Rust Data buffer
  const refreshSlots = useCallback(() => {
    try {
      const buffer = RustModule.getValues();
      if (buffer) {
        setDataSlots(Array.from(buffer));
        setStoreStatus(`Loaded ${buffer.length} slots from Rust memory`);
      } else {
        setStoreStatus('Buffer returned null');
      }
    } catch (e: any) {
      setStoreStatus(`Error: ${e.message}`);
    }
  }, []);

  useEffect(() => {
    refreshSlots();
  }, [refreshSlots]);

  // Handler: Add
  const handleAdd = () => {
    const a = parseFloat(numA);
    const b = parseFloat(numB);
    if (isNaN(a) || isNaN(b)) {
      Alert.alert('Invalid Input', 'Please enter valid numbers for A and B');
      return;
    }
    const res = RustModule.add(a, b);
    setCalcResult(res.toString());
    setCalcOp(`${a} + ${b} = ${res}`);
  };

  // Handler: Multiply
  const handleMultiply = () => {
    const a = parseFloat(numA);
    const b = parseFloat(numB);
    if (isNaN(a) || isNaN(b)) {
      Alert.alert('Invalid Input', 'Please enter valid numbers for A and B');
      return;
    }
    const res = RustModule.multiply(a, b);
    setCalcResult(res.toString());
    setCalcOp(`${a} × ${b} = ${res}`);
  };

  // Handler: IsPositive
  const handleIsPositive = () => {
    const a = parseFloat(numA);
    if (isNaN(a)) {
      Alert.alert('Invalid Input', 'Please enter a valid number for A');
      return;
    }
    const res = RustModule.isPositive(a);
    setCalcResult(res ? 'true' : 'false');
    setCalcOp(`isPositive(${a}) = ${res ? 'true' : 'false'}`);
  };

  // Handler: Greeting
  const handleGreeting = () => {
    try {
      const res = RustModule.greeting(name);
      setGreetingResult(res);
    } catch (e: any) {
      Alert.alert('Rust Error', e.message);
    }
  };

  // Handler: Set Value in Rust Data Store
  const handleSetValue = () => {
    const idx = parseInt(slotIndex, 10);
    const val = parseFloat(slotValue);
    if (isNaN(idx) || isNaN(val)) {
      Alert.alert('Invalid Input', 'Index and Value must be valid numbers');
      return;
    }
    const success = RustModule.setValue(idx, val);
    if (success) {
      setStoreStatus(`Slot [${idx}] updated to ${val}`);
      refreshSlots();
    } else {
      setStoreStatus(`Failed: Index ${idx} is out of bounds (allowed: 0..15)`);
      Alert.alert(
        'Out of Bounds',
        `Index ${idx} is out of range! The Rust store only allocates 16 slots (0..15).`,
      );
    }
  };

  // Handler: Run Verification Suite
  const handleRunSuite = () => {
    try {
      const results = [];

      // Test 1: Add
      const addRes = RustModule.add(20, 22);
      results.push({
        name: 'rust_add(20, 22)',
        expected: '42',
        actual: String(addRes),
        passed: addRes === 42,
      });

      // Test 2: Multiply
      const mulRes = RustModule.multiply(6, 7);
      results.push({
        name: 'rust_multiply(6, 7)',
        expected: '42',
        actual: String(mulRes),
        passed: mulRes === 42,
      });

      // Test 3: isPositive
      const posRes = RustModule.isPositive(5);
      results.push({
        name: 'rust_is_positive(5)',
        expected: 'true',
        actual: String(posRes),
        passed: posRes === true,
      });

      // Test 4: greeting
      const greetRes = RustModule.greeting('Alex');
      results.push({
        name: "rust_greeting('Alex')",
        expected: 'Hello, Alex!',
        actual: String(greetRes),
        passed: greetRes === 'Hello, Alex!',
      });

      // Test 5: setValue valid
      const setValRes = RustModule.setValue(0, 12.5);
      results.push({
        name: 'rust_data_set(slot: 0, val: 12.5)',
        expected: 'true',
        actual: String(setValRes),
        passed: setValRes === true,
      });

      // Test 6: getValues
      const buffer = RustModule.getValues();
      const slot0 = buffer ? buffer[0] : null;
      results.push({
        name: 'rust_data_values()[0]',
        expected: '12.5',
        actual: String(slot0),
        passed: slot0 === 12.5,
      });

      // Test 7: setValue out of bounds check
      const oobRes = RustModule.setValue(5000, 12.5);
      results.push({
        name: 'rust_data_set(slot: 5000) [OOB Check]',
        expected: 'false',
        actual: String(oobRes),
        passed: oobRes === false,
      });

      setTestResults(results);
      refreshSlots();
    } catch (e: any) {
      Alert.alert('Suite Failed', e.message);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <View style={styles.liveIndicator} />
          <Text style={styles.badgeText}>JSI TURBOMODULE ACTIVE</Text>
        </View>
        <Text style={styles.title}>React Native + Rust</Text>
        <Text style={styles.subtitle}>
          Interactive direct C ABI bridge via C++17 JSI & Rust static library
        </Text>
      </View>

      {/* Card 1: Stateless Arithmetic */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardCategory}>STATELESS SCALAR FFI</Text>
          <Text style={styles.cardTitle}>Arithmetic Operations</Text>
        </View>

        <View style={styles.inputRow}>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Input A</Text>
            <TextInput
              style={styles.input}
              value={numA}
              onChangeText={setNumA}
              keyboardType="numeric"
              placeholderTextColor="#64748B"
              placeholder="e.g. 20"
            />
          </View>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Input B</Text>
            <TextInput
              style={styles.input}
              value={numB}
              onChangeText={setNumB}
              keyboardType="numeric"
              placeholderTextColor="#64748B"
              placeholder="e.g. 22"
            />
          </View>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.primaryBtn]}
            onPress={handleAdd}
          >
            <Text style={styles.btnText}>Add (A + B)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.secondaryBtn]}
            onPress={handleMultiply}
          >
            <Text style={styles.btnText}>Multiply (A × B)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.accentBtn]}
            onPress={handleIsPositive}
          >
            <Text style={styles.btnText}>A &gt; 0?</Text>
          </TouchableOpacity>
        </View>

        {calcResult !== null && (
          <View style={styles.resultBox}>
            <Text style={styles.resultLabel}>RUST RESULT</Text>
            <Text style={styles.resultValue}>{calcResult}</Text>
            <Text style={styles.resultExpr}>{calcOp}</Text>
          </View>
        )}
      </View>

      {/* Card 2: String & Lifetime */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardCategory}>RUST CSTRING LIFECYCLE</Text>
          <Text style={styles.cardTitle}>Dynamic Greeting</Text>
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Recipient Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholderTextColor="#64748B"
            placeholder="Enter name..."
          />
        </View>

        <TouchableOpacity
          style={[styles.actionBtn, styles.primaryBtn, { marginTop: 12 }]}
          onPress={handleGreeting}
        >
          <Text style={styles.btnText}>Call rust_greeting()</Text>
        </TouchableOpacity>

        {greetingResult !== null && (
          <View style={styles.resultBox}>
            <Text style={styles.resultLabel}>RUST STRING RESPONSE</Text>
            <Text style={styles.resultValue}>{greetingResult}</Text>
            <Text style={styles.resultNote}>
              Allocated in Rust heap as CString, copied to JS String, freed via
              rust_string_free().
            </Text>
          </View>
        )}
      </View>

      {/* Card 3: Stateful Numeric Memory Store */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardCategory}>RUST-OWNED STATE & BUFFER COPY</Text>
          <Text style={styles.cardTitle}>16-Slot Float32 Store</Text>
        </View>

        <Text style={styles.cardDescription}>
          Rust allocates an opaque RustData struct containing a Vec&lt;f32&gt;
          of 16 slots. getValues() copies native memory into a JS Float32Array.
        </Text>

        {/* 16-slot visual grid */}
        <View style={styles.slotsGrid}>
          {dataSlots.map((val, idx) => {
            const isSelected = slotIndex === String(idx);
            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.slotItem,
                  isSelected && styles.slotItemSelected,
                  val !== 0 && styles.slotItemActive,
                ]}
                onPress={() => setSlotIndex(String(idx))}
              >
                <Text style={styles.slotIndex}>#{idx}</Text>
                <Text style={styles.slotVal} numberOfLines={1}>
                  {val.toFixed(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.inputRow}>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Slot Index (0..15)</Text>
            <TextInput
              style={styles.input}
              value={slotIndex}
              onChangeText={setSlotIndex}
              keyboardType="numeric"
              placeholderTextColor="#64748B"
              placeholder="0..15"
            />
          </View>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Float Value</Text>
            <TextInput
              style={styles.input}
              value={slotValue}
              onChangeText={setSlotValue}
              keyboardType="numeric"
              placeholderTextColor="#64748B"
              placeholder="e.g. 12.5"
            />
          </View>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.primaryBtn]}
            onPress={handleSetValue}
          >
            <Text style={styles.btnText}>Set Slot Value</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.secondaryBtn]}
            onPress={refreshSlots}
          >
            <Text style={styles.btnText}>Refresh Buffer</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statusBox}>
          <Text style={styles.statusText}>Status: {storeStatus}</Text>
        </View>
      </View>

      {/* Card 4: Verification Suite */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardCategory}>END-TO-END VALIDATION</Text>
          <Text style={styles.cardTitle}>Guide Verification Suite</Text>
        </View>

        <TouchableOpacity
          style={[styles.actionBtn, styles.verifyBtn]}
          onPress={handleRunSuite}
        >
          <Text style={styles.verifyBtnText}>
            Run All Guide Test Cases
          </Text>
        </TouchableOpacity>

        {testResults && (
          <View style={styles.suiteResults}>
            {testResults.map((t, idx) => (
              <View key={idx} style={styles.suiteRow}>
                <View
                  style={[
                    styles.passBadge,
                    t.passed ? styles.passBg : styles.failBg,
                  ]}
                >
                  <Text style={styles.passText}>
                    {t.passed ? '✓ PASS' : '✗ FAIL'}
                  </Text>
                </View>
                <View style={styles.suiteDetails}>
                  <Text style={styles.suiteCall}>{t.name}</Text>
                  <Text style={styles.suiteExpected}>
                    Expected: {t.expected} | Actual: {t.actual}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 24,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#10B981',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 6,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#161E2E',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#243046',
  },
  cardHeader: {
    marginBottom: 14,
  },
  cardCategory: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#38BDF8',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  cardDescription: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 14,
    lineHeight: 18,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  inputWrapper: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    backgroundColor: '#2563EB',
  },
  secondaryBtn: {
    backgroundColor: '#475569',
  },
  accentBtn: {
    backgroundColor: '#7C3AED',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  resultBox: {
    marginTop: 14,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#38BDF8',
  },
  resultLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#38BDF8',
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  resultExpr: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  resultNote: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
    fontStyle: 'italic',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  slotItem: {
    width: '23%',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  slotItemSelected: {
    borderColor: '#38BDF8',
    backgroundColor: '#1E293B',
  },
  slotItemActive: {
    borderColor: '#10B981',
  },
  slotIndex: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  slotVal: {
    fontSize: 13,
    color: '#F8FAFC',
    fontWeight: '700',
    marginTop: 2,
  },
  statusBox: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#0F172A',
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#64748B',
  },
  verifyBtn: {
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 12,
  },
  verifyBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  suiteResults: {
    marginTop: 14,
    gap: 8,
  },
  suiteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  passBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10,
  },
  passBg: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  failBg: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  passText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10B981',
  },
  suiteDetails: {
    flex: 1,
  },
  suiteCall: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  suiteExpected: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
});
