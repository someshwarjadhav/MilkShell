import type { VlcRecord } from "./vlcMaster.api";

const loadXlsx = () => import("xlsx");

export const VLC_EXCEL_COLUMNS = [
  "Village Id",
  "Village Name",
  "Agent Name",
  "Contact",
  "Status",
  "PCB No",
  "EUP Pass",
] as const;

export async function exportVlcMaster(
  rows: VlcRecord[],
  name = "VillageMaster",
) {
  const XLSX = await loadXlsx();
  const aoa: Array<Array<string | number>> = [
    [...VLC_EXCEL_COLUMNS],
    ...rows.map((r) => [
      r.displayId || r.villageId,
      r.villageName,
      r.agentName,
      r.contact,
      r.active ? "Active" : "Inactive",
      r.pcbNo,
      r.ekoPass,
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [14, 28, 22, 16, 10, 14, 12].map((wch) => ({ wch }));

  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (const c of [0, 3, 5, 6])
    for (let r = 1; r <= range.e.r; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell) {
        cell.t = "s";
        cell.v = String(cell.v ?? "");
        cell.z = "@";
      }
    }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "VillageMaster");
  XLSX.writeFile(wb, `${name}.xlsx`, { compression: true });
}
