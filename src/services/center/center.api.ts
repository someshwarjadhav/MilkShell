import { gatewayPostJson } from '../http/client';
import { pick, rowsFrom } from '../utils/loose';
import type { Center } from '../mappers/center.mapper';


export const getCenter = (id: string): Promise<unknown> => gatewayPostJson('/home/farmercollectiondpu', { id }, 0);

const ID_KEYS = ['vlccid', 'vlcid', 'vlccode', 'centerid', 'centreid', 'villageid', 'dcsid', 'dcscode', 'id', 'code'];
const NAME_KEYS = ['villagename', 'vlccname', 'vlcname', 'centername', 'centrename', 'dcsname', 'name', 'village'];



export const cleanCentreName = (n: string): string => n.replace(/\s*\|\s*[\w-]*\s*$/, '').replace(/\s+/g, ' ').trim();

const ROUTE_ID_KEYS = ['routeid', 'routecode', 'routeno', 'route', 'routesupervisorid'];
const ROUTE_NAME_KEYS = ['routename', 'routetitle', 'routedesc'];
const STATION_KEYS = ['customstationid', 'stationid', 'stationcode', 'stationno', 'station'];

export function parseCenters(json: unknown): Center[] {
  const out: Center[] = [];
  for (const row of rowsFrom(json)) {
    const id = pick(row, ID_KEYS);
    if (!id || out.some((c) => c.id === id)) continue;
    const name = cleanCentreName(pick(row, NAME_KEYS));
    out.push({
      id,
      name,
      label: name || id,
      routeId: pick(row, ROUTE_ID_KEYS) || undefined,
      routeName: pick(row, ROUTE_NAME_KEYS) || undefined,
      stationId: pick(row, STATION_KEYS) || undefined,
      raw: row,
    });
  }
  return out;
}
