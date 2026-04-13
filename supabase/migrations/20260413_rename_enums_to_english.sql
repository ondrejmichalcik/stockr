-- ============================================================================
-- Sprint 2.5 Phase 4 — Rename Czech enum values to English
-- Run once in Supabase SQL editor. Idempotent.
-- ============================================================================

-- --- items.unit: ks → pcs, bal → pack ----------------------------------------
alter table public.items drop constraint if exists items_unit_check;

update public.items set unit = 'pcs'  where unit = 'ks';
update public.items set unit = 'pack' where unit = 'bal';

alter table public.items alter column unit set default 'pcs';
alter table public.items
  add constraint items_unit_check
  check (unit in ('pcs','g','kg','ml','l','pack'));

-- --- items.category: Czech → English -----------------------------------------
alter table public.items drop constraint if exists items_category_check;

update public.items set category = 'food'         where category = 'potraviny';
update public.items set category = 'medicine'     where category = 'léky';
update public.items set category = 'water'        where category = 'voda';
update public.items set category = 'disinfectant' where category = 'dezinfekce';
update public.items set category = 'equipment'    where category = 'vybavení';
update public.items set category = 'energy'       where category = 'energie';
update public.items set category = 'documents'    where category = 'dokumenty';
update public.items set category = 'other'        where category = 'ostatní';

alter table public.items
  add constraint items_category_check
  check (category in ('food','medicine','water','disinfectant','equipment','energy','documents','other'));

-- --- custom_products.category: Czech → English -------------------------------
-- No check constraint on this column, just update existing values.
update public.custom_products set category = 'food'         where category = 'potraviny';
update public.custom_products set category = 'medicine'     where category = 'léky';
update public.custom_products set category = 'water'        where category = 'voda';
update public.custom_products set category = 'disinfectant' where category = 'dezinfekce';
update public.custom_products set category = 'equipment'    where category = 'vybavení';
update public.custom_products set category = 'energy'       where category = 'energie';
update public.custom_products set category = 'documents'    where category = 'dokumenty';
update public.custom_products set category = 'other'        where category = 'ostatní';
