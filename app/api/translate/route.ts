import { NextRequest, NextResponse } from "next/server";
import { translationCache } from "@/lib/cache";
import { ApiError, sanitize, translateText } from "@/lib/server";
import {
  translationRequestBodySchema,
  type TranslationResponseBody,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
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
  const body = parsed.data;
  try {
    const key = sanitize(body);
    if (key.text === "") {
      return NextResponse.json<TranslationResponseBody>({ translation: "" });
    }
    const cached = translationCache().get(key, Date.now());
    if (cached !== undefined) {
      return NextResponse.json<TranslationResponseBody>({ translation: cached });
    }
    const result = await translateText(key, request.signal);
    const translation = result.trim();
    if (translation === "") {
      return failure(502, "The model returned an empty translation.");
    }
    translationCache().insert(key, translation, Date.now());
    return NextResponse.json<TranslationResponseBody>({ translation });
  } catch (error) {
    if (request.signal.aborted) {
      return failure(499, "Request aborted.");
    }
    if (error instanceof ApiError) {
      return failure(error.status, error.message);
    }
    return failure(500, "Translation failed.");
  }
}
