import { asFlag } from "../report/report.api";
import { gatewayGet } from "../http/client";
import {
  isObj,
  norm,
  pick,
  pickLike,
  pickValue,
  rowsFrom,
  type Obj,
} from "../utils/loose";

export const getMenu = (userid: string): Promise<unknown> =>
  gatewayGet(
    `/dairy/dairy/Getmilkshellmenu?userid=${encodeURIComponent(userid)}`,
    0,
  );


export interface MenuNode {
  id: string;
  title: string;
  url: string;
  children: MenuNode[];

  enabled: boolean;
}

const TITLE_KEYS = [
  "formname",
  "modulename",
  "menuname",
  "menutitle",
  "title",
  "name",
  "label",
  "displayname",
  "text",
  "pagename",
  "formname",
  "menu",
];
const URL_KEYS = [
  "formclassname",
  "url",
  "link",
  "path",
  "route",
  "routerlink",
  "menuurl",
  "pageurl",
  "navigateurl",
  "href",
  "formurl",
  "action",
];
const ID_KEYS = ["menuid", "id", "pageid", "formid"];
const PARENT_KEYS = [
  "parentid",
  "parentmenuid",
  "parent",
  "pid",
  "parentmenu",
  "mainmenuid",
];
const CHILD_KEYS = [
  "children",
  "submenu",
  "submenus",
  "childmenu",
  "childmenus",
  "items",
  "menus",
  "subitems",
  "child",
  "subs",
];

function enabledOf(row: Obj): boolean {
  for (const k of [
    "isactive",
    "status",
    "isenabled",
    "enabled",
    "isvisible",
    "visible",
  ]) {
    const key = Object.keys(row).find((x) => norm(x) === k);
    if (key !== undefined && asFlag(row[key]) === false) return false;
  }
  return true;
}

function nodeOf(row: Obj, index: number): { node: MenuNode; parent: string } {
  let inner = pickValue(row, CHILD_KEYS);

  if (!Array.isArray(inner))
    inner = Object.values(row).find(
      (v) => Array.isArray(v) && v.length > 0 && v.every(isObj),
    );
  return {
    node: {
      id:
        pick(row, ID_KEYS) ||
        pickLike(row, ["id"], ["parent", "pid", "user", "role", "icon"]) ||
        `m${index}`,
      title:
        pick(row, TITLE_KEYS) ||
        pickLike(
          row,
          ["name", "title", "caption", "label", "text", "menu", "desc"],
          [
            "id",
            "icon",
            "parent",
            "url",
            "link",
            "path",
            "route",
            "image",
            "img",
            "class",
          ],
        ),
      url:
        pick(row, URL_KEYS) ||
        pickLike(
          row,
          ["url", "link", "path", "route", "href", "page", "form"],
          ["id", "name", "title", "icon", "image", "parent"],
        ),
      enabled: enabledOf(row),
      children: Array.isArray(inner)
        ? inner.filter(isObj).map((r, i) => nodeOf(r, i).node)
        : [],
    },
    parent:
      pick(row, PARENT_KEYS) || pickLike(row, ["parent"], ["name", "title"]),
  };
}

export function parseMenu(json: unknown): MenuNode[] {
  const entries = rowsFrom(json).map(nodeOf);
  const byId = new Map(entries.map((e) => [e.node.id, e.node]));
  const roots: MenuNode[] = [];
  for (const { node, parent } of entries) {
    const host =
      parent && parent !== "0" && parent !== node.id
        ? byId.get(parent)
        : undefined;
    if (host) host.children.push(node);
    else roots.push(node);
  }
  return roots;
}

const ROUTES: Array<{ to: string; aliases: string[] }> = [
  { to: "/", aliases: ["dashboard", "home", "index"] },
  { to: "/live", aliases: ["livecollection", "live", "livedata"] },
  {
    to: "/collections",
    aliases: ["collections", "farmercollection", "villagecollection"],
  },
  {
    to: "/reports/farmerwise",
    aliases: ["farmerwisecollection", "farmerwise"],
  },
  {
    to: "/reports/vlcc",
    aliases: ["vlcccollection", "vlccollection", "vlcccollectionreport"],
  },
  { to: "/reports/cleaning", aliases: ["cleaningreport", "cleaning"] },
  { to: "/reports/eko-calibration", aliases: ["ekocalibration"] },
  {
    to: "/transactions/vlc-milk-entry",
    aliases: ["vlcmilkentry", "bmcmilkentry", "vlcmilkcollection"],
  },
  {
    to: "/transactions/farmer-milk-entry",
    aliases: ["farmermilkentry", "farmermilkcollection"],
  },
  { to: "/transactions/manage-collection", aliases: ["managecollection"] },
  { to: "/master/vlc-master", aliases: ["vlcmaster"] },
  {
    to: "/farmers",
    aliases: [
      "farmers",
      "farmer",
      "farmerledger",
      "farmermaster",
      "farmerlist",
    ],
  },
  {
    to: "/centers",
    aliases: ["centers", "centres", "center", "centre", "vlcc"],
  },
  { to: "/rates", aliases: ["ratechart", "rates", "rate"] },
  { to: "/billing", aliases: ["billing", "tendaybill", "payslip"] },
  {
    to: "/billing/farmer-bill",
    aliases: ["farmerbill", "farmerbillsinglecode"],
  },
  { to: "/billing/standard-deduction", aliases: ["commissionmaster", "standarddeduction"] },
  { to: "/billing/vlc-standard-deduction", aliases: ["commissionmasterowner", "vlcstandarddeduction"] },
  {
    to: "/billing/bank-payment-summary",
    aliases: ["paymentsummarysinglecode", "bankpaymentsummary"],
  },
  {
    to: "/billing/cattlefeed-farmer-bill",
    aliases: ["farmerbillcattlefeed", "cattlefeedfarmerbill"],
  },
  { to: "/quality", aliases: ["quality", "qualitywatch"] },
  { to: "/pipeline", aliases: ["pipeline", "datapipeline"] },
  {
    to: "/reports/unionwise",
    aliases: [
      "unionwisecollection",
      "unionwise",
      "unionwisereport",
      "mccwisecollection",
      "mccwisecolection",
      "mccwise",
    ],
  },
  {
    to: "/reports/vlc-status",
    aliases: ["vlcstatus", "vlccstatus", "vlcstatusreport"],
  },
  { to: "/reports/variance", aliases: ["variancereport", "variance"] },
  { to: "/settings", aliases: ["settings"] },
  {
    to: "/contact",
    aliases: ["contact", "contactsupport", "mysupportticket", "supportticket"],
  },
];

const CONTAINED = [
  "farmercollection",
  "villagecollection",
  "livecollection",
  "farmerledger",
  "ratechart",
  "farmerwisecollection",
  "vlcccollection",
  "unionwisecollection",
  "mccwisecollection",
  "variancereport",
  "vlcstatus",
];

export const urlKey = (url: string) =>
  norm(
    url
      .replace(/^[a-z]+:\/\/[^/]+/i, "")
      .split(/[?#]/)[0]
      .split("/")
      .filter(Boolean)
      .pop() ?? "",
  );

export function routeFor(node: MenuNode): string | null {
  const candidates = [urlKey(node.url), norm(node.title)].filter(Boolean);
  for (const c of candidates) {
    const hit = ROUTES.find((r) => r.aliases.includes(c));
    if (hit) return hit.to;
  }
  for (const c of candidates) {
    const alias = CONTAINED.find((a) => c.includes(a));
    if (alias) return ROUTES.find((r) => r.aliases.includes(alias))!.to;
  }
  return null;
}
