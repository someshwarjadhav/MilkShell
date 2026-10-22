import { ApiError } from '../http/errors';
import { fanOut, joinedWaves, needSession, type CollectionParams, type Emit, type QueryData } from '../http/fanout';
import type { RawVlccRow } from '../types/raw';

/**
 * POST /home/VlccCollection: per-VLC collection for the dates, shift and milk type.
 * The portal answers with its own figures (qty, kg, rate, amount); nothing is recomputed here.
 * Sent exactly like the portal does: one request, all VLC ids in `id` and `stationid`, `mccid` from the login.
 * The server returns HTTP 500 when `mccid` is missing, so that is checked before any request is sent.
 */
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
