
export const STATIC_LOGIN_RECORD: unknown | null = {
  Data: [
    {
      id: 218,
      email: 'prachidairykaladera@gmail.com',
      username: 'PRACHI',
      mccid: '119',
      mccname: 'Prachi Dairy',
      status: 1,
      SessionID: '7090801,7090802,7090803,7090804,7090805,7090806,7090807,7090808,7090809,7090810,7090811,7090812,7090813,7090814',
      CustomStationId: '0021000,0022000,0023000,0024000,0025000,0020000,0002000,0017000,0014000,0012000,0006000,0009000,0027000,0028000',
      LoginStatus: 0,
      webLogin: 0,
      PlantId: 19,
      UserAccess: '14',
      Token: '800f4bca76bb3c6efda26ddaf254a0010526x1tr',
      DataEncryption: 0,
      Address: 'Kaladera',
    },
  ],
};

export const STATIC_LOGIN_USERNAME: string = '';


export const STATIC_LOGIN_PASSWORD_SHA256: string = '4afe36d74c8f9bf52726a27ba88168a2dae49e9f751fcbdcbb33634d8d530411';


export const ABC_LOGIN_RECORD: unknown | null = {
  Data: [
    {
      id: 1,
      email: 'abc@gmail.com',
      username: 'Stipl',
      mccid: '701',
      mccname: 'Stipl',
      mobile: '9999999999',
      status: 1,
      SessionID: '7010101,7010103,7010102,7010105,7010108',
      CustomStationId: '101010',
      LoginStatus: 0,
      webLogin: 0,
      PlantId: 1,
      UserAccess: '0',
      deviceName: 'SMARTX',
      lastLogin: '2025-02-19T16:59:48',
      Token: '8be5eb4dc661add82e76dba50e68fe062625x1tr',
      DataEncryption: 0,
      GST: '07ABCDE12345',
      Address: 'Sangliii',
      logo: '',
    },
  ],
};

export const ABC_USERNAME = 'abc@gmail.com';
export const ABC_PASSWORD_SHA256 = 'ef1673ba31fbcdc89d21df47b7e6fcf2d11d703748e16e0da59ffcfc4d3f0746';

export interface StaticLoginEntry {

  username: string;

  passwordSha256: string;
  record: unknown | null;
}


export const STATIC_LOGINS: StaticLoginEntry[] = [
  { username: STATIC_LOGIN_USERNAME, passwordSha256: STATIC_LOGIN_PASSWORD_SHA256, record: STATIC_LOGIN_RECORD },
  { username: ABC_USERNAME, passwordSha256: ABC_PASSWORD_SHA256, record: ABC_LOGIN_RECORD },
];

export const staticLoginActive = (): boolean =>
  import.meta.env.VITE_STATIC_LOGIN === '1' && STATIC_LOGINS.some((e) => e.record !== null && e.record !== undefined);

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const recordEmailOf = (record: unknown): string => {
  const outer: any = Array.isArray(record) ? record[0] : record;
  const inner: any = outer && Array.isArray(outer.Data) ? outer.Data[0] : outer?.Data ?? outer;
  return typeof inner?.email === 'string' ? inner.email : '';
};

const sameUser = (entry: StaticLoginEntry, username: string): boolean => {
  const allowed = (entry.username || recordEmailOf(entry.record)).trim().toLowerCase();
  return !allowed || username.trim().toLowerCase() === allowed;
};

async function passwordOk(entry: StaticLoginEntry, password: string): Promise<boolean> {
  if (!entry.passwordSha256) return true;
  try {
    return (await sha256Hex(password)) === entry.passwordSha256.toLowerCase();
  } catch {
    return false;
  }
}

export type StaticLoginResult =
  | { kind: 'match'; record: unknown }
  | { kind: 'use-api' } 
  | { kind: 'denied' };


export async function resolveStaticLogin(username: string, password: string): Promise<StaticLoginResult> {
  for (const entry of STATIC_LOGINS) {
    if (!sameUser(entry, username)) continue;
    if (!(await passwordOk(entry, password))) continue;
    if (entry.record === null || entry.record === undefined) return { kind: 'use-api' };
    return { kind: 'match', record: entry.record };
  }
  return { kind: 'denied' };
}
