import { fail, ok } from "@/lib/api";
import { chatWithSiteAssistant } from "@/lib/ai";
import {
  normalizeAssistantHistory,
  normalizeAssistantMessage,
} from "@/lib/assistant-request";
import { featureEnabled } from "@/lib/features";
import { studentForRequest } from "@/lib/mobile-app-adapter";
import { rateLimit } from "@/lib/rate-limit";
import { getSiteSettings } from "@/lib/site-settings";

function requestIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

export async function POST(request: Request) {
  const student = await studentForRequest(request);
  if (!student) return fail("Unauthenticated", 401);

  const limited = rateLimit(
    `mobile.ai.assistant:${student.id}:${requestIp(request)}`,
    12,
    60_000,
  );
  if (!limited.ok)
    return fail("Too many assistant requests. Try again in a minute.", 429);

  const settings = await getSiteSettings();
  if (!settings.aiAssistantEnabled)
    return fail("Smart assistant is disabled.", 403);
  if (await featureEnabled("smart_assistant_disabled"))
    return fail("Smart assistant is temporarily disabled.", 403);

  const body = await request.json().catch((): unknown => null);
  const record = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  const message = normalizeAssistantMessage(record.message);
  if (!message) return fail("Message is required.", 422);
  if (message.length > 1200) return fail("Message is too long.", 422);

  const answer = await chatWithSiteAssistant(
    message,
    normalizeAssistantHistory(record.history),
    { path: "/mobile-app/assistant", title: "Learnova Suite mobile assistant" },
  );

  return ok({ answer });
}
