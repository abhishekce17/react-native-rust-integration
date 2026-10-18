import React, { useEffect, useState } from 'react';
import { Button, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import NativeRustEngine from './specs/NativeRustEngine';

export default function App(): React.JSX.Element {
  const [status, setStatus] = useState('Installing JSI Host Function…');
  const [result, setResult] = useState<number | null>(null);

  useEffect(() => {
    try {
      // One-time startup hook: enters the C++ TurboModule and installs the
      // global JSI Host Function. It does not perform the addition itself.
      NativeRustEngine.install();

      if (typeof globalThis.RustEngine?.add !== 'function') {
        throw new Error('RustEngine.add was not installed');
      }

      setStatus('JSI Host Function installed successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Installation failed: ${message}`);
    }
  }, []);

  const callRust = () => {
    try {
      const engine = globalThis.RustEngine;
      if (!engine) {
        throw new Error('RustEngine is not installed yet');
      }

      // Actual gameplay call: Hermes -> JSI Host Function -> C++ -> Rust.
      const value = engine.add(20, 22);
      setResult(value);
      setStatus('Success: Hermes → JSI → C++ → Rust');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Call failed: ${message}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Oxide Engine</Text>
        <Text style={styles.subtitle}>Hermes + JSI + C++ + Rust</Text>
        <Text style={styles.status}>{status}</Text>
        <Button title="Call Rust: 20 + 22" onPress={callRust} />
        <Text style={styles.result}>
          Result: {result === null ? 'Not called yet' : result}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#10141c',
  },
  card: {
    gap: 16,
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#1b2330',
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#b8c7dc',
    fontSize: 16,
  },
  status: {
    color: '#e3eaf4',
    fontSize: 14,
  },
  result: {
    color: '#72e6a2',
    fontSize: 24,
    fontWeight: '700',
  },
});
