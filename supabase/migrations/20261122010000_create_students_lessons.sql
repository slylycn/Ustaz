-- Ustaz · Step 2 · students + lessons with Row Level Security
-- Run after 20261122000000_create_tutors.sql (Supabase → SQL Editor → Run).

-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------
create table public.students (
  id              uuid primary key default gen_random_uuid(),
  tutor_id        uuid not null default auth.uid()
                  references public.tutors (id) on delete cascade,
  full_name       text not null check (char_length(btrim(full_name)) between 1 and 100),
  grade_or_age    text check (grade_or_age is null or char_length(grade_or_age) <= 30),
  exam_track      text not null
                  check (exam_track in ('IELTS', 'UNT', 'NIS', 'BIL', 'NUET', 'SAT')),
  target_score    text check (target_score is null or char_length(target_score) <= 30),
  parent_name     text check (parent_name is null or char_length(parent_name) <= 100),
  parent_phone    text check (parent_phone is null or char_length(parent_phone) <= 30),
  parent_language text not null default 'kk' check (parent_language in ('kk', 'ru')),
  notes           text check (notes is null or char_length(notes) <= 2000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Lets lessons reference (student id, tutor id) together, see below.
  unique (id, tutor_id)
);

create index students_tutor_id_full_name_idx on public.students (tutor_id, full_name);

create trigger students_set_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- lessons
-- ---------------------------------------------------------------------------
create table public.lessons (
  id           uuid primary key default gen_random_uuid(),
  tutor_id     uuid not null default auth.uid()
               references public.tutors (id) on delete cascade,
  student_id   uuid not null,
  starts_at    timestamptz not null,          -- stored in UTC, shown in Asia/Almaty
  duration_min integer not null default 60 check (duration_min between 15 and 480),
  topic        text check (topic is null or char_length(topic) <= 200),
  attended     boolean,                        -- null = not marked yet
  tutor_note   text check (tutor_note is null or char_length(tutor_note) <= 2000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Composite key: a lesson's student must belong to the SAME tutor.
  -- (Foreign key checks skip RLS, so this is what stops linking another tutor's student.)
  foreign key (student_id, tutor_id)
    references public.students (id, tutor_id) on delete cascade
);

create index lessons_tutor_id_starts_at_idx on public.lessons (tutor_id, starts_at);
create index lessons_student_id_starts_at_idx on public.lessons (student_id, starts_at);

create trigger lessons_set_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: a tutor sees and changes only rows where tutor_id = their id.
-- ---------------------------------------------------------------------------
alter table public.students enable row level security;
alter table public.lessons  enable row level security;

create policy "students: select own" on public.students for select to authenticated
  using ((select auth.uid()) = tutor_id);
create policy "students: insert own" on public.students for insert to authenticated
  with check ((select auth.uid()) = tutor_id);
create policy "students: update own" on public.students for update to authenticated
  using ((select auth.uid()) = tutor_id) with check ((select auth.uid()) = tutor_id);
create policy "students: delete own" on public.students for delete to authenticated
  using ((select auth.uid()) = tutor_id);

create policy "lessons: select own" on public.lessons for select to authenticated
  using ((select auth.uid()) = tutor_id);
create policy "lessons: insert own" on public.lessons for insert to authenticated
  with check ((select auth.uid()) = tutor_id);
create policy "lessons: update own" on public.lessons for update to authenticated
  using ((select auth.uid()) = tutor_id) with check ((select auth.uid()) = tutor_id);
create policy "lessons: delete own" on public.lessons for delete to authenticated
  using ((select auth.uid()) = tutor_id);

revoke all on table public.students, public.lessons from anon;
grant select, insert, update, delete on table public.students, public.lessons to authenticated;
