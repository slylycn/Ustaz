# Ustaz

A web app for independent tutors in Kazakhstan. Only tutors log in. The AI assistant inside is called Aqylbek.

Stack: Next.js 16 (App Router, TypeScript), Tailwind CSS 4 + shadcn/ui, Supabase (Auth, Postgres, Storage, RLS), Google Gemini via `@google/genai` (server only), next-intl (Kazakh `kk` default, Russian `ru`). Deploys to Vercel.

Deploying: see **DEPLOY.md**.

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

Useful checks:

```bash
npm run check:i18n   # kk.json and ru.json have the same keys
npm run typecheck
npm run build
```

## Supabase setup (one time)

1. **Run the migrations, in order.** Paste each file into Supabase → SQL Editor → Run:
   - `supabase/migrations/20261122000000_create_tutors.sql`
   - `supabase/migrations/20261122010000_create_students_lessons.sql`
   - `supabase/migrations/20261122020000_create_rubrics.sql`
   - `supabase/migrations/20261122020100_seed_ielts_writing_task2.sql` (safe to run twice)
   - `supabase/migrations/20261122030000_create_ai_runs.sql`
   - `supabase/migrations/20261122040000_create_submissions.sql` (also creates the private Storage bucket `submissions`)
   - `supabase/migrations/20261122050000_create_homework.sql` (also creates the private Storage bucket `homework`)
   - `supabase/migrations/20261122060000_create_reports.sql` (also creates the public share function `get_shared_report`)
   - `supabase/migrations/20261122070000_demo_flag.sql`
2. **Redirect URLs.** Go to Authentication → URL Configuration.
   - Site URL: `http://localhost:3000` (change to your production domain later)
   - Redirect URLs: `http://localhost:3000/auth/callback`, `https://*.vercel.app/auth/callback`, and later `https://YOUR-DOMAIN/auth/callback`
