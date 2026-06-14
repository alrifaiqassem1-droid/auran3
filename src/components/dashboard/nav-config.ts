import {
  LayoutDashboard, ScanLine, Package, Truck,
  ClipboardList, TriangleAlert, Bell, Settings,
  Upload, BarChart3, Barcode, CalendarClock, Shield, Building2,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { UserRole } from '@/types/db';

export type NavItem = {
  key: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  roles?: UserRole[];
  isFab?: boolean;
};

export const navItems: NavItem[] = [
  { key: 'home',          href: '/dashboard',                   icon: LayoutDashboard },
  { key: 'receiving',     href: '/dashboard/receiving',         icon: Truck },
  { key: 'scan',          href: '/dashboard/scan',              icon: ScanLine, isFab: true },
  { key: 'inventory',     href: '/dashboard/count',             icon: ClipboardList },
  { key: 'stocktake',    href: '/dashboard/stocktake',         icon: ClipboardList },
  { key: 'damaged',       href: '/dashboard/damaged',           icon: TriangleAlert },
  { key: 'expiry',        href: '/dashboard/expiry',            icon: CalendarClock },
  { key: 'products',      href: '/dashboard/products',          icon: Package },
  { key: 'import',        href: '/dashboard/import',            icon: Upload,    roles: ['owner', 'manager'] },
  { key: 'reports',       href: '/dashboard/reports',           icon: BarChart3, roles: ['owner', 'manager'] },
  { key: 'notifications', href: '/dashboard/notifications',     icon: Bell },
  { key: 'barcode',       href: '/dashboard/barcode-generator', icon: Barcode,   roles: ['owner', 'manager'] },
  { key: 'settings',      href: '/dashboard/settings',          icon: Settings,  roles: ['owner', 'manager'] },
  { key: 'roles',         href: '/dashboard/settings/roles',    icon: Shield,    roles: ['owner'] },
  { key: 'audit',         href: '/dashboard/reports/audit',     icon: ClipboardList, roles: ['owner'] },
  { key: 'branches',      href: '/dashboard/settings/branches', icon: Building2, roles: ['owner', 'manager'] },
];

// Bottom primary: home | receiving | scan (FAB) | inventory | [more button auto-generated]
export const bottomPrimaryKeys    = ['home', 'receiving', 'scan', 'inventory'];

// Secondary items shown in the "More" bottom sheet
export const bottomSecondaryKeys  = [
  'stocktake', 'damaged', 'expiry', 'products', 'import', 'reports',
  'notifications', 'barcode', 'settings', 'roles', 'audit', 'branches',
];
