-- Ustaz · Step 7 · weekly parent reports + public read-only share links
-- Run after the earlier migrations (Supabase → SQL Editor → Run).
--
-- Lifecycle: draft (Aqylbek wrote it, or it needs data) → approved (tutor checked it; the
-- share link works) → sent (tutor copied it for WhatsApp). Back to draft hides the link again.

create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  tutor_id     uuid not null default auth.uid()
               references public.tutors (id) on delete cascade,
  student_id   uuid not null,
  week_start   date not null check (extract(isodow from week_start) = 1), -- a Monday (Asia/Almaty week)
  -- Exactly what was sent to Aqylbek for this week (collected in code).
  input_data   jsonb not null check (octet_length(input_data::text) <= 200000),
  ai_status    text check (ai_status is null or ai_status in ('ok', 'needs_data')),
  missing      text[] not null default '{}' check (cardinality(missing) <= 20),
  message      text check (message is null or char_length(message) <= 4000),
  status       text not null default 'draft' check (status in ('draft', 'approved', 'sent')),
  -- Random, unguessable; only set once approved. Resetting it kills the old link.
  share_token  uuid unique,
  approved_at  timestamptz,
  sent_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint reports_one_per_week unique (tutor_id, student_id, week_start),
  constraint reports_shareable_needs_message check (
    status = 'draft'
    or (message is not null and btrim(message) <> '' and share_token is not null and approved_at is not null)
  ),
  constraint reports_student_fkey foreign key (student_id, tutor_id)
    references public.students (id, tutor_id) on delete cascade
);

create index reports_tutor_week_idx on public.reports (tutor_id, week_start desc);
create index reports_student_week_idx on public.reports (student_id, week_start desc);

create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

alter table public.reports enable row level security;

create policy "reports: select own" on public.reports for select to authenticated
  using ((select auth.uid()) = tutor_id);
create policy "reports: insert own" on public.reports for insert to authenticated
  with check ((select auth.uid()) = tutor_id);
create policy "reports: update own" on public.reports for update to authenticated
  using ((select auth.uid()) = tutor_id) with check ((select auth.uid()) = tutor_id);
create policy "reports: delete own" on public.reports for delete to authenticated
  using ((select auth.uid()) = tutor_id);

revoke all on table public.reports from anon;
grant select, insert, update, delete on table public.reports to authenticated;

-- ---------------------------------------------------------------------------
-- Public share page (/p/<token>): the ONLY way anonymous visitors read anything.
-- SECURITY DEFINER so it works without login, and it returns a fixed, minimal shape:
--   the approved message, the week, the student's first name, the parent's language,
--   and that student's approved overall grades (up to the end of the report's week,
--   last 6 months). No tutor data, no other students, no teacher keys, no raw AI output.
-- ---------------------------------------------------------------------------
create or replace function public.get_shared_report(token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'message',            r.message,
    'week_start',         r.week_start,
    'language',           s.parent_language,
    'student_first_name', split_part(btrim(s.full_name), ' ', 1),
    'grades', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'date',      (sub.approved_at at time zone 'Asia/Almaty')::date,
                 'rubric',    coalesce(sub.rubric_snapshot ->> 'name', ''),
                 'overall',   (sub.final_result ->> 'overall')::numeric,
                 'scale_min', (sub.rubric_snapshot ->> 'scale_min')::numeric,
                 'scale_max', (sub.rubric_snapshot ->> 'scale_max')::numeric
               )
               order by sub.approved_at
             )
      from public.submissions sub
      where sub.student_id = r.student_id
        and sub.tutor_id = r.tutor_id
        and sub.status = 'approved'
        and jsonb_typeof(sub.final_result -> 'overall') = 'number'
        and sub.approved_at <  ((r.week_start + 7)::timestamp at time zone 'Asia/Almaty')
        and sub.approved_at >= ((r.week_start - 182)::timestamp at time zone 'Asia/Almaty')
    ), '[]'::jsonb)
  )
  from public.reports r
  join public.students s on s.id = r.student_id and s.tutor_id = r.tutor_id
  where r.share_token = token
    and r.status in ('approved', 'sent')
$$;

revoke all on function public.get_shared_report(uuid) from public;
grant execute on function public.get_shared_report(uuid) to anon, authenticated;
