-- Ustaz · Step 3 · rubrics with Row Level Security
-- Run after the step 1 and step 2 migrations (Supabase → SQL Editor → Run).
--
-- owner IS NULL  → platform rubric: every signed-in tutor can read it.
-- owner = tutor  → that tutor's own rubric: only they can read or change it.
-- Platform rubrics have NO write policy for tutors. The app edits them only on the server,
-- after checking the signed-in email equals ADMIN_EMAIL, using the service-role key.

-- ---------------------------------------------------------------------------
-- Validates the criteria JSON:
-- [{ "name": "Task Response", "descriptors_by_score": { "9": "…", "8.5": "", … } }, …]
-- ---------------------------------------------------------------------------
create or replace function public.rubric_criteria_valid(c jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  item jsonb;
  descriptors jsonb;
  score text;
  descriptor jsonb;
begin
  if c is null or jsonb_typeof(c) <> 'array'
     or jsonb_array_length(c) < 1 or jsonb_array_length(c) > 20 then
    return false;
  end if;

  for item in select value from jsonb_array_elements(c) loop
    if jsonb_typeof(item) <> 'object' then return false; end if;
    if coalesce(jsonb_typeof(item -> 'name'), '') <> 'string'
       or char_length(btrim(item ->> 'name')) not between 1 and 100 then
      return false;
    end if;

    descriptors := item -> 'descriptors_by_score';
    if coalesce(jsonb_typeof(descriptors), '') <> 'object' then return false; end if;

    for score, descriptor in select key, value from jsonb_each(descriptors) loop
      if score !~ '^-?[0-9]+(\.[0-9]+)?$' then return false; end if;
      if jsonb_typeof(descriptor) <> 'string' or char_length(descriptor #>> '{}') > 5000 then
        return false;
      end if;
    end loop;
  end loop;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- rubrics
-- ---------------------------------------------------------------------------
create table public.rubrics (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid references public.tutors (id) on delete cascade, -- null = platform rubric
  exam          text not null
                check (exam in ('IELTS', 'UNT', 'NIS', 'BIL', 'NUET', 'SAT')),
  task_type     text not null check (char_length(btrim(task_type)) between 1 and 100),
  name          text not null check (char_length(btrim(name)) between 1 and 150),
  version       text not null default 'v1' check (char_length(btrim(version)) between 1 and 50),
  scale_min     numeric(8, 3) not null,
  scale_max     numeric(8, 3) not null,
  scale_step    numeric(8, 3) not null,
  overall_rule  text not null check (char_length(btrim(overall_rule)) between 1 and 500),
  criteria      jsonb not null
                check (public.rubric_criteria_valid(criteria) and octet_length(criteria::text) <= 200000),
  source_url    text check (source_url is null or (source_url ~ '^https?://' and char_length(source_url) <= 500)),
  last_verified date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint rubrics_scale_valid check (
    scale_step > 0
    and scale_max > scale_min
    and mod(scale_max - scale_min, scale_step) = 0
  ),
  -- One rubric per name + version per owner (platform rubrics count as one owner).
  constraint rubrics_owner_name_version_key unique nulls not distinct (owner, name, version)
);

create index rubrics_owner_idx on public.rubrics (owner);
create index rubrics_exam_idx on public.rubrics (exam);

create trigger rubrics_set_updated_at
  before update on public.rubrics
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.rubrics enable row level security;

create policy "rubrics: read platform and own" on public.rubrics for select to authenticated
  using (owner is null or owner = (select auth.uid()));

-- owner = auth.uid() is never true for owner IS NULL, so tutors cannot create,
-- change or delete platform rubrics, or turn their own rubric into one.
create policy "rubrics: insert own" on public.rubrics for insert to authenticated
  with check (owner = (select auth.uid()));
create policy "rubrics: update own" on public.rubrics for update to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "rubrics: delete own" on public.rubrics for delete to authenticated
  using (owner = (select auth.uid()));

revoke all on table public.rubrics from anon;
grant select, insert, update, delete on table public.rubrics to authenticated;
