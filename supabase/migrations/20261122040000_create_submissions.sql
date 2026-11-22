-- Ustaz · Step 5 · submissions + private Storage bucket "submissions"
-- Run after the earlier migrations (Supabase → SQL Editor → Run).
--
-- Lifecycle: draft (uploaded) → ai_done (Aqylbek graded; the tutor reviews and edits) → approved.
-- Only approved rows count as grades: the student's Grades tab and reports read final_result
-- WHERE status = 'approved'. Before approval, final_result holds the tutor's working draft.

create table public.submissions (
  id              uuid primary key default gen_random_uuid(),
  tutor_id        uuid not null default auth.uid()
                  references public.tutors (id) on delete cascade,
  student_id      uuid not null,
  -- The rubric can later be edited or deleted; rubric_snapshot keeps what was actually used.
  rubric_id       uuid references public.rubrics (id) on delete set null,
  rubric_snapshot jsonb,
  task_prompt     text not null check (char_length(btrim(task_prompt)) between 1 and 5000),
  file_path       text check (file_path is null or char_length(file_path) <= 300),
  file_mime       text check (file_mime is null or file_mime in (
                    'application/pdf', 'image/jpeg', 'image/png',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  text_content    text check (text_content is null or char_length(text_content) <= 50000),
  ai_result       jsonb check (ai_result is null or octet_length(ai_result::text) <= 200000),
  final_result    jsonb check (final_result is null or octet_length(final_result::text) <= 200000),
  status          text not null default 'draft' check (status in ('draft', 'ai_done', 'approved')),
  graded_at       timestamptz,
  approved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- A submission needs student work: a file, pasted text, or both (DOCX → extracted text).
  constraint submissions_has_work check (file_path is not null or text_content is not null),
  constraint submissions_file_has_mime check ((file_path is null) = (file_mime is null)),
  -- Files must live in this tutor's own Storage folder: "<tutor_id>/<submission_id>/work.ext".
  constraint submissions_file_in_own_folder check (file_path is null or file_path like tutor_id::text || '/%'),
  constraint submissions_approved_has_result check (
    status <> 'approved' or (final_result is not null and approved_at is not null)
  ),
  -- The student must belong to the same tutor (FK checks skip RLS, so this is enforced here).
  foreign key (student_id, tutor_id)
    references public.students (id, tutor_id) on delete cascade
);

create index submissions_tutor_status_idx on public.submissions (tutor_id, status, created_at desc);
create index submissions_student_status_idx on public.submissions (student_id, status, approved_at desc);
create index submissions_rubric_id_idx on public.submissions (rubric_id);

create trigger submissions_set_updated_at
  before update on public.submissions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: own rows only, and the rubric (if set) must be one this tutor can read
-- (a platform rubric or their own), so another tutor's rubric id can't be attached.
-- ---------------------------------------------------------------------------
alter table public.submissions enable row level security;

create policy "submissions: select own" on public.submissions for select to authenticated
  using ((select auth.uid()) = tutor_id);

create policy "submissions: insert own" on public.submissions for insert to authenticated
  with check (
    (select auth.uid()) = tutor_id
    and (rubric_id is null or exists (
      select 1 from public.rubrics r
      where r.id = rubric_id and (r.owner is null or r.owner = (select auth.uid()))
    ))
  );

create policy "submissions: update own" on public.submissions for update to authenticated
  using ((select auth.uid()) = tutor_id)
  with check (
    (select auth.uid()) = tutor_id
    and (rubric_id is null or exists (
      select 1 from public.rubrics r
      where r.id = rubric_id and (r.owner is null or r.owner = (select auth.uid()))
    ))
  );

create policy "submissions: delete own" on public.submissions for delete to authenticated
  using ((select auth.uid()) = tutor_id);

revoke all on table public.submissions from anon;
grant select, insert, update, delete on table public.submissions to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket, 15 MB per file, only the accepted file types.
-- Object names are "<tutor_id>/<submission_id>/work.<ext>"; a tutor can only touch their folder.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submissions', 'submissions', false, 15728640,
  array[
    'application/pdf', 'image/jpeg', 'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "submissions bucket: read own folder" on storage.objects for select to authenticated
  using (bucket_id = 'submissions' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "submissions bucket: upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'submissions' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "submissions bucket: delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'submissions' and (storage.foldername(name))[1] = (select auth.uid())::text);
