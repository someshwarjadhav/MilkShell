import { ApiError } from '../http/errors';
import { fanOut, joinedWaves, needSession, type CollectionParams, type Emit, type QueryData } from '../http/fanout';
import type { RawVlccRow } from '../types/raw';

export function fetchVlccCollection(p: CollectionParams, emit?: Emit<RawVlccRow>): Promise<QueryData<RawVlccRow>> {
  const s = needSession();
  if (!s.mccId) {
    throw new ApiError(
      'MCC id is missing. Put VITE_MCC_ID=709 in .env.local and restart `npm run dev`, or sign in again.',
      'config',
    );
  }
  return fanOut<RawVlccRow>(joinedWaves('/home/VlccCollection', p), emit, true);
}
