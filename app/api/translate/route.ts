import { NextRequest, NextResponse } from "next/server";
import {
  translationRequestBodySchema,
  type TranslationResponseBody,
} from "@/lib/translation-contract";
import { ApiError } from "@/lib/server/errors";
import { createCompletionFromEnvironment } from "@/lib/server/openai-adapter";
import { translateRequest } from "@/lib/server/translation-service";

// The server cache uses Node APIs, so pin the Node runtime. `dynamic` is
// unnecessary: POST route handlers are never cached.
export const runtime = "nodejs";

function failure(
  status: number,
  message: string,
  code?: string,
): NextResponse {
  return NextResponse.json({ error: message, code }, { status });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return failure(400, "Invalid JSON body.");
  }
  const parsed = translationRequestBodySchema.safeParse(json);
  if (!parsed.success) {
    return failure(400, "Invalid request.");
  }

  try {
    // Fails with 503 before touching the pipeline when unconfigured.
    const completion = createCompletionFromEnvironment();
    const outcome = await translateRequest(parsed.data, {
      completion,
      signal: request.signal,
    });
    const body: TranslationResponseBody = {
      translation: outcome.translation,
      family: outcome.family.id,
      cached: outcome.fromCache,
    };
    return NextResponse.json(body);
  } catch (error) {
    if (request.signal.aborted) {
      return failure(499, "Request aborted.");
    }
    if (error instanceof ApiError) {
      // User-facing message stays concise; the cause stays in logs.
      console.error(`[translate] ${error.code}:`, error.cause ?? error);
      return failure(error.status, error.message, error.code);
    }
    console.error("[translate] unexpected failure:", error);
    return failure(500, "Translation failed.");
  }
}
