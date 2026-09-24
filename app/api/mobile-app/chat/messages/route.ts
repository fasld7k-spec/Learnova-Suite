import { fail, ok } from "@/lib/api";
import { mobileAccountForRequest } from "@/lib/mobile-app-adapter";
import { sendMobilePushToUser } from "@/lib/mobile-push";
import { prisma } from "@/lib/prisma";
import { listHas } from "@/lib/json-fields";
import {
  ensureStudentInstructorConversations,
  findOrCreateStudentInstructorConversation,
  formatMobileConversation,
  isMobileChatRole,
  participantIds,
  participantsForConversations,
} from "../_helpers";

type MobileChatAccount = {
  id: string;
  name: string;
  role: string;
};

async function latestConversationForAccount(account: MobileChatAccount) {
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

  return (
    conversations
      .map((conversation) => ({
        conversation,
        summary: formatMobileConversation(
          conversation,
          account,
          participantMap,
          0,
        ),
      }))
      .filter((entry) => entry.summary)
      .sort((a, b) => {
        if (!a.summary || !b.summary) return 0;
        return (
          Date.parse(b.summary.updatedAt) - Date.parse(a.summary.updatedAt)
        );
      })[0]?.conversation ?? null
  );
}

async function conversationForAccount(
  account: MobileChatAccount,
  conversationId?: string,
) {
  const conversation = conversationId
    ? await prisma.conversation.findFirst({
        where: { id: conversationId, userIds: listHas(account.id) },
        include: { messages: { orderBy: { createdAt: "asc" }, take: 50 } },
      })
    : await latestConversationForAccount(account);

  if (!conversation) return null;

  const fullConversation = await prisma.conversation.findUnique({
    where: { id: conversation.id },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 50 } },
  });
  if (!fullConversation) return null;

  const participantMap = await participantsForConversations([fullConversation]);
  const allowed = formatMobileConversation(
    {
      ...fullConversation,
      messages: fullConversation.messages.slice(-1),
    },
    account,
    participantMap,
    0,
  );

  return allowed ? { conversation: fullConversation, participantMap } : null;
}

async function chatPushRecipient(
  conversationId: string,
  sender: MobileChatAccount,
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { userIds: true },
  });
  if (!conversation) return null;

  const expectedRole = sender.role === "STUDENT" ? "INSTRUCTOR" : "STUDENT";
  const recipientIds = participantIds(conversation).filter(
    (id) => id !== sender.id,
  );
  if (!recipientIds.length) return null;

  return prisma.user.findFirst({
    where: {
      id: { in: recipientIds },
      role: expectedRole,
      status: { not: "SUSPENDED" },
    },
    select: { id: true },
  });
}

async function sendChatMessagePush(
  conversationId: string,
  messageId: string,
  sender: MobileChatAccount,
  text: string,
) {
  const recipient = await chatPushRecipient(conversationId, sender);
  if (!recipient || recipient.id === sender.id) return;

  await sendMobilePushToUser(recipient.id, {
    title: `${sender.name} sent you a message`,
    body: text,
    data: {
      type: "chat_message",
      conversationId,
      messageId,
      senderId: sender.id,
    },
  });
}

export async function GET(request: Request) {
  const account = await mobileAccountForRequest(request);
  if (!account) return fail("Unauthenticated", 401);
  if (!isMobileChatRole(account.role)) return fail("Forbidden", 403);

  const { searchParams } = new URL(request.url);
  const conversationId =
    searchParams.get("conversationId")?.trim() || undefined;
  const result = await conversationForAccount(account, conversationId);
  if (!result)
    return conversationId ? fail("Conversation not found", 404) : ok([]);

  await prisma.message.updateMany({
    where: {
      conversationId: result.conversation.id,
      senderId: { not: account.id },
      read: false,
    },
    data: { read: true },
  });

  const names = new Map(
    [...result.participantMap.values()].map((user) => [user.id, user.name]),
  );

  return ok(
    result.conversation.messages.map((message) => ({
      id: message.id,
      conversationId: result.conversation.id,
      sender: names.get(message.senderId) ?? "Unknown",
      message: message.body,
      time: message.createdAt.toISOString(),
      mine: message.senderId === account.id,
    })),
  );
}

export async function POST(request: Request) {
  const account = await mobileAccountForRequest(request);
  if (!account) return fail("Unauthenticated", 401);
  if (!isMobileChatRole(account.role)) return fail("Forbidden", 403);

  const body = await request.json().catch(() => ({}));
  const text = String(body.message || body.body || "").trim();
  const conversationId = String(body.conversationId || "").trim();
  const instructorId = String(body.instructorId || "").trim();

  if (!text) return fail("Message is required.", 422);

  let conversation: { id: string } | null = null;

  if (conversationId) {
    const result = await conversationForAccount(account, conversationId);
    conversation = result?.conversation ?? null;
  } else if (instructorId) {
    if (account.role !== "STUDENT") {
      return fail("Teachers must send messages using conversationId.", 422);
    }
    conversation = await findOrCreateStudentInstructorConversation(
      account.id,
      instructorId,
    );
  } else {
    const result = await conversationForAccount(account);
    conversation = result?.conversation ?? null;
  }

  if (!conversation) return fail("Conversation not found", 404);

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: account.id,
      body: text,
    },
  });

  await sendChatMessagePush(conversation.id, message.id, account, text).catch(
    () => null,
  );

  return ok(
    {
      id: message.id,
      conversationId: conversation.id,
      sender: "You",
      message: message.body,
      time: message.createdAt.toISOString(),
      mine: true,
    },
    201,
  );
}
