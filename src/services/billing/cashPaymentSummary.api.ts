import { gatewayGet } from "../http/client";
import { ApiError } from "../http/errors";
import { isObj, rowsFrom, type Obj } from "../utils/loose";

export type SummaryType = "farmer" | "vlc";

export const SUMMARY_TYPES: Array<{
  id: SummaryType;
  label: string;
  path: string;
}> = [
  { id: "farmer", label: "Farmer", path: "/home/MilkBillPayCashma" },
  { id: "vlc", label: "VLC", path: "/home/MilkBillPaySummVLCC" },
];

export interface SummaryQuery {
  type: SummaryType;
  fromdate: string;
  todate: string;
  stationid: string;
}

export async function getCashSummary(q: SummaryQuery): Promise<Obj[]> {
  const path = SUMMARY_TYPES.find((t) => t.id === q.type)!.path;
  const qs =
    `id=0&fromdate=${encodeURIComponent(q.fromdate)}` +
    `&todate=${encodeURIComponent(q.todate)}` +
    `&stationid=${encodeURIComponent(q.stationid)}`;
  const json = await gatewayGet(`${path}?${qs}`, 1);

  if (isObj(json)) {
    const ok = json.Success ?? json.success;
    if (ok === false) {
      const message = String(json.Message ?? json.message ?? "").trim();
      if (/no\s*record/i.test(message)) return [];
      throw new ApiError(
        message || "The server did not return a summary.",
        "server",
      );
    }
  }
  return rowsFrom(json);
}
