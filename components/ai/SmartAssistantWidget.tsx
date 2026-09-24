'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Loader2, MessageCircle, RotateCcw, Send, X } from 'lucide-react';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type AssistantCopy = {
  starterPrompts: string[];
  coursePrompts: string[];
  catalogPrompts: string[];
  checkoutPrompts: string[];
  certificatePrompts: string[];
  adminPrompts: string[];
  instructorPrompts: string[];
  communicationPrompts: string[];
  assistantTitle: string;
  subtitle: string;
  welcome: (siteName: string) => string;
  fallbackError: string;
  unavailable: string;
  thinking: string;
  placeholder: string;
  panelLabel: string;
  resetLabel: string;
  closeLabel: string;
  sendLabel: string;
  openLabel: string;
  openText: string;
};

const assistantCopies: Record<'en' | 'ar', AssistantCopy> = {
  en: {
    starterPrompts: ['How do I buy a course?', 'Where can I verify a certificate?', 'What can instructors manage?'],
    coursePrompts: ['What is included in this course?', 'How do I buy this course?', 'Will I get a certificate?'],
    catalogPrompts: ['Which course should I choose?', 'Are there free courses?', 'How do I compare courses?'],
    checkoutPrompts: ['How does checkout work?', 'Which payment options are available?', 'Is this a safe demo payment?'],
    certificatePrompts: ['How do I verify a certificate?', 'Where is the certificate code?', 'Who issued this certificate?'],
    adminPrompts: ['What should I configure here?', 'How do I prepare for review?', 'Where are payment settings?'],
    instructorPrompts: ['How do I publish a course?', 'How do live sessions work?', 'Where can I manage students?'],
    communicationPrompts: ['How do I reply to a message?', 'How do notifications work?', 'Where can I get support?'],
    assistantTitle: 'Assistant',
    subtitle: 'Site-aware help, powered by admin AI settings',
    welcome: (siteName) => `Hi, I am the ${siteName} assistant. Ask me about courses, checkout, certificates, live sessions, instructor tools, or admin setup.`,
    fallbackError: 'I could not process that right now. Try /documentation or /support for help.',
    unavailable: 'The assistant is temporarily unavailable. Please try again shortly.',
    thinking: 'Thinking',
    placeholder: 'Ask about this marketplace...',
    panelLabel: 'Smart assistant chat',
    resetLabel: 'Reset assistant conversation',
    closeLabel: 'Close assistant',
    sendLabel: 'Send message',
    openLabel: 'Open smart assistant',
    openText: 'Smart help',
  },
  ar: {
    starterPrompts: ['ازاي أشتري كورس؟', 'فين أتحقق من الشهادة؟', 'المدرس يقدر يدير إيه؟'],
    coursePrompts: ['إيه الموجود داخل الكورس؟', 'ازاي أشتري الكورس ده؟', 'هل هاخد شهادة؟'],
    catalogPrompts: ['اختار أنهي كورس؟', 'هل فيه كورسات مجانية؟', 'ازاي أقارن بين الكورسات؟'],
    checkoutPrompts: ['الدفع بيشتغل ازاي؟', 'إيه طرق الدفع المتاحة؟', 'هل الدفع التجريبي آمن؟'],
    certificatePrompts: ['ازاي أتحقق من شهادة؟', 'فين كود الشهادة؟', 'مين مصدر الشهادة؟'],
    adminPrompts: ['أظبط إيه هنا؟', 'ازاي أجهز المنتج للمراجعة؟', 'فين إعدادات الدفع؟'],
    instructorPrompts: ['ازاي أنشر كورس؟', 'اللايف سيشنز بتشتغل ازاي؟', 'فين أدير الطلاب؟'],
    communicationPrompts: ['ازاي أرد على رسالة؟', 'الإشعارات بتشتغل ازاي؟', 'فين أطلب دعم؟'],
    assistantTitle: 'المساعد',
    subtitle: 'مساعدة ذكية حسب صفحة الموقع وإعدادات الأدمن',
    welcome: (siteName) => `أهلًا، أنا مساعد ${siteName}. اسألني عن الكورسات، الدفع، الشهادات، اللايف سيشنز، أدوات المدرس، أو إعدادات الأدمن.`,
    fallbackError: 'لم أقدر أعالج الطلب الآن. جرّب /documentation أو /support للمساعدة.',
    unavailable: 'المساعد غير متاح مؤقتًا. جرّب مرة أخرى بعد قليل.',
    thinking: 'يفكر',
    placeholder: 'اسأل عن هذا السوق التعليمي...',
    panelLabel: 'محادثة المساعد الذكي',
    resetLabel: 'مسح محادثة المساعد',
    closeLabel: 'إغلاق المساعد',
    sendLabel: 'إرسال الرسالة',
    openLabel: 'فتح المساعد الذكي',
    openText: 'مساعدة ذكية',
  },
};

function copyForLocale(locale: string) {
  return locale.toLowerCase().startsWith('ar') ? assistantCopies.ar : assistantCopies.en;
}

function promptsForPath(path: string, copy: AssistantCopy) {
  if (/^\/courses\/[^/]+/.test(path)) {
    return copy.coursePrompts;
  }
  if (path === '/courses' || path.startsWith('/categories')) {
    return copy.catalogPrompts;
  }
  if (path.startsWith('/cart') || path.startsWith('/checkout') || path.startsWith('/payment')) {
    return copy.checkoutPrompts;
  }
  if (path.startsWith('/certificates')) {
    return copy.certificatePrompts;
  }
  if (path.startsWith('/admin')) {
    return copy.adminPrompts;
  }
  if (path.startsWith('/instructor')) {
    return copy.instructorPrompts;
  }
  if (path.startsWith('/messages') || path.startsWith('/notifications') || path.startsWith('/support')) {
    return copy.communicationPrompts;
  }
  return copy.starterPrompts;
}

