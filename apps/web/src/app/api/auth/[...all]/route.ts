import { auth } from "@crm-tool/auth";
import { toNextJsHandler } from "better-auth/next-js";

const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;

// Wrap the POST handler so a server-side failure (e.g. the database refusing a
// write) comes back as a readable JSON message the client can show, instead of
// an opaque 500 that surfaces as an empty error box. Also logs the full error
// to the Vercel function logs for debugging.
export async function POST(request: Request): Promise<Response> {
  try {
    return await handlers.POST(request);
  } catch (error) {
    console.error("[auth] request handler threw:", error);
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ message: `Authentication failed: ${message}` }, { status: 500 });
  }
}
