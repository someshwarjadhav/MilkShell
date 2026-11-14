import {
  clearRequestMemo,
  gatewayGet,
  gatewayText,
  parseGatewayText,
} from "../http/client";
import { ApiError, EmptyReplyError } from "../http/errors";
import { isObj, pick, rowsFrom, type Obj } from "../utils/loose";

const PATH = "/dairy/dairy/getMilkBillFreeze";


export const FREEZE_FIELDS = {
  id: ["autorownum", "unfreezeno", "unfreezenumber", "freezeno", "id"],
  villageId: ["villageid", "vlccid", "vlcid", "stationid"],
  villageName: ["villagename", "vlccname", "vlcname", "name"],
  start: ["startdate", "fromdate", "start"],
  end: ["enddate", "todate", "end"],
};

const query = (o: Partial<Record<string, string>>) =>
  `${PATH}?data=${encodeURIComponent(
    JSON.stringify({
      AutoRowNum: "0",
      VillageId: "",
      EntryDate: "",
      StartDate: "",
      EndDate: "",
      flag: "0",
      ...o,
    }),
  )}`;

function listFrom(json: unknown): Obj[] {
  if (isObj(json)) {
    const ok = json.Success ?? json.success;
    if (ok === false) {
      const message = String(json.Message ?? json.message ?? "").trim();
      if (!message || /no\s*record/i.test(message)) return [];
      throw new ApiError(message, "server");
    }
  }
  return rowsFrom(json);
}


export async function getBillFreezes(villageId: string): Promise<Obj[]> {
  clearRequestMemo(); 
  const json = await gatewayGet(query({ VillageId: villageId }), 1);
  return listFrom(json);
}


export async function unfreezeBill(row: Obj, villageId: string): Promise<void> {
  const text = await gatewayText(
    query({
      AutoRowNum: pick(row, FREEZE_FIELDS.id),
      VillageId: pick(row, FREEZE_FIELDS.villageId) || villageId,
      EntryDate: "",
      StartDate: "",
      EndDate: "",
      flag: "2",
    }),
    {},
    1,
  );
  let json: unknown;
  try {
    json = parseGatewayText(text);
  } catch (e) {
    if (e instanceof EmptyReplyError) return;
    throw e;
  }
  if (isObj(json)) {
    const ok = json.Success ?? json.success;
    if (ok === false) {
      throw new ApiError(
        String(json.Message ?? json.message ?? "").trim() ||
          "The server could not unfreeze this bill.",
        "server",
      );
    }
  }
}