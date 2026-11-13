import AES from "crypto-js/aes";
import Base64 from "crypto-js/enc-base64";
import Utf8 from "crypto-js/enc-utf8";
import { lib } from "crypto-js/core";

const options = (iv: lib.WordArray) => ({ iv });

function readSecret(): string {
  const raw = String(import.meta.env.VITE_ENCRYPTION_KEY ?? "").trim();
  return raw.replace(/^(['"])(.*)\1$/, "$2").trim();
}

export const hasEncryptionKey = (): boolean => readSecret().length > 0;

function getKey() {
  const secret = readSecret();
  if (!secret) {
    throw new Error(
      "VITE_ENCRYPTION_KEY is missing. Create .env.local (see .env.example) and restart `npm run dev`.",
    );
  }
  return Utf8.parse(secret);
}

export function encryptPayload(data: unknown): string {
  const iv = lib.WordArray.random(16);
  const encrypted = AES.encrypt(JSON.stringify(data), getKey(), options(iv));
  return `${encrypted.ciphertext.toString(Base64)}:${iv.toString(Base64)}`;
}

export function decryptPayload(packed: string): unknown {
  const [cipherB64, ivB64] = packed.split(":");
  if (!cipherB64 || !ivB64)
    throw new Error('Encrypted value is not in "ciphertext:iv" format.');

  const plain = AES.decrypt(
    { ciphertext: Base64.parse(cipherB64) } as unknown as string,
    getKey(),
    options(Base64.parse(ivB64)),
  ).toString(Utf8);

  if (!plain)
    throw new Error(
      "Decryption returned nothing - the key or mode does not match the server.",
    );
  try {
    return JSON.parse(plain);
  } catch {
    return plain;
  }
}

export function decryptXorPayload(b64: string): unknown {
  const key = new TextEncoder().encode(readSecret());
  if (!key.length)
    throw new Error(
      "VITE_ENCRYPTION_KEY is missing. Add it to .env.local and restart `npm run dev`.",
    );
  let clean = b64.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  while (clean.length % 4) clean += "=";
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++)
    bytes[i] = bin.charCodeAt(i) ^ key[i % key.length]!;
  const text = new TextDecoder()
    .decode(bytes)
    .replace(/^\uFEFF/, "")
    .trim();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function encryptXorPayload(data: unknown): string {
  const key = new TextEncoder().encode(readSecret());
  if (!key.length)
    throw new Error(
      "VITE_ENCRYPTION_KEY is missing. Add it to .env.local and restart `npm run dev`.",
    );
  const bytes = new TextEncoder().encode(
    typeof data === "string" ? data : JSON.stringify(data),
  );
  let bin = "";
  for (let i = 0; i < bytes.length; i++)
    bin += String.fromCharCode(bytes[i]! ^ key[i % key.length]!);
  return btoa(bin);
}

const B64_ONLY = /^[A-Za-z0-9+/_-]{16,}={0,2}$/;
const AES_PACKED = /^[A-Za-z0-9+/=]{8,}:[A-Za-z0-9+/=]{16,}$/;
const isPlainObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function openEncryptedReply(v: unknown, depth = 0): unknown {
  if (depth > 4) return v;
  if (typeof v === "string") {
    const t = v.replace(/\s+/g, "");
    let opened: unknown = v;
    try {
      if (AES_PACKED.test(t)) opened = decryptPayload(t);
      else if (B64_ONLY.test(t)) opened = decryptXorPayload(t);
    } catch {
      return v;
    }
    return typeof opened === "object" && opened !== null
      ? openEncryptedReply(opened, depth + 1)
      : v;
  }
  if (isPlainObj(v)) {
    for (const k of Object.keys(v)) {
      if (!["data", "response", "result", "payload"].includes(k.toLowerCase()))
        continue;
      const inner = v[k];
      if (typeof inner !== "string") continue;
      const opened = openEncryptedReply(inner, depth + 1);
      if (opened !== inner) return opened;
    }
  }
  return v;
}
