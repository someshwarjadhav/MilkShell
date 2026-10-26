import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMenuTree } from '../hooks/useSessionData';
import { COLLECTION_REPORTS, REPORT_LABELS, billingFor, canOpenReport, reportsFor } from '../config/reportAccess';
import { routeFor, urlKey, type MenuNode } from '../services/menu/menu.api';
import { norm } from '../services/utils/loose';
import {
  APP_PAGES,
  APP_PAGE_LEAVES,
  MORE_ICON,
  NAV_MODULES,
  type NavForm,
  type NavLeaf,
  type NavModule,
  type NavSection,
} from './navConfig';

export type { NavLeaf, NavSection } from './navConfig';

export const ALL_ITEMS: NavLeaf[] = APP_PAGE_LEAVES;

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const hintFor = (route: string) => APP_PAGE_LEAVES.find((p) => p.to === route)?.hint;
const labelFor = (route: string) => APP_PAGE_LEAVES.find((p) => p.to === route)?.label;

const RATE_MASTER_ROUTE = '/master/excel-rate-upload';

export function buildNav(tree: MenuNode[]): NavSection[] {
  const leavesOf = (ns: MenuNode[]): MenuNode[] => ns.flatMap((n) => (n.children.length ? leavesOf(n.children) : [n]));

  const honourSwitch = leavesOf(tree).some((n) => n.enabled);
  const on = (n: MenuNode) => !honourSwitch || n.enabled;

  const used = new Set<string>();
  const switchedOff = new Set<string>();

  const moduleOf = (title: string): NavModule | undefined => NAV_MODULES.find((m) => norm(m.name) === norm(title));
  const formOf = (node: MenuNode, mod?: NavModule): NavForm | undefined => {
    const key = norm(urlKey(node.url));
    const title = norm(node.title);
    const pool = mod?.children ?? NAV_MODULES.flatMap((m) => m.children ?? []);
    return (key ? pool.find((f) => norm(f.key) === key) : undefined) ?? pool.find((f) => norm(f.name) === title);
  };

  const toLeaf = (node: MenuNode, mod: NavModule | undefined, moduleTitle: string, apiIndex: number): { leaf: NavLeaf; order: number } | null => {
    const sf = formOf(node, mod);
    let to: string;
    let built = false;
    let portalPath: string | undefined;
    if (sf) {
      portalPath = sf.url;
      built = !!sf.route;
      to = sf.route ?? `/portal${sf.url}`;
    } else {
      const alias = routeFor(node);
      built = !!alias;
      to = alias ?? `/portal/${slug(moduleTitle)}/${slug(urlKey(node.url) || node.title || String(apiIndex))}`;
    }
    if (!on(node)) {
      if (built) switchedOff.add(to);
      return null;
    }
    if (built) {
      if (used.has(to)) return null;
      used.add(to);
    }
    const order = sf && mod?.children ? mod.children.indexOf(sf) : 1000 + apiIndex;
    const label =
      to === RATE_MASTER_ROUTE ? 'Rate Master' : node.title || sf?.name || labelFor(to) || 'Menu';
    return {
      leaf: { to, label, hint: hintFor(to) ?? moduleTitle, built, portalPath },
      order,
    };
  };

  const sections: Array<{ section: NavSection; order: number }> = [];
  tree.forEach((root, rootIndex) => {
    if (!on(root)) return;
    const mod = moduleOf(root.title);
    const title = mod?.name ?? (root.title || 'Menu');
    const order = mod ? NAV_MODULES.indexOf(mod) : 1000 + rootIndex;

    if (mod && !mod.children && mod.route) {
      if (root.children.length && !root.children.some(on)) return;
      if (used.has(mod.route)) return;
      used.add(mod.route);
      sections.push({
        order,
        section: {
          id: slug(title),
          title,
          icon: mod.icon,
          to: mod.route,
          items: [{ to: mod.route, label: root.title || mod.name, hint: hintFor(mod.route), built: true, portalPath: mod.url }],
        },
      });
      return;
    }

    const forms = root.children.length ? root.children : [root];
    if (root.children.length && !root.children.some(on)) return;
    const items = forms
      .map((n, i) => toLeaf(n, mod, title, i))
      .filter((x): x is { leaf: NavLeaf; order: number } => !!x)
      .sort((a, b) => a.order - b.order)
      .map((x) => x.leaf);
    if (!items.length) return;
    sections.push({ order, section: { id: slug(title), title, icon: mod?.icon ?? MORE_ICON, items } });
  });

  const result = sections.sort((a, b) => a.order - b.order).map((s) => s.section);
  if (!result.length) return APP_PAGES;

  if (import.meta.env.VITE_MENU_ONLY !== '1') {
    const more = APP_PAGE_LEAVES.filter((i) => !used.has(i.to) && (i.to === '/settings' || !switchedOff.has(i.to)));
    if (more.length) result.push({ id: 'more', title: 'More', icon: MORE_ICON, items: more });
  }
  return result;
}