3. **Email.** Magic link is on by default. Supabase's built-in email sender is heavily rate-limited and only delivers to members of your Supabase organization. For real users, add custom SMTP (for example Resend) under Authentication → Emails → SMTP Settings.
4. **Google (optional).**
   - In Google Cloud Console, create an OAuth client of type "Web application". Add the authorized redirect URI `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`.
   - In Supabase → Authentication → Providers → Google, enable Google and paste the client ID and secret.
   - Set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`.

## Routes

| Path | What |
| --- | --- |
| `/login` (`/ru/login`) | Magic link, plus Google if enabled |
| `/onboarding` | First-login profile form, saved to `tutors` |
| `/dashboard` | Today's lessons, work to review, reports to approve, Aqylbek usage this month, load/remove demo data |
| `/students` | Student list; `/students/new`, `/students/[id]/edit` |
| `/students/[id]` | Profile with tabs: Lessons, Homework, Grades, Reports (`?tab=`) |
| `/timetable` | Week view grouped by day (`?week=YYYY-MM-DD`, any day in the week) |
| `/timetable/new`, `/timetable/[lessonId]/edit` | Add or edit a lesson, mark attendance, delete |
| `/rubrics` | Platform rubrics + my rubrics, with "last verified" dates; `/rubrics/new`, `/rubrics/[id]`, `/rubrics/[id]/edit` |
| `/submissions` | Student work: list by status; `/submissions/new`; `/submissions/[id]` to grade, review and approve |
| `/homework` | Homework list; `/homework/new`; `/homework/[id]` (tabs: student sheet / teacher key); `/homework/[id]/edit`; `/homework/[id]/print` (A4, student sheet only) |
| `/reports` | Weekly parent reports (`?week=`): draft all, review, approve; `/reports/[id]` to edit, copy for WhatsApp, share |
| `/p/[token]` | **Public**, no login, noindex: the approved message + that student's approved grades chart |
| `/auth/callback` | Supabase auth redirect target (not localized) |

Kazakh URLs have no prefix. Russian URLs start with `/ru`.

## Rubrics and the admin

- `owner IS NULL` means a platform rubric: every tutor can read it. A non-null `owner` is that tutor's own rubric.
- RLS never lets a tutor write a platform rubric. The admin's edits run on the server: the app checks that the signed-in, confirmed email equals `ADMIN_EMAIL`, then writes with `SUPABASE_SERVICE_ROLE_KEY`. Every admin query is limited to `owner IS NULL`.
- Any tutor can "Make a copy" of a platform rubric and edit the copy.

## Aqylbek (AI)

- `lib/aqylbek.ts` is the only code that calls Gemini. It is server-only, so `GEMINI_API_KEY` never reaches the browser.
- The system prompt lives in `lib/prompts/aqylbek-system.md`. Calls fail with "not configured" until the placeholder line is replaced.
- Responses are validated with the zod schemas in `lib/aqylbek-schemas.ts`. These must match the JSON shapes in the system prompt.
- Retries: one more try after invalid JSON, and up to two more after HTTP 429/503 (waiting as Gemini suggests, at most 15 s). After that the tutor sees "Aqylbek is busy, try again in a minute" in kk or ru.
- Every call writes one row to `ai_runs`: mode, model, tokens, status, attempts and duration. No student text is stored.
- Dev only: `POST /api/dev/aqylbek` with `{ "task": { "mode": "grade", ... } }` (returns 404 in production).

## Grading flow

1. **Upload.** The browser uploads the file (PDF/JPG/PNG/DOCX, ≤ 15 MB) straight to the private bucket at `<tutor_id>/<submission_id>/work.<ext>`. Storage RLS allows only the tutor's own folder.
2. **Create.** The server checks the file's real type from its first bytes and turns DOCX into text with mammoth.
3. **Grade with Aqylbek.** Sends `mode: "grade"` with the rubric, task prompt, student work (text or attached file) and the tutor's `output_language`. Status becomes `ai_done`.
4. **Overall score.** Computed in code from the criterion scores (`lib/overall-rule.ts` understands mean/sum and rounding in English, Russian and Kazakh). The model's overall is ignored. If the rule can't be computed, the tutor picks the overall.
5. **Review.** Every field can be edited, then Approve. The server recomputes the overall and checks every score is on the scale.
6. **Only `approved` rows count** (`listApprovedGrades` in `lib/data.ts`): the Grades tab, and reports later. "Edit again" takes a grade out of the Grades tab until it is approved again.

## Homework

- Aqylbek returns items with their answers. `lib/homework.ts` splits them in code into `student_sheet` (prompt and options) and `teacher_key` (answer and explanation), so an answer can't reach the sheet.
- The print page and any future parent link use `getHomeworkSheet()` in `lib/data.ts`. It selects named columns and never fetches `teacher_key`.
- Source files (PDF/JPG/PNG, up to 3, 10 MB each) go from the browser to the private `homework` bucket. Above ~11 MB in total, `callAqylbek` sends them through the Gemini Files API and deletes them from Google right after the call.
- Only drafts can be edited. "Back to draft" makes assigned homework editable again.

## Parent reports

- **Draft.** "Draft this week's reports" calls the server once per student, two at a time, so a long list never hits a time limit.
- **Data, collected in code** (`lib/report-data.ts`): lessons attended/missed with tutor notes, homework assigned or due, work submitted, and grades approved that week plus the previous 3. Only the student's first name is sent, never the tutor's private notes. A week with no activity is not sent to Aqylbek.
- **needs_data.** When Aqylbek answers this, the report shows the list of what's missing instead of a message.
- **Share.** Approving creates a random `share_token`. The public page `/p/<token>` reads only through the SQL function `get_shared_report()`, which returns the approved message, the week, the first name, the parent's language, and that student's approved overall grades (up to the end of that week, last 6 months).
  - Nothing else is reachable anonymously.
  - "Edit again" or "New link" kills the old link immediately.
  - Responses send `noindex`, `no-referrer` and `no-store`.

## Time zone

Lesson times are entered and shown in `Asia/Almaty` and stored as UTC (`timestamptz`). The conversion lives in `lib/time.ts`, and next-intl formats dates with the same zone (`i18n/request.ts`).

## Project rules

- AI calls run in server code only. `GEMINI_API_KEY` never gets a `NEXT_PUBLIC_` prefix.
- Every table has RLS, so a tutor sees only their own rows.
- Every string a user sees lives in `messages/kk.json` and `messages/ru.json`.
