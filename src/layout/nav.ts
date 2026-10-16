import { FileSpreadsheet, LayoutDashboard, MessageCircle, Radio, Receipt, Settings, ShieldAlert, Tags, Truck, Users, Warehouse, Workflow } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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
      { to: '/live', label: 'Live collection', icon: Radio, hint: 'Watch entries arrive from the machines' },
    ],
  },
  {
    title: 'Dairy',
    items: [
      { to: '/collections', label: 'Collections', icon: FileSpreadsheet, hint: 'Reports by farmer, centre, day and milk' },
      { to: '/farmers', label: 'Farmers', icon: Users, hint: 'Members, ledgers and advances' },
      { to: '/centers', label: 'Centres & devices', icon: Warehouse, hint: 'VLC, MCC, BMC and machines' },
    ],
  },
  {
    title: 'Money',
    items: [
      { to: '/rates', label: 'Rate chart', icon: Tags, hint: 'Fat and SNF rates per milk type' },
      { to: '/billing', label: 'Billing', icon: Receipt, hint: '10-day bills and payslips' },
      { to: '/sales', label: 'Milk sales', icon: Truck, hint: 'Dispatch to plants and customers' },
    ],
  },
  {
    title: 'Insight',
    items: [
      { to: '/quality', label: 'Quality watch', icon: ShieldAlert, hint: 'Adulteration and low-quality alerts' },
      { to: '/pipeline', label: 'Data pipeline', icon: Workflow, hint: 'Machine to app to cloud' },
      { to: '/settings', label: 'Settings', icon: Settings, hint: 'Theme, alert limits, demo data' },
      { to: '/contact', label: 'Contact support', icon: MessageCircle, hint: 'Send a support request or view the temporary service notice' },
    ],
  },
];

export const ALL_ITEMS: NavItem[] = NAV.flatMap((group) => group.items);
