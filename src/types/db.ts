import type { Database } from './database.types';
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];

export type Product         = Tables<'products'>;
export type StockBatch      = Tables<'stock_batches'>;
export type Branch          = Tables<'branches'>;
export type Tenant          = Tables<'tenants'>;
export type Membership      = Tables<'memberships'>;
export type Category        = Tables<'categories'>;
export type Supplier        = Tables<'suppliers'>;
export type GoodsReceipt    = Tables<'goods_receipts'>;
export type DamagedProduct  = Tables<'damaged_products'>;
export type InventoryCount  = Tables<'inventory_counts'>;
export type Notification    = Tables<'notifications'>;
export type Invitation      = Tables<'invitations'>;
export type CustomRole      = Tables<'custom_roles'>;

export type UserRole        = Enums<'user_role'>;
export type ProductUnit     = Enums<'product_unit'>;
export type MovementType    = Enums<'movement_type'>;
export type DamageReason    = Enums<'damage_reason'>;
