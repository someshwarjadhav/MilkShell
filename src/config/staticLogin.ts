/**
 * TEMPORARY static login, for the time the deployed domain is not allowed to call the sign-in API.
 *
 * How it works: when VITE_STATIC_LOGIN=1 AND STATIC_LOGIN_RECORD below is filled, the sign-in API is NOT called.
 * The saved (already decrypted) login JSON below is used instead, exactly as if the server had answered with it.
 * While STATIC_LOGIN_RECORD is null the app signs in through the real API as before.
 *
 * To fill it:
 *   1. Run `npm run dev` locally and sign in normally as the user (the real API works from localhost).
 *   2. Open the browser console (F12). Copy the JSON printed after "[static-login] paste this".
 *      (It is the decrypted login reply with the password already removed. You can also take it from Postman.)
 *   3. Paste it as the value of STATIC_LOGIN_RECORD below, then build and upload.
 *
 * SECURITY: everything in this file ends up in the public JavaScript of the deployed site, including the token.
 * Use it only until the domain is allowed, then delete this file's record (set it back to null) and redeploy.
 */

/** Decrypted login JSON (without password). null = static login off. */
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

/** Optional: only this username/email may use the static login. Empty = the email inside the record is used. */
export const STATIC_LOGIN_USERNAME: string = '';

/**
 * Optional: SHA-256 (hex, lowercase) of the password. Empty = the password is not checked.
 * Make the hash in the browser console:  crypto.subtle.digest('SHA-256', new TextEncoder().encode('PASSWORD')).then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('')))
 * (A hash in client code only stops casual use; it is not real security.)
 */
export const STATIC_LOGIN_PASSWORD_SHA256: string = '4afe36d74c8f9bf52726a27ba88168a2dae49e9f751fcbdcbb33634d8d530411';

export const staticLoginActive = (): boolean =>
  import.meta.env.VITE_STATIC_LOGIN === '1' && STATIC_LOGIN_RECORD !== null && STATIC_LOGIN_RECORD !== undefined;

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** true when the typed login may use the static record. */
export async function staticLoginAllows(username: string, password: string, recordEmail?: string): Promise<boolean> {
  const allowed = (STATIC_LOGIN_USERNAME || recordEmail || '').trim().toLowerCase();
  if (allowed && username.trim().toLowerCase() !== allowed) return false;
  if (STATIC_LOGIN_PASSWORD_SHA256) {
    try {
      return (await sha256Hex(password)) === STATIC_LOGIN_PASSWORD_SHA256.toLowerCase();
    } catch {
      return false;
    }
  }
  return true;
}