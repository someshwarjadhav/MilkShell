import {
  clearRequestMemo,
  gatewayText,
  listOf,
  parseGatewayText,
} from "../http/client";
import { openDpuReply } from "../http/dpu";
import { DPU_HOST } from "../http/dpuEndpoints";
import { getSession } from "../session";
import { ApiError, EmptyReplyError } from "../http/errors";
import {
  isObj,
  norm,
  pick,
  pickValue,
  rowsFrom,
  type Obj,
} from "../utils/loose";

const BASE = `${DPU_HOST}/api/Login`;

// DPU server APIs (same as the DPUSyncAsyncService of the DPU project):
//   POST {DPU}/home/farmermaster          body { VillageIds: "7030974,7030978" }
//   GET  {DPU}/home/UpdateFarmerBuff?villageid=..&farmerids=..
// The /api/Login/... paths are only a fallback. STIPL is not used here any more.
const LIST_URLS = [
  `${DPU_HOST}/home/farmermaster`,
  `${BASE}/FarmerMaster`,
];

const UPDATE_URLS = [
  `${DPU_HOST}/home/UpdateFarmerBuff`,
  `${BASE}/UpdateFarmerBuff`,
];
let workingUpdateUrl: string | null = null;

const authHeaders = (): Record<string, string> => {
  const token = getSession()?.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const q = encodeURIComponent;

export const SYNC_FIELDS = {
  farmerId: ["farmerid", "farmer", "farmercode", "memberid", "id"],
  farmerName: ["farmername", "name", "membername"],
  
  sync: [
    "farmerbuff", 
    "buff",
    "bufflag",
    "isbuff",
    "syncflag",
    "syncstatus",
    "sync",
    "isync",
    "issync",
    "dpusync",
    "dpustatus",
    "syncasync",
    "ischecked",
    "checked",
    "isselected",
    "flag",
  ],
};

export interface SyncMember {

  id: string;
  name: string;

  synced: boolean;
 
  flagKnown: boolean;
}

const isOn = (v: unknown): boolean => {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v !== "string") return false;
  return /^(1|true|y|yes|s|sync|synced|checked|active)$/i.test(v.trim());
};

function readSync(raw: Obj): { on: boolean; known: boolean } {
  const direct = pickValue(raw, SYNC_FIELDS.sync);
  if (direct !== undefined && direct !== null && direct !== "")
    return { on: isOn(direct), known: true };
  
  const likeKey = Object.keys(raw).find((k) => /buff|sync/i.test(k));
  if (likeKey) return { on: isOn(raw[likeKey]), known: true };
 
  const exists = Object.keys(raw).some((k) =>
    SYNC_FIELDS.sync.includes(norm(k)),
  );
  return { on: false, known: exists };
}


function toList(json: unknown): Obj[] {
  if (isObj(json)) {
    const ok = json.Success ?? json.success;
    if (ok === false) {
      const message = String(json.Message ?? json.message ?? "").trim();
      if (!message || /no\s*(record|data|farmer)/i.test(message)) return [];
      throw new ApiError(message, "server");
    }
  }
  try {
    return listOf<Obj>(json).filter(isObj);
  } catch {
    return rowsFrom(json);
  }
}

export async function getSyncMembers(villageId: string): Promise<SyncMember[]> {
  clearRequestMemo(); 
  let text = "";
  for (let i = 0; i < LIST_URLS.length; i++) {
    const url = LIST_URLS[i]!;
    try {
      text = await gatewayText(
        url,
        {
          method: "POST",
          
          headers: {
            "Content-Type": "application/json",
            ...(url.startsWith(BASE) ? authHeaders() : {}),
          },
          body: JSON.stringify({ VillageIds: villageId }),
          cache: "no-store", 
        },
        1,
        true,
      );
      console.debug("[dpu-sync-async] list read from", url);
      break;
    } catch (e) {
      console.warn("[dpu-sync-async] list failed on", url, e instanceof Error ? e.message : e);
      if (i === LIST_URLS.length - 1) throw e;
    }
  }
  const json = openDpuReply(parseGatewayText(text), 0, true);
  const list = toList(json);

  if (list.length > 0) {
    const first = list[0]!;
    console.debug(
      "[dpu-sync-async] first row from farmermaster (check the sync field name here):",
      first,
    );
    if (!readSync(first).known) {
      console.warn(
        "[dpu-sync-async] no Sync/Async column recognised. Fields in the reply:",
        Object.keys(first),
        "-> add the right one to SYNC_FIELDS.sync in dpuSyncAsync.api.ts",
      );
    }
  }

  return list
    .map((raw): SyncMember => {
      const s = readSync(raw);
      return {
        id: pick(raw, SYNC_FIELDS.farmerId),
        name: pick(raw, SYNC_FIELDS.farmerName),
        synced: s.on,
        flagKnown: s.known,
      };
    })
    .filter((m) => m.id);
}


export async function updateSyncMembers(
  villageId: string,
  farmerIds: string[],
): Promise<void> {
  const qs = `?villageid=${q(villageId)}&farmerids=${q(farmerIds.join(","))}`;
  const urls = workingUpdateUrl
    ? [workingUpdateUrl, ...UPDATE_URLS.filter((u) => u !== workingUpdateUrl)]
    : UPDATE_URLS;
  let text = "";
  for (let i = 0; i < urls.length; i++) {
    try {
      text = await gatewayText(
        urls[i]! + qs,
        {
          method: "GET",
          
          headers: urls[i]!.startsWith(BASE) ? authHeaders() : {},
          cache: "no-store",
        },
        1,
        true,
      );
      workingUpdateUrl = urls[i]!;
      break;
    } catch (e) {
      const notFound = e instanceof ApiError && /error (404|405)\b/.test(e.message);
      console.warn(`[dpu-sync-async] update ${urls[i]} failed:`, e instanceof Error ? e.message : e);
      if (!notFound) throw e;
      if (i === urls.length - 1) {
        throw new ApiError(
          "The update API (UpdateFarmerBuff) was not found on the server (404 on every path tried). Ask for the exact endpoint name from the Swagger page and put it in UPDATE_URLS in dpuSyncAsync.api.ts.",
          "server",
        );
      }
    }
  }
  clearRequestMemo();

  let json: unknown;
  try {
    json = openDpuReply(parseGatewayText(text), 0, true);
  } catch (e) {
    if (e instanceof EmptyReplyError) return; 

    const t = text.trim();
    if (t && !t.startsWith("<") && !/^(error|fail|exception)/i.test(t)) return;
    throw e;
  }
  if (isObj(json)) {
    const ok = json.Success ?? json.success;
    if (ok === false) {
      throw new ApiError(
        String(json.Message ?? json.message ?? "").trim() ||
          "The server could not update the Sync/Async status.",
        "server",
      );
    }
  } else if (typeof json === "string" && /^(error|fail|exception)/i.test(json.trim())) {
    throw new ApiError(json.trim(), "server");
  }
}