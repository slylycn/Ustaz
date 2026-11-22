# Ustaz

A web app for independent tutors in Kazakhstan. Only tutors log in. The AI assistant inside is called Aqylbek.

Stack: Next.js 16 (App Router, TypeScript), Tailwind CSS 4 + shadcn/ui, Supabase (Auth, Postgres, Storage, RLS), Google Gemini via `@google/genai` (server only), next-intl (Kazakh `kk` default, Russian `ru`). Deploys to Vercel.

## Aqylbek (AI)

- `lib/aqylbek.ts` is the only code that calls Gemini. It is server-only, so `GEMINI_API_KEY` never reaches the browser.
- The system prompt lives in `lib/prompts/aqylbek-system.md`. Calls fail with "not configured" until the placeholder line is replaced.
- Responses are validated with the zod schemas in `lib/aqylbek-schemas.ts`. These must match the JSON shapes in the system prompt.
- Retries: one more try after invalid JSON, and up to two more after HTTP 429/503 (waiting as Gemini suggests, at most 15 s). After that the tutor sees "Aqylbek is busy, try again in a minute" in kk or ru.
- Every call writes one row to `ai_runs`: mode, model, tokens, status, attempts and duration. No student text is stored.

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
