-- Ustaz · Step 4 · ai_runs: one row per Aqylbek call, for usage and debugging.
-- By design this table stores NO student text, prompts or model output, only metadata.

create table public.ai_runs (
  id            uuid primary key default gen_random_uuid(),
  tutor_id      uuid not null default auth.uid()
                references public.tutors (id) on delete cascade,
  mode          text not null check (mode in ('grade', 'homework', 'parent_report')),
  model         text check (model is null or char_length(model) <= 100),
  -- Summed over every attempt of the call (retries are billed too).
  input_tokens  integer not null default 0 check (input_tokens >= 0),
  -- Response tokens + "thinking" tokens, i.e. what Gemini bills as output.
  output_tokens integer not null default 0 check (output_tokens >= 0),
  status        text not null
                check (status in ('ok', 'busy', 'invalid_response', 'blocked', 'error', 'not_configured', 'invalid_task')),
  attempts      smallint not null default 1 check (attempts between 0 and 10),
  duration_ms   integer check (duration_ms is null or duration_ms >= 0),
  created_at    timestamptz not null default now()
);

comment on table public.ai_runs is
  'Aqylbek call log. Metadata only: never store student text, prompts or model output here.';

create index ai_runs_tutor_id_created_at_idx on public.ai_runs (tutor_id, created_at desc);

-- RLS: a tutor can read and add their own rows. There are no update/delete policies, so the log
-- can't be edited or erased from the app (rows go away only if the tutor account is deleted).
alter table public.ai_runs enable row level security;

create policy "ai_runs: select own" on public.ai_runs for select to authenticated
  using ((select auth.uid()) = tutor_id);
create policy "ai_runs: insert own" on public.ai_runs for insert to authenticated
  with check ((select auth.uid()) = tutor_id);

revoke all on table public.ai_runs from anon;
revoke all on table public.ai_runs from authenticated;
grant select, insert on table public.ai_runs to authenticated;
