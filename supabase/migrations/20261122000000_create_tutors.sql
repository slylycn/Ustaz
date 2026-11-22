-- Ustaz · Step 1 · tutors table + Row Level Security
-- Run once in Supabase → SQL Editor (or `supabase db push` if you use the CLI).

-- ---------------------------------------------------------------------------
-- Shared helper: keep updated_at current on every UPDATE
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- tutors: one row per signed-in tutor. id IS the tutor id (= auth.users.id).
-- Later tables will have tutor_id references public.tutors(id).
-- ---------------------------------------------------------------------------
create table public.tutors (
  id              uuid primary key references auth.users (id) on delete cascade,
  full_name       text not null
                  check (char_length(btrim(full_name)) between 1 and 100),
  phone           text
                  check (phone is null or char_length(phone) <= 30),
  exams           text[] not null
                  check (
                    cardinality(exams) between 1 and 6
                    and exams <@ array['IELTS', 'UNT', 'NIS', 'BIL', 'NUET', 'SAT']::text[]
                  ),
  output_language text not null default 'kk'
                  check (output_language in ('kk', 'ru')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.tutors is 'Tutor profiles. One row per auth user, created during onboarding.';

create trigger tutors_set_updated_at
  before update on public.tutors
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: a tutor can only see and change their own row.
-- (select auth.uid()) is wrapped in a sub-select so Postgres evaluates it once per query.
-- ---------------------------------------------------------------------------
alter table public.tutors enable row level security;

create policy "tutors: select own row"
  on public.tutors for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "tutors: insert own row"
  on public.tutors for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "tutors: update own row"
  on public.tutors for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "tutors: delete own row"
  on public.tutors for delete
  to authenticated
  using ((select auth.uid()) = id);

-- Signed-out visitors (anon role) get nothing, not even an empty result set.
revoke all on table public.tutors from anon;
grant select, insert, update, delete on table public.tutors to authenticated;
