import type { AssistantChatMessage, AssistantPageContext } from '@/lib/ai';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeAssistantHistory(value: unknown): AssistantChatMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((message) => {
      const record = isRecord(message) ? message : {};
      return {
        role: record.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: String(record.content || '').trim(),
      };
    })
    .filter((message) => message.content)
    .slice(-8);
}

export function normalizeAssistantPageContext(value: unknown): AssistantPageContext {
  if (!isRecord(value)) return {};

  const path = String(value.path || '').trim();
  const title = String(value.title || '').trim();

  return {
    path: path.startsWith('/') && !path.startsWith('//') ? path.slice(0, 180) : '',
    title: title.replace(/\s+/g, ' ').slice(0, 140),
  };
}

export function normalizeAssistantMessage(value: unknown) {
  return String(value || '').trim();
}
