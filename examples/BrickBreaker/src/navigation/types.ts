import { SCREENS } from '../constant/screens';

export type RootStackParamList = {
  [SCREENS.SPLASH]: undefined;
  [SCREENS.HOME]: undefined;
  [SCREENS.GAMEPLAY]: { level?: number } | undefined;
};
