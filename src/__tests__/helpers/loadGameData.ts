import { installFsFetch } from './fsFetch';
import { initializeGameData } from '@/lib/data';
import { GameData } from '@/types/data';

let cached: GameData | null = null;

export async function loadFullGameData(): Promise<GameData> {
  if (cached) return cached;
  installFsFetch();
  cached = await initializeGameData();
  return cached;
}
