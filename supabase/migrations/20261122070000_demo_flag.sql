-- Ustaz · Step 8 · mark demo students so "Remove demo data" deletes exactly them
-- (their lessons, submissions and reports go with them via ON DELETE CASCADE).
alter table public.students add column if not exists is_demo boolean not null default false;
create index if not exists students_tutor_demo_idx on public.students (tutor_id) where is_demo;
