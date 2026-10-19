import { gatewayPostJson } from '../http/client';
import { pick, rowsFrom } from '../utils/loose';
import type { Center } from '../mappers/center.mapper';

/**
 * Angular:
 *   getCenter(id) { return this.http.post(`${environment.staticIP}/home/farmercollectiondpu`, { id }, { responseType: 'text' })
 *                       .pipe(map(r => JSON.parse(r.replace(/[\r\n]+/g, '').trim()))); }
 *
 * Same call here: JSON body { id }, the reply is TEXT, \r\n are stripped, then JSON.parse
 * (gatewayPostJson -> parseGatewayText does exactly that).
 * `id` = the "station" id column of the decrypted login record.
 */
export const getCenter = (id: string): Promise<unknown> => gatewayPostJson('/home/farmercollectiondpu', { id }, 0);

const ID_KEYS = ['vlccid', 'vlcid', 'vlccode', 'centerid', 'centreid', 'villageid', 'dcsid', 'dcscode', 'id', 'code'];
const NAME_KEYS = ['villagename', 'vlccname', 'vlcname', 'centername', 'centrename', 'dcsname', 'name', 'village'];

/**
 * getCenter reply -> the centre list that every combo box shows.
 * If your reply uses other key names, add them to ID_KEYS / NAME_KEYS above (npm run dev prints the keys at sign-in).
 */
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
