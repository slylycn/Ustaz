-- Ustaz · Step 3 · seed: platform rubric "IELTS Writing Task 2"
-- Descriptors are deliberately EMPTY. Paste the official public band descriptors in
-- yourself (signed in as ADMIN_EMAIL → /rubrics → this rubric → Edit), then set the
-- source URL and "last verified" date there.
-- Safe to run twice: it skips the insert if the rubric already exists.

insert into public.rubrics (
  owner, exam, task_type, name, version,
  scale_min, scale_max, scale_step, overall_rule,
  criteria, source_url, last_verified
)
select
  null, 'IELTS', 'Writing Task 2', 'IELTS Writing Task 2', 'v1',
  0, 9, 0.5,
  'Mean of the 4 criteria, rounded to the nearest 0.5',
  (
    -- One empty descriptor per whole band 0–9 for each criterion, ready to paste into.
    select jsonb_agg(
             jsonb_build_object(
               'name', c.name,
               'descriptors_by_score',
               (select jsonb_object_agg(band::text, '') from generate_series(0, 9) as band)
             )
             order by c.position
           )
    from (values
      (1, 'Task Response'),
      (2, 'Coherence and Cohesion'),
      (3, 'Lexical Resource'),
      (4, 'Grammatical Range and Accuracy')
    ) as c(position, name)
  ),
  null,  -- source_url: add the official link when you paste the descriptors
  null   -- last_verified: set when you have checked the text against the source
where not exists (
  select 1 from public.rubrics
  where owner is null and name = 'IELTS Writing Task 2' and version = 'v1'
);
