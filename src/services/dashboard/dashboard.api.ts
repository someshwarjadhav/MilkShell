import { gatewayGet, listOf, type Priority } from '../http/client';
import { fanOut, needSession, waves, type Emit } from '../http/fanout';
import type { RawLinePoint, RawTopSupplier } from '../types/raw';


export function fetchLineChart(vlccIds: string[], emit?: Emit<RawLinePoint>, priority: Priority = 1) {
  needSession();
  return fanOut<RawLinePoint>(
    waves(vlccIds, (id) => [async () => listOf<RawLinePoint>(await gatewayGet(`/home/dashboardLinechart?vlccid=${encodeURIComponent(id)}`, priority))]),
    emit,
    false,
  );
}

export function fetchTopSuppliers(vlccIds: string[], emit?: Emit<RawTopSupplier>, priority: Priority = 2) {
  needSession();
  return fanOut<RawTopSupplier>(
    waves(vlccIds, (id) => [async () => listOf<RawTopSupplier>(await gatewayGet(`/home/topMilkSupplier?vlccid=${encodeURIComponent(id)}`, priority))]),
    emit,
    false,
  );
}
