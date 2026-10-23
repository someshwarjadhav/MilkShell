import { gatewayPostJson, listOf, type Priority } from '../http/client';
import { adaptiveCollection, collectionWaves, fanOut, needSession, type CollectionParams, type Emit } from '../http/fanout';
import type { RawFarmerRow, RawLoose } from '../types/raw';
import type { QueryData } from '../http/fanout';
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

export const getFarmer = (vlcid: string, priority: Priority = 1): Promise<unknown> => {
  needSession();
  return gatewayPostJson('/home/farmermaster', { VillageIds: vlcid }, priority);
};

export async function fetchFarmersOf(vlcid: string): Promise<QueryData<RawLoose>> {
  const rows = listOf<RawLoose>(await getFarmer(vlcid)).map((r) => ({ ...r, vlccid: vlcid }));
  return { rows, failed: 0, total: 1, done: 1 };
}
