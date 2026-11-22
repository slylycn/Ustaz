import { NextResponse, type NextRequest } from "next/server";
import { aqylbekErrorMessage, callAqylbek } from "@/lib/aqylbek";

/**
 * DEV ONLY: lets you try Aqylbek from the browser console while signed in.
 * Returns 404 outside `npm run dev`, so it does nothing on Vercel.
 *
 *   await (await fetch("/api/dev/aqylbek", {
 *     method: "POST",
 *     body: JSON.stringify({ task: { mode: "grade", ... } }),
 *   })).json()
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { task?: unknown; files?: unknown } | null;
  if (!body || typeof body.task !== "object" || body.task === null) {
    return NextResponse.json({ ok: false, error: "invalidTask" }, { status: 400 });
  }

  const result = await callAqylbek(
    body.task as Parameters<typeof callAqylbek>[0],
    Array.isArray(body.files) ? body.files : [],
  );
  if (result.ok) return NextResponse.json(result);

  const locale = request.cookies.get("NEXT_LOCALE")?.value === "ru" ? "ru" : "kk";
  const message = await aqylbekErrorMessage(result.error, locale);
  const status = result.error === "busy" ? 429 : result.error === "unauthorized" ? 401 : 400;
  return NextResponse.json({ ...result, message }, { status });
}
