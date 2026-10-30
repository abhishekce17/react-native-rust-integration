import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { SCREENS } from '../constant/screens';
import { RootStackParamList } from './types';
import {
  SplashScreen,
  HomeScreen,
  GameplayScreen,
} from '../features';
import { IS_ANDROID } from '../constant/measurements';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigate<RouteName extends keyof RootStackParamList>(
  name: RouteName,
  params?: RootStackParamList[RouteName]
) {
  if (navigationRef.isReady()) {
    (navigationRef as any).navigate(name, params);
  }
}

const screenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  gestureEnabled: false,
  animation: IS_ANDROID ? 'slide_from_right' : 'default',
  animationDuration: 220,
};

export const RootNavigation: React.FC = () => {
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName={SCREENS.SPLASH}
        screenOptions={screenOptions}
      >
        <Stack.Screen
          name={SCREENS.SPLASH}
          component={SplashScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen
          name={SCREENS.HOME}
          component={HomeScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen
          name={SCREENS.GAMEPLAY}
          component={GameplayScreen}
          options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
