import { Image as RNImage } from 'react-native';
import { Skia, SkImage } from '@shopify/react-native-skia';
import { GAME_ASSETS } from '../assets';

export const GAME_SPRITE_CACHE: Record<string, SkImage> = {};

async function loadSkiaImage(source: any): Promise<SkImage | null> {
  try {
    const resolved = RNImage.resolveAssetSource(source);
    const uri = resolved?.uri;
    if (!uri) return null;
    const data = await Skia.Data.fromURI(uri);
    if (!data) return null;
    return Skia.Image.MakeImageFromEncoded(data);
  } catch {
    return null;
  }
}

let preloadPromise: Promise<void> | null = null;

export function preloadGameAssets(): Promise<void> {
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    const assetEntries: [string, any][] = [
      ['ball_standard', GAME_ASSETS.balls.standard],
      ['ball_cyan', GAME_ASSETS.balls.cyan],
      ['paddle_standard', GAME_ASSETS.paddles.standard],
      ['paddle_long', GAME_ASSETS.paddles.long],
      ['brick_red', GAME_ASSETS.bricks.red],
      ['brick_cyan', GAME_ASSETS.bricks.cyan],
      ['brick_blue', GAME_ASSETS.bricks.blue],
      ['brick_yellow', GAME_ASSETS.bricks.yellow],
      ['brick_purple', GAME_ASSETS.bricks.purple],
      ['metal_hp4', GAME_ASSETS.bricks.metalHp4],
      ['metal_hp3', GAME_ASSETS.bricks.metalHp3],
      ['metal_hp2', GAME_ASSETS.bricks.metalHp2],
      ['metal_hp1', GAME_ASSETS.bricks.metalHp1],
      ['pu_expand', GAME_ASSETS.powerups.expand],
      ['pu_triball', GAME_ASSETS.powerups.triball],
      ['pu_extralife', GAME_ASSETS.powerups.extralife],
    ];

    await Promise.all(
      assetEntries.map(async ([key, source]) => {
        const img = await loadSkiaImage(source);
        if (img) {
          GAME_SPRITE_CACHE[key] = img;
        }
      })
    );
  })();

  return preloadPromise;
}

export function areAssetsPreloaded(): boolean {
  return (
    !!GAME_SPRITE_CACHE['ball_standard'] &&
    !!GAME_SPRITE_CACHE['paddle_standard'] &&
    !!GAME_SPRITE_CACHE['brick_red'] &&
    !!GAME_SPRITE_CACHE['metal_hp4']
  );
}

