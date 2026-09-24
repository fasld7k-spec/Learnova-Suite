import { fail, ok } from "@/lib/api";
import { mobileAccountForRequest } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";
import { listHas } from "@/lib/json-fields";
import {
  ensureStudentInstructorConversations,
  formatMobileConversation,
  isMobileChatRole,
  participantsForConversations,
} from "../_helpers";

export async function GET(request: Request) {
  const account = await mobileAccountForRequest(request);
  if (!account) return fail("Unauthenticated", 401);
  if (!isMobileChatRole(account.role)) return fail("Forbidden", 403);

  if (account.role === "STUDENT") {
    await ensureStudentInstructorConversations(account.id);
  }

  const conversations = await prisma.conversation.findMany({
    where: { userIds: listHas(account.id) },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const participantMap = await participantsForConversations(conversations);
  const unread = await prisma.message.groupBy({
    by: ["conversationId"],
    where: {
      senderId: { not: account.id },
      read: false,
      conversation: { userIds: listHas(account.id) },
    },
    _count: { _all: true },
  });
  const unreadByConversation = new Map(
    unread.map((row) => [row.conversationId, row._count._all]),
  );

  const formatted = conversations
    .map((conversation) =>
      formatMobileConversation(
        conversation,
        account,
        participantMap,
        unreadByConversation.get(conversation.id) ?? 0,
      ),
    )
    .filter(Boolean)
    .sort((a, b) => {
      if (!a || !b) return 0;
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    });

  return ok({ conversations: formatted });
}
