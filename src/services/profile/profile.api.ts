import { BASE_URL, REQUEST_TIMEOUT_MS } from '../config';
import { ApiError } from '../http/errors';
import { getSavedLoginRecord } from '../bootstrap';
import { isObj, pick, pickLike, rowsFrom, type Obj } from '../utils/loose';


const HOST = BASE_URL || 'https://smartx.shivinfotech.co.in';
const UPDATE_URL = `${HOST}/home/profileupdate`;
const GET_VILLAGE_URL = `${HOST}/home/GetVillage`;


export interface Profile {
  id: string;
  username: string;
  mccname: string;
  email: string;
  password: string;
  mobile: string;
  Address: string;
  GST: string;
  SessionID: string;
  logo: File | null;
  
  logoUrl: string;
}

export const emptyProfile = (): Profile => ({
  id: '', username: '', mccname: '', email: '', password: '',
  mobile: '', Address: '', GST: '', SessionID: '', logo: null, logoUrl: '',
});


export function resolveLogoUrl(v: string): string {
  const t = (v ?? '').trim();
  if (!t) return '';
  if (/^(https?:|data:|blob:)/i.test(t)) return t;
  return `${HOST}/${t.replace(/^~?\/+/, '')}`;
}

const first = (json: unknown): Obj | null => {
  if (Array.isArray(json)) return json.find(isObj) ?? null;
  if (isObj(json)) {
    const rows = rowsFrom(json);
    return rows[0] ?? json;
  }
  return null;
};

export function profileFromRecord(json: unknown, fallback: Partial<Profile> = {}): Profile {
  const r = first(json) ?? {};
  const base = { ...emptyProfile(), ...fallback };
  return {
    ...base,
    id: pick(r, ['id', 'userid', 'loginid', 'uid']) || base.id,
    username: pick(r, ['username', 'user', 'loginname', 'name']) || base.username,
    mccname: pick(r, ['mccname', 'plantname', 'dairyname']) || base.mccname,
    email: pick(r, ['email', 'emailid', 'emailaddress']) || base.email,
    mobile: pick(r, ['mobile', 'mobileno', 'mobilenumber', 'phone', 'contact']) || base.mobile,
    Address: pick(r, ['address']) || base.Address,
    GST: pick(r, ['gst', 'gstno', 'gstnumber']) || base.GST,
    SessionID: pick(r, ['sessionid', 'vlccid']) || base.SessionID,
    
    password: pick(r, ['password', 'pwd', 'pass']) || base.password,
    logo: null,
    logoUrl: resolveLogoUrl(pick(r, ['logo', 'logopath', 'logourl', 'image', 'photo', 'profileimage']) || pickLike(r, ['logo', 'photo', 'avatar', 'profilepic', 'image'])) || base.logoUrl,
  };
}


export const getProfileFromSession = (fallback: Partial<Profile> = {}): Profile =>
  profileFromRecord(getSavedLoginRecord(), fallback);

const clean = (t: string) => t.replace(/[\r\n]+/g, ' ').trim();

async function call(url: string, init: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (res.status === 401 || res.status === 403)
      throw new ApiError('Your session was rejected by the server. Please sign in again.', 'auth');
    const text = clean(await res.text());
    if (!res.ok) {
      const body = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
      throw new ApiError(`The server answered with error ${res.status}${body ? `: ${body}` : '.'}`, 'server');
    }
    if (!text) return null;
    if (text.startsWith('<')) throw new ApiError('The server returned a web page instead of data.', 'parse');
    try {
      let json: unknown = JSON.parse(text);
      if (typeof json === 'string') { try { json = JSON.parse(json); } catch {} }
      return json;
    } catch {
      return text;
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (controller.signal.aborted) throw new ApiError(`The server took longer than ${REQUEST_TIMEOUT_MS / 1000} seconds to answer.`, 'timeout');
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 'network');
  } finally {
    clearTimeout(timer);
  }
}


export async function getVillageInfo(loginId: string, fallback: Partial<Profile> = {}): Promise<Profile> {
  const json = await call(`${GET_VILLAGE_URL}?loginid=${encodeURIComponent(loginId)}`, { method: 'GET', cache: 'no-store' });
  console.log('[profile] GetVillage response:', json);
  return profileFromRecord(json, fallback);
}

export interface ProfileErrors { [k: string]: string }

export function validateProfile(p: Profile): ProfileErrors {
  const e: ProfileErrors = {};
  if (!p.username.trim()) e.username = 'Username is required';
  if (!p.mccname.trim()) e.mccname = 'MCC name is required';
  if (!/^\S+@\S+\.\S+$/.test(p.email.trim())) e.email = 'Enter a valid email address';
  if (!/^\d{10}$/.test(p.mobile.trim())) e.mobile = 'Mobile number must be 10 digits';
  if (p.password && p.password.length < 4) e.password = 'Password must be at least 4 characters';
  if (p.GST.trim() && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i.test(p.GST.trim())) e.GST = 'Enter a valid 15 character GST number';
  if (p.logo && !/^image\//.test(p.logo.type)) e.logo = 'Logo must be an image file';
  if (p.logo && p.logo.size > 2 * 1024 * 1024) e.logo = 'Logo must be smaller than 2 MB';
  return e;
}


export async function updateProfile(p: Profile): Promise<string> {
  const body = new FormData();
  body.append('id', p.id);
  body.append('username', p.username.trim());
  body.append('mccname', p.mccname.trim());
  body.append('email', p.email.trim());
  body.append('mobile', p.mobile.trim());
  body.append('Address', p.Address.trim());
  body.append('GST', p.GST.trim().toUpperCase());
  body.append('SessionID', p.SessionID);
  if (p.password) body.append('password', p.password);
  if (p.logo) body.append('logo', p.logo, p.logo.name);

  const reply = await call(UPDATE_URL, { method: 'POST', body });

  if (isObj(reply)) {
    const message = String(reply.Message ?? reply.message ?? reply.msg ?? '').trim();
    const flag = reply.Success ?? reply.success ?? reply.status;
    const failed = flag === false || /^(false|fail|failed|error)$/i.test(String(flag ?? ''));
    if (failed) throw new ApiError(message || 'The profile could not be updated.', 'server');
    return message || 'Profile updated successfully';
  }
  if (typeof reply === 'string' && /^(false|fail|failed|error)/i.test(reply)) throw new ApiError(reply, 'server');
  return typeof reply === 'string' && reply && reply.length < 120 ? reply : 'Profile updated successfully';
}