function welcomeMessage(siteName: string, copy: AssistantCopy): ChatMessage {
  return {
    role: 'assistant',
    content: copy.welcome(siteName),
  };
}

export function SmartAssistantWidget({ siteName, locale = 'en' }: { siteName: string; locale?: string }) {
  const copy = useMemo(() => copyForLocale(locale), [locale]);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage(siteName, copy)]);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const history = useMemo(() => messages.slice(-8), [messages]);
  const contextualPrompts = useMemo(() => promptsForPath(currentPath, copy), [copy, currentPath]);

  useEffect(() => {
    setCurrentPath(window.location.pathname);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, loading, open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const trigger = target.closest<HTMLElement>('[data-smart-assistant-trigger]');
      if (!trigger) return;

      event.preventDefault();
      const prompt = trigger.dataset.smartAssistantPrompt?.trim();
      setOpen(true);
      if (prompt) setInput(prompt);
      window.setTimeout(() => inputRef.current?.focus(), 150);
    }

    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, []);

  function resetConversation() {
    setMessages([welcomeMessage(siteName, copy)]);
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  function openAssistant() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 150);
  }

  async function sendMessage(messageText: string) {
    const message = messageText.trim();
    if (!message || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: message }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const page = {
        path: window.location.pathname,
        title: document.title,
      };
      const response = await fetch('/api/ai/assistant-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ message, history, page }),
      });
      const data = await response.json().catch(() => null);
      const answer = data?.success ? data.data?.answer : data?.message;
      setMessages([...nextMessages, {
        role: 'assistant',
        content: answer || copy.fallbackError,
      }]);
    } catch {
      setMessages([...nextMessages, {
        role: 'assistant',
        content: copy.unavailable,
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <div className="fixed bottom-4 right-4 z-[90] print:hidden sm:bottom-6 sm:right-6">
      {open ? (
        <section className="w-[min(calc(100vw-2rem),390px)] overflow-hidden rounded-[8px] border border-[#2F3336] bg-[#05070A] shadow-2xl shadow-black/50" aria-label={copy.panelLabel}>
          <header className="flex items-center justify-between gap-3 border-b border-[#2F3336] bg-[#101317] px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1D9BF0] text-white">
                <Bot size={20} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">{siteName} {copy.assistantTitle}</p>
                <p className="truncate text-xs font-semibold text-[#8A949E]">{copy.subtitle}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                className="grid h-9 w-9 place-items-center rounded-full border border-[#2F3336] text-[#E7E9EA] transition hover:bg-[#16181C] disabled:opacity-50"
                type="button"
                aria-label={copy.resetLabel}
                onClick={resetConversation}
                disabled={loading}
              >
                <RotateCcw size={16} />
              </button>
              <button
                className="grid h-9 w-9 place-items-center rounded-full border border-[#2F3336] text-[#E7E9EA] transition hover:bg-[#16181C]"
                type="button"
                aria-label={copy.closeLabel}
                onClick={() => setOpen(false)}
              >
                <X size={17} />
              </button>
            </div>
          </header>

          <div className="max-h-[55vh] min-h-[330px] overflow-y-auto px-4 py-4">
            <div className="grid gap-3">
              {messages.map((message, index) => (
                <div
                  className={`max-w-[92%] rounded-[8px] border px-3 py-2 text-sm leading-6 ${
                    message.role === 'user'
                      ? 'ml-auto border-[#1D9BF0]/40 bg-[#06121D] text-white'
                      : 'mr-auto border-[#2F3336] bg-[#101317] text-[#D6D9DD]'
                  }`}
                  key={`${message.role}-${index}`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              ))}
              {loading ? (
                <div className="mr-auto inline-flex items-center gap-2 rounded-[8px] border border-[#2F3336] bg-[#101317] px-3 py-2 text-sm font-semibold text-[#8A949E]">
                  <Loader2 className="animate-spin" size={15} />
                  {copy.thinking}
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="border-t border-[#2F3336] p-3">
            <div className="mb-3 flex flex-wrap gap-2">
              {contextualPrompts.map((prompt) => (
                <button
                  className="rounded-full border border-[#2F3336] px-3 py-1.5 text-xs font-bold text-[#D6D9DD] transition hover:bg-[#16181C]"
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
            <form className="flex items-center gap-2" onSubmit={onSubmit}>
              <input
                ref={inputRef}
                className="min-h-11 flex-1 rounded-full border border-[#2F3336] bg-[#0B0D10] px-4 text-sm font-semibold text-white outline-none transition placeholder:text-[#71767B] focus:border-[#1D9BF0]"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={copy.placeholder}
                maxLength={1200}
              />
              <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#1D9BF0] text-white transition hover:bg-[#1A8CD8] disabled:opacity-60" disabled={loading || !input.trim()} type="submit" aria-label={copy.sendLabel}>
                <Send size={18} />
              </button>
            </form>
          </div>
        </section>
      ) : (
        <button
          className="inline-flex min-h-14 items-center gap-3 rounded-full border border-[#2F3336] bg-[#1D9BF0] px-5 text-sm font-black text-white shadow-2xl shadow-black/40 transition hover:bg-[#1A8CD8] max-sm:h-10 max-sm:min-h-10 max-sm:w-10 max-sm:justify-center max-sm:px-0"
          type="button"
          onClick={openAssistant}
          aria-label={copy.openLabel}
        >
          <MessageCircle size={20} />
          <span className="max-sm:sr-only">{copy.openText}</span>
        </button>
      )}
    </div>
  );
}
