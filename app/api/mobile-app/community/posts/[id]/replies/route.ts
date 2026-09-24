import { fail, ok } from "@/lib/api";
import { mobileAccountForRequest } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";

function mobileCommunityReply(
  reply: { id: string; userId: string; body: string; createdAt: Date },
  user?: { name: string; role: string } | null,
) {
  return {
    id: reply.id,
    authorName: user?.name ?? "Community",
    authorRole: user?.role === "INSTRUCTOR" ? "Teacher" : "Student",
    body: reply.body,
    time: reply.createdAt.toISOString(),
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const topic = await prisma.discussionTopic.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!topic) return fail("Community post not found.", 404);

  const replies = await prisma.discussionReply.findMany({
    where: { topicId: id },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  const users = await prisma.user.findMany({
    where: { id: { in: replies.map((reply) => reply.userId) } },
    select: { id: true, name: true, role: true },
  });
  const usersById = new Map(users.map((user) => [user.id, user]));

  return ok(
    replies.map((reply) =>
      mobileCommunityReply(reply, usersById.get(reply.userId)),
    ),
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const account = await mobileAccountForRequest(request);
  if (!account) return fail("Unauthenticated", 401);

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const text = String(body.body || "").trim();

  if (text.length < 4) return fail("Reply must be at least 4 characters.", 422);

  const topic = await prisma.discussionTopic.findUnique({
    where: { id },
    select: { id: true, locked: true },
  });
  if (!topic) return fail("Community post not found.", 404);
  if (topic.locked) return fail("Community post is locked.", 403);

  const reply = await prisma.discussionReply.create({
    data: { topicId: id, userId: account.id, body: text },
  });

  return ok(mobileCommunityReply(reply, account), 201);
}
