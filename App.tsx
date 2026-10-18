import React, { useState } from 'react';
import {
  Keyboard,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { RustEngine } from './src/RustEngine';

// Pure 1-by-1 sequential loop computing actual summation (1 + 2 + ... + N)
function jsRunLoop(iterations: number): number {
  let sum = 0.0;
  const limit = Math.floor(iterations);
  for (let k = 1; k <= limit; k++) {
    sum += k;
  }
  return sum;
}

export default function App() {
  const [inputValue, setInputValue] = useState<string>('1000000');
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [rustTime, setRustTime] = useState<number | null>(null);
  const [jsTime, setJsTime] = useState<number | null>(null);
  const [rustResult, setRustResult] = useState<number | null>(null);
  const [jsResult, setJsResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runBenchmark = (count: number) => {
    Keyboard.dismiss();
    setError(null);

    if (isNaN(count) || count <= 0) {
      setError('Please enter a valid positive number');
      return;
    }

    if (count > 200_000_000) {
      setError('Value is too large. Keep under 200,000,000 to prevent Hermes timeout.');
      return;
    }

    setActiveCount(count);

    try {
      // 1. Rust via JSI (Staticlib)
      const startRust = Date.now();
      const rRes = RustEngine.run_loop(count);
      const elapsedRust = Date.now() - startRust;

      setRustResult(rRes);
      setRustTime(elapsedRust);

      // 2. Pure JavaScript (Hermes)
      const startJs = Date.now();
      const jRes = jsRunLoop(count);
      const elapsedJs = Date.now() - startJs;

      setJsResult(jRes);
      setJsTime(elapsedJs);
    } catch (e: any) {
      setError(e?.message || 'Benchmark execution error');
    }
  };

  const handleCustomSubmit = () => {
    const parsed = parseFloat(inputValue.replace(/,/g, ''));
    runBenchmark(parsed);
  };

  const handlePresetSelect = (preset: number) => {
    setInputValue(preset.toString());
    runBenchmark(preset);
  };

  const getSpeedup = () => {
    if (rustTime === null || jsTime === null) return null;
    if (rustTime === 0) {
      return jsTime > 0 ? `${jsTime}x+` : 'Instant';
    }
    const ratio = jsTime / rustTime;
    return `${ratio.toFixed(1)}x`;
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.content}>
          <Text style={styles.title}>Oxide Benchmark</Text>
          <Text style={styles.subtitle}>
            Rust (JSI Staticlib) vs JavaScript (Hermes)
          </Text>

          {error ? (
            <View style={[styles.card, styles.errorCard]}>
              <Text style={styles.errorTitle}>Error</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Custom Input Section */}
          <View style={styles.card}>
            <Text style={styles.label}>Custom Iterations</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={inputValue}
                onChangeText={setInputValue}
                keyboardType="decimal-pad"
                placeholder="Enter loop count (e.g. 5000000 or 10.5)"
                placeholderTextColor="#64748b"
                returnKeyType="done"
                onSubmitEditing={handleCustomSubmit}
              />
              <TouchableOpacity
                style={styles.runButton}
                onPress={handleCustomSubmit}>
                <Text style={styles.runButtonText}>RUN</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Presets */}
            <Text style={[styles.label, styles.presetLabel]}>Quick Presets</Text>
            <View style={styles.buttonRow}>
              {[100_000, 1_000_000, 10_000_000, 50_000_000].map(count => (
                <TouchableOpacity
                  key={count}
                  style={[
                    styles.presetButton,
                    activeCount === count && styles.presetButtonActive,
                  ]}
                  onPress={() => handlePresetSelect(count)}>
                  <Text
                    style={[
                      styles.presetButtonText,
                      activeCount === count && styles.presetButtonTextActive,
                    ]}>
                    {count >= 1_000_000
                      ? `${count / 1_000_000}M`
                      : `${count / 1_000}k`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Results Comparison Grid */}
          <View style={styles.gridRow}>
            {/* Rust Card */}
            <View style={[styles.gridCard, styles.rustCard]}>
              <Text style={styles.cardHeader}>🦀 RUST (JSI)</Text>
              
              <Text style={styles.metricLabel}>TIME</Text>
              <Text style={styles.metricValue}>
                {rustTime !== null ? `${rustTime} ms` : '—'}
              </Text>

              <View style={styles.sumDivider} />

              <Text style={styles.metricLabel}>COMPUTED SUM</Text>
              <Text style={styles.sumValue}>
                {rustResult !== null ? rustResult.toLocaleString() : '—'}
              </Text>
            </View>

            {/* JS Card */}
            <View style={[styles.gridCard, styles.jsCard]}>
              <Text style={styles.cardHeader}>⚡ JAVASCRIPT</Text>
              
              <Text style={styles.metricLabel}>TIME</Text>
              <Text style={styles.metricValue}>
                {jsTime !== null ? `${jsTime} ms` : '—'}
              </Text>

              <View style={styles.sumDivider} />

              <Text style={styles.metricLabel}>COMPUTED SUM</Text>
              <Text style={styles.sumValue}>
                {jsResult !== null ? jsResult.toLocaleString() : '—'}
              </Text>
            </View>
          </View>

          {/* Speedup Banner */}
          {rustTime !== null && jsTime !== null ? (
            <View style={styles.speedupCard}>
              <Text style={styles.speedupLabel}>Performance Difference</Text>
              <Text style={styles.speedupHighlight}>
                Rust is {getSpeedup()} faster
              </Text>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f8fafc',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  label: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  presetLabel: {
    marginTop: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
  },
  runButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  runButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetButton: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  presetButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#60a5fa',
  },
  presetButtonText: {
    color: '#94a3b8',
    fontWeight: 'bold',
    fontSize: 13,
  },
  presetButtonTextActive: {
    color: '#ffffff',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  gridCard: {
    flex: 1,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
  },
  rustCard: {
    backgroundColor: '#1e293b',
    borderColor: '#38bdf8',
  },
  jsCard: {
    backgroundColor: '#1e293b',
    borderColor: '#fbbf24',
  },
  cardHeader: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#94a3b8',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  sumDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 10,
  },
  sumValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#38bdf8',
  },
  speedupCard: {
    backgroundColor: '#064e3b',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#059669',
  },
  speedupLabel: {
    fontSize: 12,
    color: '#6ee7b7',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  speedupHighlight: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ecfdf5',
  },
  errorCard: {
    borderColor: '#ef4444',
    backgroundColor: '#450a0a',
  },
  errorTitle: {
    color: '#f87171',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
  },
});
