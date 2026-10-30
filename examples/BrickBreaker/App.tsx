import React from 'react';
import { LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigation } from './src/navigation/RootNavigation';
import { preloadGameAssets } from './src/utils/assetPreloader';

if (!__DEV__) {
  LogBox.ignoreAllLogs(true);
}
preloadGameAssets();

function App() {
  return (
    <SafeAreaProvider>
      <RootNavigation />
    </SafeAreaProvider>
  );
}

export default App;
