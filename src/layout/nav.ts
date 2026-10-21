import { Activity, Building2, FileSpreadsheet, GitCompareArrows, LayoutDashboard, MessageCircle, Radio, Receipt, Settings, ShieldAlert, Tags, Users, Warehouse, Workflow } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { routeFor, type MenuNode } from '../services/menu/menu.service';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  hint: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    title: 'Today',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, hint: 'Overview of today and the last 30 days' },
      { to: '/live', label: 'Live collection', icon: Radio, hint: 'Today\'s samples as the portal receives them' },
    ],
  },
  {
    title: 'Dairy',
    items: [
      { to: '/collections', label: 'Collections', icon: FileSpreadsheet, hint: 'Reports by farmer, centre, day and milk' },
      { to: '/farmers', label: 'Farmers', icon: Users, hint: 'Registered farmers and what they poured' },
      { to: '/centers', label: 'Centres', icon: Warehouse, hint: 'Your VLCs: litres, farmers and last sample' },
      { to: '/reports/unionwise', label: 'Unionwise Collection', icon: Building2, hint: 'Farmers, litres, average fat, SNF, rate and amount per union and society' },
      { to: '/reports/vlc-status', label: 'VLC Status', icon: Activity, hint: 'Which centres are active or in active for the chosen dates and shift' },
      { to: '/reports/variance', label: 'Variance Report', icon: GitCompareArrows, hint: 'DOC collection against VLC collection, with the difference' },
    ],
  },
  {
    title: 'Money',
    items: [
      { to: '/rates', label: 'Rate chart', icon: Tags, hint: 'Rates the portal applied, per milk type' },
      { to: '/billing', label: 'Billing', icon: Receipt, hint: '10-day bills and payslips' },
    ],
  },
  {
    title: 'Insight',
    items: [
      { to: '/quality', label: 'Quality watch', icon: ShieldAlert, hint: 'Adulteration and low-quality alerts' },
      { to: '/pipeline', label: 'Data pipeline', icon: Workflow, hint: 'Machine to portal to dashboard, and API status' },
      { to: '/settings', label: 'Settings', icon: Settings, hint: 'Theme and quality alert limits' },
      { to: '/contact', label: 'Contact support', icon: MessageCircle, hint: 'Send a support request or view the temporary service notice' },
    ],
  },
];

export const ALL_ITEMS: NavItem[] = NAV.flatMap((group) => group.items);

/**
 * Left menu from the getMenu API (bound once at sign-in, see services/bootstrap.ts).
 *  - A module (\"Report\") becomes a group, its forms become links.
 *  - Forms the reply switches off for this user (Status / IsActive = 0) are not shown.
 *  - Forms that are not pages of this app (Payment Voucher, Bill Unfreeze ...) are not shown.
 *  - The other pages of this app (Centres, Rate chart, Billing ...) stay under \"More\".
 *    Set VITE_MENU_ONLY=1 to show only what the API gives.
 * If NOTHING matches (menu failed or uses unknown names), the built-in NAV above is used, so the sidebar is never empty.
 */
export function buildNav(tree: MenuNode[]): NavGroup[] {
  const byRoute = new Map(ALL_ITEMS.map((i) => [i.to, i]));
  const used = new Set<string>();
  const switchedOff = new Set<string>();
  // Safety: if switching entries off would leave nothing, the switch is ignored instead of emptying the menu.
  const leaves = (ns: MenuNode[]): MenuNode[] => ns.flatMap((n) => (n.children.length ? leaves(n.children) : [n]));
  const honourSwitch = leaves(tree).some((n) => n.enabled);
  const on = (n: MenuNode) => !honourSwitch || n.enabled;

  const toItem = (n: MenuNode): NavItem | null => {
    const to = routeFor(n);
    const base = to ? byRoute.get(to) : undefined;
    if (to && !on(n)) switchedOff.add(to);
    if (!on(n) || !to || !base || used.has(to)) return null;
    used.add(to);
    return { ...base, label: n.title || base.label };
  };
  const groups: NavGroup[] = [];
  for (const root of tree) {
    if (!on(root)) continue;
    const items = root.children.length ? root.children.map(toItem).filter((x): x is NavItem => !!x) : [toItem(root)].filter((x): x is NavItem => !!x);
    if (items.length) groups.push({ title: root.title || 'Menu', items });
  }
  if (!groups.length) return NAV;
  if (import.meta.env.VITE_MENU_ONLY !== '1') {
    // A page the API switched off for this user must not come back through "More" (Settings stays always).
    const more = ALL_ITEMS.filter((i) => !used.has(i.to) && (i.to === '/settings' || !switchedOff.has(i.to)));
    if (more.length) groups.push({ title: 'More', items: more });
  }
  return groups;
}
