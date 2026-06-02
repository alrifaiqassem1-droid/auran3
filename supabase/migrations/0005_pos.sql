-- ============================================================================
-- AURAN · استيراد POS — أعمدة أداء إضافية
-- RPC apply_pos_import موجود في 0010_core_rpcs.sql (نواة الصحّة المقفولة)
-- ============================================================================

-- فهارس تُسرّع استعلامات التقارير
create index if not exists idx_pos_items_sold_at
  on pos_import_items(sold_at);

create index if not exists idx_pos_imports_tenant_created
  on pos_imports(tenant_id, branch_id, created_at desc);

create index if not exists idx_stock_mov_type_created
  on stock_movements(tenant_id, branch_id, type, created_at desc);

create index if not exists idx_damaged_prod_created
  on damaged_products(tenant_id, branch_id, created_at desc);
