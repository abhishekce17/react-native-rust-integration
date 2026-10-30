import { Dimensions, Platform } from 'react-native';

export const { height: WindowHeight, width: WindowWidth } = Dimensions.get('window');
export const { height: ScreenHeight, width: ScreenWidth } = Dimensions.get('screen');

export const IS_IOS = Platform.OS === 'ios';
export const IS_ANDROID = Platform.OS === 'android';

export const HORIZONTAL_PADDING = 16;
export const HUD_HEIGHT = 135;
export const DOCK_HEIGHT = 110;
export const PADDLE_STANDARD_WIDTH = 96;
export const PADDLE_WIDE_WIDTH = 138;
export const PADDLE_HEIGHT = 16;
export const BALL_RADIUS = 9;
export const POWERUP_RADIUS = 16;
