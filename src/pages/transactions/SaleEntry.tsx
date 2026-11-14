import type * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, PackageCheck, Save, ShoppingCart, Trash2 } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select } from "../../components/ui/Fields";
import { Modal } from "../../components/ui/Modal";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { MilkLoader } from "../../components/MilkLoader";
import {
  CardTitle,
  ReportBar,
  ReportPage,
  Reveal,
} from "../../components/ReportKit";
import { ErrorBlock } from "../../components/Widget";
import { useSmoothLoading } from "../../hooks/useSmoothLoading";
import { useCentreOptions } from "../../hooks/useCentres";
import { useToast } from "../../context/ToastContext";
import { exportExcel, type ExportCol } from "../../lib/export";
import { todayISO } from "../../lib/format";
import { DEFAULT_PAGE_SIZE } from "../../lib/global";
import { vlccCode, vlccName } from "../../services/vlcc/names";
import { ApiError } from "../../services/http/errors";
import { getFarmers } from "../../services/transaction/farmerMilk.api";
import {
  CATEGORIES,
  deleteSale,
  getItems,
  getSales,
  getStock,
  getVendors,
  plantIdOf,
  saveSale,
  stationOf,
  typesFor,
  type ItemOption,
  type Option,
  type SaleCategory,
  type SaleQuery,
  type SaleRow,
} from "../../services/transaction/saleEntry.api";

const msg = (e: unknown, fallback: string) =>
  e instanceof ApiError ? e.message : fallback;

const n = (s: string): number => {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
};
const two = (v: number) => (Math.round(v * 100) / 100).toFixed(2);
const flagName = (f: string) => {
  const u = f.toUpperCase();
  return ["S", "SA", "SALE", "SALES"].includes(u)
    ? "Sale"
    : ["P", "PU", "PURCHASE"].includes(u)
      ? "Purchase"
      : f;
};

const readOnlyInput = "bg-soft/60 text-right tnum";

