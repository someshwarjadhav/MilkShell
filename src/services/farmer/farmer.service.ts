import { gatewayPostJson, listOf, type Priority } from '../http/client';
import { adaptiveCollection, collectionWaves, fanOut, needSession, type CollectionParams, type Emit } from '../http/fanout';
import type { RawFarmerRow, RawLoose } from '../types/raw';

/** POST /home/farmercollection: every farmer sample for the dates, shift and milk type. */
export const fetchFarmerCollection = (p: CollectionParams, emit?: Emit<RawFarmerRow>) =>
  adaptiveCollection<RawFarmerRow>('/home/farmercollection', p, emit);

/** POST /home/FarmerMilkEntry: farmer-wise entries. Same fields as the other reports, plus `rateid`. */
export const fetchFarmerMilkEntry = (p: CollectionParams & { rateId: string }, emit?: Emit<RawLoose>) =>
  fanOut<RawLoose>(collectionWaves<RawLoose>('/home/FarmerMilkEntry', p, { rateid: p.rateId }), emit, true);

/**
 * POST /home/farmermaster with JSON { VillageIds: "<one VLC id>" }, exactly as the portal sends it.
 * The reply is { success, data: [{ farmer, farmername, mobileno, dcsname, farmerstatus, farmerbuff, bank fields... }] }
 * and does NOT say which VLC a farmer belongs to (farmer ids repeat across VLCs), so one request is made per VLC
 * and every row is tagged with its `vlccid` here.
 */
export function fetchFarmerMaster(vlccIds: string[], emit?: Emit<RawLoose>, priority: Priority = 1) {
  needSession();
  return fanOut<RawLoose>(
    [vlccIds.map((id) => async () => (listOf<RawLoose>(await gatewayPostJson('/home/farmermaster', { VillageIds: id }, priority))).map((r) => ({ ...r, vlccid: id })))],
    emit,
    false,
  );
}
