import { NextResponse } from "next/server";

import { dispatchExpectedDateReminders } from "@/lib/expected-date-reminders";

/**
 * Daily cron endpoint that sends "expected completion date" reminders to the
 * user who entered each order's data — fires at 6, 4, 2 and 1 day(s) before
 * the order's `expectedDate` (computed in WAT).
 *
 * Scheduled by Vercel Cron (see `apps/web/vercel.json`). Vercel Cron adds an
 * `Authorization: Bearer ${CRON_SECRET}` header when the env var is set; we
 * enforce that in production. Manual triggers (e.g. from `curl` during
 * development) only require the secret when one is configured.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get("authorization");
    if (header !== `Bearer ${secret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  try {
    const summary = await dispatchExpectedDateReminders();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reminder dispatch failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
