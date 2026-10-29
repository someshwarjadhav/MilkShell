import { useMemo } from "react";
import { useMenuTree } from "../hooks/useSessionData";
import { ALWAYS_OPEN_ROUTES } from "../config/reportAccess";
import { routeFor, urlKey, type MenuNode } from "../services/menu/menu.api";
import { norm } from "../services/utils/loose";
import {
  APP_PAGES,
  APP_PAGE_LEAVES,
  MORE_ICON,
  NAV_MODULES,
  type NavForm,
  type NavLeaf,
  type NavModule,
  type NavSection,
} from "./navConfig";

export type { NavLeaf, NavSection } from "./navConfig";

export const ALL_ITEMS: NavLeaf[] = APP_PAGE_LEAVES;

const slug = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const hintFor = (route: string) =>
  APP_PAGE_LEAVES.find((p) => p.to === route)?.hint;
const labelFor = (route: string) =>
  APP_PAGE_LEAVES.find((p) => p.to === route)?.label;

const FALLBACK_NAV: NavSection[] = APP_PAGES.slice(0, 1).map((s) => ({
  ...s,
  items: s.items.slice(0, 1),
}));

const RATE_MASTER_ROUTE = "/master/excel-rate-upload";

export function buildNav(tree: MenuNode[]): NavSection[] {
  const leavesOf = (ns: MenuNode[]): MenuNode[] =>
    ns.flatMap((n) => (n.children.length ? leavesOf(n.children) : [n]));

  const honourSwitch = leavesOf(tree).some((n) => n.enabled);
  const on = (n: MenuNode) => !honourSwitch || n.enabled;

  const used = new Set<string>();
  const switchedOff = new Set<string>();

  const moduleOf = (title: string): NavModule | undefined =>
    NAV_MODULES.find((m) => norm(m.name) === norm(title));
  const formOf = (node: MenuNode, mod?: NavModule): NavForm | undefined => {
    const key = norm(urlKey(node.url));
    const title = norm(node.title);
    const pool = mod?.children ?? NAV_MODULES.flatMap((m) => m.children ?? []);
    return (
      (key ? pool.find((f) => norm(f.key) === key) : undefined) ??
      pool.find((f) => norm(f.name) === title)
    );
  };

  const toLeaf = (
    node: MenuNode,
    mod: NavModule | undefined,
    moduleTitle: string,
    apiIndex: number,
  ): { leaf: NavLeaf; order: number } | null => {
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
      to =
        alias ??
        `/portal/${slug(moduleTitle)}/${slug(urlKey(node.url) || node.title || String(apiIndex))}`;
    }
    if (!on(node)) {
      if (built) switchedOff.add(to);
      return null;
    }
    if (built) {
      if (used.has(to)) return null;
      used.add(to);
    }
    const order =
      sf && mod?.children ? mod.children.indexOf(sf) : 1000 + apiIndex;
    const label =
      to === RATE_MASTER_ROUTE
        ? "Rate Master"
        : node.title || sf?.name || labelFor(to) || "Menu";
    return {
      leaf: { to, label, hint: hintFor(to) ?? moduleTitle, built, portalPath },
      order,
    };
  };

  const sections: Array<{ section: NavSection; order: number }> = [];
  tree.forEach((root, rootIndex) => {
    if (!on(root)) return;
    const mod = moduleOf(root.title);
    const title = mod?.name ?? (root.title || "Menu");
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
          items: [
            {
              to: mod.route,
              label: root.title || mod.name,
              hint: hintFor(mod.route),
              built: true,
              portalPath: mod.url,
            },
          ],
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
    sections.push({
      order,
      section: { id: slug(title), title, icon: mod?.icon ?? MORE_ICON, items },
    });
  });

  const result = sections
    .sort((a, b) => a.order - b.order)
    .map((s) => s.section);

  return result.length ? result : FALLBACK_NAV;
}

export function useNav(): NavSection[] {
  const tree = useMenuTree();
  return useMemo(() => buildNav(tree), [tree]);
}

export function isRouteAllowed(
  sections: NavSection[],
  pathname: string,
): boolean {
  if (ALWAYS_OPEN_ROUTES.includes(pathname)) return true;
  return sections.some((s) =>
    s.items.some(
      (i) =>
        i.to === pathname || (i.to !== "/" && pathname.startsWith(`${i.to}/`)),
    ),
  );
}

export const hasRoute = (sections: NavSection[], route: string): boolean =>
  sections.some((s) => s.items.some((i) => i.to === route));

export const flattenNav = (
  sections: NavSection[],
): Array<NavLeaf & { section: string }> => {
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

export const isActivePath = (to: string, pathname: string) =>
  to === "/"
    ? pathname === "/"
    : pathname === to || pathname.startsWith(`${to}/`);
