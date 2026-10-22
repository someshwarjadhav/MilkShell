import { gatewayPostJson } from '../http/client';
import { pick, rowsFrom } from '../utils/loose';
import type { Center } from '../mappers/center.mapper';


export const getCenter = (id: string): Promise<unknown> => gatewayPostJson('/home/farmercollectiondpu', { id }, 0);

const ID_KEYS = ['vlccid', 'vlcid', 'vlccode', 'centerid', 'centreid', 'villageid', 'dcsid', 'dcscode', 'id', 'code'];
const NAME_KEYS = ['villagename', 'vlccname', 'vlcname', 'centername', 'centrename', 'dcsname', 'name', 'village'];


export function parseCenters(json: unknown): Center[] {
  const out: Center[] = [];
  for (const row of rowsFrom(json)) {
    const id = pick(row, ID_KEYS);
    if (!id || out.some((c) => c.id === id)) continue;
    const name = pick(row, NAME_KEYS);
    out.push({ id, name, label: name || id, raw: row });
  }
  return out;
}
