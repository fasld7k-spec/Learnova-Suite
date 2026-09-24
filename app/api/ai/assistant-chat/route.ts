import { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api';
import { chatWithSiteAssistant } from '@/lib/ai';
import {
  normalizeAssistantHistory,
  normalizeAssistantMessage,
  normalizeAssistantPageContext,
} from '@/lib/assistant-request';
import { enforceRateLimit, enforceSameOrigin } from '@/lib/request-security';
import { getSiteSettings } from '@/lib/site-settings';
import { featureEnabled } from '@/lib/features';

export async function POST(req: NextRequest) {
  const originBlocked = enforceSameOrigin(req);
  if (originBlocked) return originBlocked;
  const limited = enforceRateLimit(req, 'ai.assistant', 12, 60_000);
  if (limited) return limited;

  const settings = await getSiteSettings();
  if (!settings.aiAssistantEnabled) return fail('Smart assistant is disabled.', 403);
  if (await featureEnabled('smart_assistant_disabled')) return fail('Smart assistant is temporarily disabled.', 403);

  const body = await req.json().catch((): unknown => null);
  const record = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
  const message = normalizeAssistantMessage(record.message);
  const history = normalizeAssistantHistory(record.history);
  const page = normalizeAssistantPageContext(record.page);

  if (!message) return fail('Message is required.', 422);
  if (message.length > 1200) return fail('Message is too long.', 422);

  const answer = await chatWithSiteAssistant(message, history, page);
  return ok({ answer });
}
