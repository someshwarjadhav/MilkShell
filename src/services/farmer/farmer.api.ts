import { gatewayPostJson, listOf, type Priority } from '../http/client';
import { adaptiveCollection, collectionWaves, fanOut, needSession, type CollectionParams, type Emit } from '../http/fanout';
import type { RawFarmerRow, RawLoose } from '../types/raw';
export const fetchFarmerCollection = (p: CollectionParams, emit?: Emit<RawFarmerRow>) =>
  adaptiveCollection<RawFarmerRow>('/home/farmercollection', p, emit);


export const fetchFarmerMilkEntry = (p: CollectionParams & { rateId: string }, emit?: Emit<RawLoose>) =>
  fanOut<RawLoose>(collectionWaves<RawLoose>('/home/FarmerMilkEntry', p, { rateid: p.rateId }), emit, true);


export function fetchFarmerMaster(vlccIds: string[], emit?: Emit<RawLoose>, priority: Priority = 1) {
  needSession();
  return fanOut<RawLoose>(
    [vlccIds.map((id) => async () => (listOf<RawLoose>(await gatewayPostJson('/home/farmermaster', { VillageIds: id }, priority))).map((r) => ({ ...r, vlccid: id })))],
    emit,
    false,
  );
}
