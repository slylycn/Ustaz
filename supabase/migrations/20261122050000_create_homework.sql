-- Ustaz · Step 6 · homework + private Storage bucket "homework" (source files)
-- Run after the earlier migrations (Supabase → SQL Editor → Run).
--
-- student_sheet and teacher_key are separate columns ON PURPOSE. Anything shown to students or
-- parents (the print view today, a parent link later) must select student_sheet only,
-- never teacher_key or *. RLS already keeps both columns to the owning tutor.

-- True when every path in the array sits inside "<folder>/…".
create or replace function public.paths_in_folder(paths text[], folder text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(p like folder || '/%'), true) from unnest(paths) as p
$$;

create table public.homework (
  id            uuid primary key default gen_random_uuid(),
  tutor_id      uuid not null default auth.uid()
                references public.tutors (id) on delete cascade,
  student_id    uuid,                          -- null = not tied to a student yet
  title         text not null check (char_length(btrim(title)) between 1 and 200),
  exam          text not null check (exam in ('IELTS', 'UNT', 'NIS', 'BIL', 'NUET', 'SAT')),
  level         text check (level is null or char_length(level) <= 50),
  -- What the tutor asked for (kept so "Regenerate" can reuse it).
  topic         text check (topic is null or char_length(topic) <= 300),
  item_types    text[] not null default '{}'
                check (item_types <@ array['multiple_choice', 'gap_fill', 'short_answer', 'essay_prompt', 'math_problem']::text[]),
  item_count    smallint check (item_count is null or item_count between 1 and 30),
  student_sheet jsonb not null
                check (jsonb_typeof(student_sheet -> 'items') = 'array' and octet_length(student_sheet::text) <= 200000),
  teacher_key   jsonb not null
                check (jsonb_typeof(teacher_key -> 'items') = 'array' and octet_length(teacher_key::text) <= 200000),
  source_files  text[] not null default '{}' check (cardinality(source_files) <= 3),
  status        text not null default 'draft' check (status in ('draft', 'assigned')),
  due_date      date,
  assigned_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint homework_sources_in_own_folder check (public.paths_in_folder(source_files, tutor_id::text)),
  constraint homework_assigned_needs_student check (status <> 'assigned' or student_id is not null),
  -- Student must belong to the same tutor. Deleting the student keeps the homework (student_id → null).
  constraint homework_student_fkey foreign key (student_id, tutor_id)
    references public.students (id, tutor_id) on delete set null (student_id)
);

create index homework_tutor_status_idx on public.homework (tutor_id, status, created_at desc);
create index homework_student_idx on public.homework (student_id, created_at desc);

create trigger homework_set_updated_at
  before update on public.homework
  for each row execute function public.set_updated_at();

-- A deleted student leaves assigned homework without a student: move it back to draft
-- (otherwise the "assigned needs student" check would block the student's deletion).
create or replace function public.homework_unassign_orphans()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.student_id is null and new.status = 'assigned' then
    new.status := 'draft';
    new.assigned_at := null;
  end if;
  return new;
end;
$$;

create trigger homework_unassign_orphans
  before update of student_id on public.homework
  for each row execute function public.homework_unassign_orphans();

-- ---------------------------------------------------------------------------
-- RLS: own rows only.
-- ---------------------------------------------------------------------------
alter table public.homework enable row level security;

create policy "homework: select own" on public.homework for select to authenticated
  using ((select auth.uid()) = tutor_id);
create policy "homework: insert own" on public.homework for insert to authenticated
  with check ((select auth.uid()) = tutor_id);
create policy "homework: update own" on public.homework for update to authenticated
  using ((select auth.uid()) = tutor_id) with check ((select auth.uid()) = tutor_id);
create policy "homework: delete own" on public.homework for delete to authenticated
  using ((select auth.uid()) = tutor_id);

revoke all on table public.homework from anon;
grant select, insert, update, delete on table public.homework to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for source files, 10 MB each, PDF/JPG/PNG only.
-- Object names are "<tutor_id>/<homework_id>/source-<n>.<ext>".
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('homework', 'homework', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "homework bucket: read own folder" on storage.objects for select to authenticated
  using (bucket_id = 'homework' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "homework bucket: upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'homework' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "homework bucket: delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'homework' and (storage.foldername(name))[1] = (select auth.uid())::text);