export function applyReportAccess(sections: NavSection[], email?: string | null): NavSection[] {
  const own = reportsFor(email);
  const cleaned = sections
    .map((s) => ({ ...s, items: s.items.filter((i) => canOpenReport(email, i.to)) }))
    .filter((s) => s.to || s.items.length > 0);
  const leafOf = (to: string): NavLeaf => ({ to, label: REPORT_LABELS[to]?.label ?? to, hint: REPORT_LABELS[to]?.hint ?? 'Report', built: true });

  if (!own) {
    const sec = cleaned.find((s) => s.id === 'report');
    const missing = COLLECTION_REPORTS.filter((to) => !sec?.items.some((i) => i.to === to)).map(leafOf);
    if (!missing.length) return cleaned;
    if (sec) return cleaned.map((s) => (s === sec ? { ...s, items: [...s.items, ...missing] } : s));
    return [...cleaned.slice(0, 1), { id: 'report', title: 'Report', icon: BarChart3, items: missing }, ...cleaned.slice(1)];
  }

  const leaves: NavLeaf[] = own.map(leafOf);
  const reportSection: NavSection = { id: 'report', title: 'Report', icon: BarChart3, items: leaves };
  const mine = new Set(own);

  const others = cleaned
    .filter((s) => s.id !== 'report')
    .map((s) => (s.to ? s : { ...s, items: s.items.filter((i) => !mine.has(i.to)) }))
    .filter((s) => s.to || s.items.length > 0);

  const at = cleaned.findIndex((s) => s.id === 'report');
  const insertAt = at >= 0 ? cleaned.slice(0, at).filter((s) => s.id !== 'report' && others.includes(s)).length : Math.min(1, others.length);
  return [...others.slice(0, insertAt), reportSection, ...others.slice(insertAt)];
}

export function applyBilling(sections: NavSection[], email?: string | null): NavSection[] {
  const names = billingFor(email);
  if (!names) return sections;
  const mod = NAV_MODULES.find((m) => m.name === 'Billing');
  if (!mod?.children) return sections;

  const items: NavLeaf[] = names.map((name) => {
    const f = [...mod.children!].reverse().find((x) => norm(x.name) === norm(name));
    const built = !!f?.route;
    return {
      to: f?.route ?? `/portal${f?.url ?? `/billing/${slug(name)}`}`,
      label: name,
      hint: 'Billing',
      built,
      portalPath: f?.url,
    };
  });
  const billing: NavSection = { id: 'billing', title: 'Billing', icon: mod.icon, items };

  const rest = sections
    .filter((s) => s.id !== 'billing')
    .map((s) => (s.to ? s : { ...s, items: s.items.filter((i) => i.to !== '/billing') }))
    .filter((s) => s.to || s.items.length > 0);
  const after = rest.findIndex((s) => s.id === 'transactions');
  const before = rest.findIndex((s) => s.id === 'settings' || s.id === 'support' || s.id === 'more');
  const at = after >= 0 ? after + 1 : before >= 0 ? before : rest.length;
  return [...rest.slice(0, at), billing, ...rest.slice(at)];
}

export function useNav(): NavSection[] {
  const tree = useMenuTree();
  const { user } = useAuth();
  return useMemo(() => applyBilling(applyReportAccess(buildNav(tree), user?.email), user?.email), [tree, user?.email]);
}

export const flattenNav = (sections: NavSection[]): Array<NavLeaf & { section: string }> => {
  const seen = new Set<string>();
  const out: Array<NavLeaf & { section: string }> = [];
  for (const s of sections) {
    for (const i of s.items) {
      if (seen.has(i.to)) continue;
      seen.add(i.to);
      out.push({ ...i, section: s.title });
    }
  }
  return out;
};

export const isActivePath = (to: string, pathname: string) => (to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`));