const SaleEntry: React.FC = () => {
  const toast = useToast();
  const centres = useCentreOptions();
  const plantId = plantIdOf();

  const [category, setCategory] = useState<SaleCategory>("S");
  const [type, setType] = useState(typesFor("S")[0]!.value);
  const [vlc, setVlc] = useState("");
  const [party, setParty] = useState("");
  const [date, setDate] = useState(todayISO());
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("");
  const [rate, setRate] = useState("");
  const [paid, setPaid] = useState("0");

  const [items, setItems] = useState<ItemOption[]>([]);
  const [parties, setParties] = useState<Option[]>([]);
  const [stock, setStock] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);

  const [applied, setApplied] = useState<SaleQuery | null>(null);
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const showLoader = useSmoothLoading(loading);
  const [listError, setListError] = useState<string | null>(null);
  const [needle, setNeedle] = useState("");
  const listTicket = useRef(0);

  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<SaleRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const vlcId = vlc || centres[0]?.id || "";
  const types = typesFor(category);
  const partyLabel = category === "S" ? "Farmer" : "Vendor";
  
  const useFarmers = type === "F";
  const stationNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of centres) m.set(stationOf(c.id), vlccName(c.id) || c.label);
    return m;
  }, [centres]);
  const amount = n(qty) * n(rate);

  
  useEffect(() => {
    let alive = true;
    getItems(plantId)
      .then((list) => {
        if (!alive) return;
        setItems(list);
        const first = list[0];
        if (first) {
          setItemId((cur) => cur || first.id);
          setRate((cur) => cur || first.rate);
        }
      })
      .catch((e) => {
        console.error("[SaleEntry] items failed:", e);
        if (alive) setSetupError(msg(e, "The item list could not be loaded."));
      });
    return () => {
      alive = false;
    };
  }, [plantId]);

  
  useEffect(() => {
    if (!vlcId) return;
    let alive = true;
    setParties([]);
    setParty("");
    const load: Promise<Option[]> =
      useFarmers
        ? getFarmers(vlcId).then((list) =>
            list.map((f) => ({
              id: f.farmerId,
              label: `${f.farmerId.padStart(4, "0")} | ${f.name}`,
            })),
          )
        : getVendors(vlcId);
    load
      .then((list) => {
        if (!alive) return;
        setParties(list);
        setParty(list[0]?.id ?? "");
        setSetupError(null);
      })
      .catch((e) => {
        console.error("[SaleEntry] farmers/vendors failed:", e);
        if (alive) setSetupError(msg(e, `The ${partyLabel.toLowerCase()} list could not be loaded.`));
      });
    return () => {
      alive = false;
    };
  }, [vlcId, useFarmers, partyLabel]);

  
  useEffect(() => {
    setType((cur) => (typesFor(category).some((t) => t.value === cur) ? cur : typesFor(category)[0]!.value));
  }, [category]);

  // stock of the chosen item
  useEffect(() => {
    if (!itemId || !date) {
      setStock("");
      return;
    }
    let alive = true;
    getStock(plantId, itemId, date, date)
      .then((s) => alive && setStock(s))
      .catch((e) => {
        console.error("[SaleEntry] stock failed:", e);
        if (alive) setStock("");
      });
    return () => {
      alive = false;
    };
  }, [plantId, itemId, date]);

  const pickItem = (id: string) => {
    setItemId(id);
    const it = items.find((x) => x.id === id);
    if (it?.rate) setRate(it.rate);
  };

  const show = async () => {
    if (!vlcId || !date || loading) return;
    const query: SaleQuery = { vlcid: vlcId, date, flag: category, plantId };
    setApplied(query);
    setLoading(true);
    setListError(null);
    setNeedle("");
    const mine = ++listTicket.current;
    try {
      const list = await getSales(query);
      if (mine !== listTicket.current) return;
      setRows(list);
    } catch (e) {
      if (mine !== listTicket.current) return;
      setRows([]);
      setListError(msg(e, "The entries could not be loaded."));
    } finally {
      if (mine === listTicket.current) setLoading(false);
    }
  };

  const problem = (): string | null => {
    if (!vlcId) return "Select a VLC";
    if (!party) return `Select a ${partyLabel.toLowerCase()}`;
    if (!itemId) return "Select an item";
    if (n(qty) <= 0) return "Enter a quantity greater than 0";
    if (n(rate) < 0 || rate.trim() === "") return "Enter the rate";
    if (n(paid) < 0) return "Paid amount cannot be negative";
    if (n(paid) > amount + 0.004) return "Paid amount cannot be more than the amount";
    const have = parseFloat(stock);
    if (category === "S" && Number.isFinite(have) && n(qty) > have)
      return `Quantity is more than the stock (${stock})`;
    return null;
  };

  const canSave = !!vlcId && !!party && !!itemId && n(qty) > 0 && rate.trim() !== "";

  const submit = async () => {
    if (saving) return;
    const why = problem();
    if (why) return toast(why, "warn");
    setSaving(true);
    try {
      const reply = await saveSale({
        vlcid: vlcId,
        category,
        farmerId: party,
        date,
        itemId,
        qty: n(qty),
        rate: n(rate),
        paid: n(paid),
        plantId,
      });
      toast(reply || "Record saved");
      setQty("");
      setPaid("0");
      void getStock(plantId, itemId, date, date).then(setStock).catch(() => undefined);
      void show();
    } catch (e) {
      console.error("[SaleEntry] SAVE FAILED:", e);
      toast(msg(e, "The entry could not be saved."), "warn");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    const row = toDelete;
    if (!row || !applied || deleting) return;
    setDeleting(true);
    try {
      await deleteSale(row, applied);
      setRows((all) => all.filter((r) => r.key !== row.key));
      toast("Entry deleted");
      setToDelete(null);
      void getStock(plantId, itemId, date, date).then(setStock).catch(() => undefined);
    } catch (e) {
      console.error("[SaleEntry] DELETE FAILED:", e);
      toast(msg(e, "The entry could not be deleted."), "warn");
    } finally {
      setDeleting(false);
    }
  };

  const visible = useMemo(() => {
    const s = needle.trim().toLowerCase();
    return s
      ? rows.filter((r) =>
          [r.id, r.date, vlccCode(r.stationId), r.farmerId, r.farmerName, r.item, r.qty, r.rate, r.amount, flagName(r.flag)]
            .join(" ")
            .toLowerCase()
            .includes(s),
        )
      : rows;
  }, [rows, needle]);

  const columns: Column<SaleRow>[] = useMemo(() => {
    const sortVal = (v: string) => (v !== "" && Number.isFinite(Number(v)) ? Number(v) : v);
    return [
      { key: "id", header: "Id", sort: (r) => sortVal(r.id), cell: (r) => r.id || "—" },
      { key: "date", header: "Date", sort: (r) => r.date, cell: (r) => r.date || "—" },
      { key: "station", header: "Station Id", sort: (r) => sortVal(vlccCode(r.stationId)), cell: (r) => vlccCode(r.stationId) || "—" },
      {
        key: "vlc",
        header: "VLC Name",
        sort: (r) => vlccName(r.stationId) || stationNames.get(r.stationId) || "",
        cell: (r) => vlccName(r.stationId) || stationNames.get(r.stationId) || "—",
      },
      { key: "fid", header: "Farmer Id", sort: (r) => sortVal(r.farmerId), cell: (r) => r.farmerId || "—" },
      { key: "fname", header: "Farmer", sort: (r) => r.farmerName, cell: (r) => r.farmerName || "—" },
      { key: "item", header: "Item", sort: (r) => r.item, cell: (r) => r.item || "—" },
      { key: "qty", header: "Qty", align: "right", sort: (r) => n(r.qty), cell: (r) => r.qty || "—" },
      { key: "rate", header: "Rate", align: "right", sort: (r) => n(r.rate), cell: (r) => r.rate || "—" },
      { key: "amount", header: "Amount", align: "right", sort: (r) => n(r.amount), cell: (r) => r.amount || "—" },
      { key: "flag", header: "Flag", sort: (r) => r.flag, cell: (r) => flagName(r.flag) || "—" },
      {
        key: "action",
        header: "Action",
        align: "center",
        cell: (r) => (
          <Button
            size="sm"
            variant="danger"
            aria-label="Delete entry"
            icon={<Trash2 size={14} />}
            disabled={deleting}
            onClick={() => setToDelete(r)}
          />
        ),
      },
    ];
  }, [deleting, stationNames]);

  const exportCols: ExportCol<SaleRow>[] = useMemo(
    () => [
      { header: "Id", value: (r) => r.id },
      { header: "Date", value: (r) => r.date },
      { header: "Station Id", value: (r) => vlccCode(r.stationId) },
      { header: "VLC Name", value: (r) => vlccName(r.stationId) || stationNames.get(r.stationId) || "" },
      { header: "Farmer Id", value: (r) => r.farmerId },
      { header: "Farmer", value: (r) => r.farmerName },
      { header: "Item", value: (r) => r.item },
      { header: "Qty", value: (r) => r.qty },
      { header: "Rate", value: (r) => r.rate },
      { header: "Amount", value: (r) => r.amount },
      { header: "Flag", value: (r) => flagName(r.flag) },
    ],
    [stationNames],
  );

  return (
    <ReportPage title="Cattle Feed Sale">
      <Reveal delay={0.05}>
        <Card>
          <CardHeader
            title={<CardTitle icon={ShoppingCart}>Cattle Feed Sale/Purchase</CardTitle>}
          />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
            <Field label="Category">
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value as SaleCategory)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Type">
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                {types.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="VLC Name">
              <Select value={vlcId} onChange={(e) => setVlc(e.target.value)}>
                {centres.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={partyLabel}>
              <Select value={party} onChange={(e) => setParty(e.target.value)}>
                {parties.length === 0 && <option value="">Select…</option>}
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Sale Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Item">
              <Select value={itemId} onChange={(e) => pickItem(e.target.value)}>
                {items.length === 0 && <option value="">Select…</option>}
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Stock">
              <Input readOnly tabIndex={-1} value={stock} placeholder="—" className={readOnlyInput} />
            </Field>
            <Field label="Qty">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="text-right"
              />
            </Field>

            <Field label="Rate">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="text-right"
              />
            </Field>
            <Field label="Amount">
              <Input readOnly tabIndex={-1} value={amount > 0 ? two(amount) : ""} className={readOnlyInput} />
            </Field>
            <Field label="Paid Amount" className="sm:col-span-2 lg:col-span-1">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
                className="text-right"
              />
            </Field>
            <div className="hidden lg:block" aria-hidden />

            <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2 sm:gap-4 lg:col-span-4">
              <Button
                className="w-full"
                icon={<Eye size={16} />}
                loading={loading}
                disabled={!vlcId || !date}
                onClick={() => void show()}
              >
                Show
              </Button>
              <Button
                className="w-full bg-ok text-white hover:bg-ok/90"
                icon={<Save size={16} />}
                loading={saving}
                disabled={!canSave}
                onClick={() => void submit()}
              >
                Submit
              </Button>
            </div>
          </div>
        </Card>
      </Reveal>

      {setupError && (
        <ErrorBlock message={setupError} onRetry={() => window.location.reload()} compact />
      )}

      {applied && (
        <Reveal delay={0.1}>
          <Card>
            <ReportBar
              count={visible.length}
              hideCount={loading || !!listError}
              disabled={loading || !!listError || visible.length === 0}
              kinds={["xls"]}
              onExport={() =>
                exportExcel(
                  `sale-entry-${applied.vlcid}-${applied.date}-${applied.flag}`,
                  exportCols,
                  visible,
                )
              }
              left={
                <div className="w-full sm:w-56">
                  <Input
                    placeholder="Search any column"
                    value={needle}
                    onChange={(e) => setNeedle(e.target.value)}
                  />
                </div>
              }
            />
            {showLoader ? (
              <MilkLoader label="Loading entries…" />
            ) : listError ? (
              <ErrorBlock message={listError} onRetry={() => void show()} />
            ) : visible.length === 0 ? (
              <p className="flex items-center justify-center gap-2 px-6 py-10 text-center text-sm text-mute">
                <PackageCheck size={16} />
                {rows.length === 0 ? "No entry for these filters." : "Nothing matches your search."}
              </p>
            ) : (
              <DataTable
                columns={columns}
                rows={visible}
                rowKey={(r) => r.key}
                pageSize={DEFAULT_PAGE_SIZE}
                pageSizes={[10, 25, 50, 100, 250]}
                sizeLabel="Result per page"
              />
            )}
          </Card>
        </Reveal>
      )}

      <Modal
        open={!!toDelete}
        onClose={() => (deleting ? undefined : setToDelete(null))}
        title="Delete this entry?"
        subtitle="This cannot be undone."
        width="max-w-md"
        footer={
          <>
            <Button variant="ghost" disabled={deleting} onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              loading={deleting}
              onClick={() => void confirmDelete()}
            >
              Delete
            </Button>
          </>
        }
      >
        {toDelete && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-mute">Date</dt>
            <dd className="font-semibold">{toDelete.date || "—"}</dd>
            <dt className="text-mute">{partyLabel} Id</dt>
            <dd className="font-semibold">{toDelete.farmerId || "—"}</dd>
            <dt className="text-mute">Item</dt>
            <dd className="font-semibold break-words">{toDelete.item || "—"}</dd>
            <dt className="text-mute">Qty / Rate</dt>
            <dd className="font-semibold">
              {toDelete.qty || "—"} / {toDelete.rate || "—"}
            </dd>
            <dt className="text-mute">Amount</dt>
            <dd className="font-semibold">{toDelete.amount || "—"}</dd>
          </dl>
        )}
      </Modal>
    </ReportPage>
  );
};

export default SaleEntry;