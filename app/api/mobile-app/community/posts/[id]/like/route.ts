import { fail, ok } from "@/lib/api";
import { mobileAccountForRequest } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const account = await mobileAccountForRequest(request);
  if (!account) return fail("Unauthenticated", 401);

  const { id } = await context.params;
  const topic = await prisma.discussionTopic.findUnique({
    where: { id },
    include: {
      _count: { select: { replies: true, likes: true } },
    },
  });

  if (!topic) return fail("Community post not found.", 404);
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.discussionTopicLike.findUnique({
      where: { topicId_userId: { topicId: topic.id, userId: account.id } },
      select: { id: true },
    });

    const liked = !existing;
    if (existing) {
      await tx.discussionTopicLike.delete({ where: { id: existing.id } });
    } else {
      await tx.discussionTopicLike.create({
        data: { topicId: topic.id, userId: account.id },
      });
    }

    const likes = await tx.discussionTopicLike.count({
      where: { topicId: topic.id },
    });
    return { liked, likes };
  });
  const user = await prisma.user.findUnique({
    where: { id: topic.userId },
    select: { name: true, role: true },
  });

  return ok({
    id: topic.id,
    authorName: user?.name ?? "Community",
    authorRole: user?.role === "INSTRUCTOR" ? "Teacher" : "Student",
    topic: topic.title,
    body: topic.body,
    time: topic.createdAt.toISOString(),
    likes: result.likes,
    replies: topic._count.replies,
    liked: result.liked,
  });
}
