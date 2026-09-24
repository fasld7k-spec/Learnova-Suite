import { fail, ok } from "@/lib/api";
import { mobileAccountForRequest } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";

function mobileCommunityPost(
  topic: {
    id: string;
    userId: string;
    title: string;
    body: string;
    pinned: boolean;
    createdAt: Date;
    user?: { name: string; role: string } | undefined;
    _count?: { replies: number; likes: number };
  },
  liked = false,
) {
  return {
    id: topic.id,
    authorName: topic.user?.name ?? "Community",
    authorRole: topic.user?.role === "INSTRUCTOR" ? "Teacher" : "Student",
    topic: topic.title,
    body: topic.body,
    time: topic.createdAt.toISOString(),
    likes: topic._count?.likes ?? 0,
    replies: topic._count?.replies ?? 0,
    liked,
  };
}

export async function GET(request: Request) {
  const account = await mobileAccountForRequest(request);
  const topics = await prisma.discussionTopic.findMany({
    include: {
      _count: { select: { replies: true, likes: true } },
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
  const users = await prisma.user.findMany({
    where: { id: { in: topics.map((topic) => topic.userId) } },
    select: { id: true, name: true, role: true },
  });
  const usersById = new Map(users.map((user) => [user.id, user]));
  const likedTopicIds = account
    ? new Set(
        (
          await prisma.discussionTopicLike.findMany({
            where: {
              userId: account.id,
              topicId: { in: topics.map((topic) => topic.id) },
            },
            select: { topicId: true },
          })
        ).map((like) => like.topicId),
      )
    : new Set<string>();

  return ok(
    topics.map((topic) =>
      mobileCommunityPost(
        { ...topic, user: usersById.get(topic.userId) },
        likedTopicIds.has(topic.id),
      ),
    ),
  );
}

export async function POST(request: Request) {
  const account = await mobileAccountForRequest(request);
  if (!account) return fail("Unauthenticated", 401);

  const body = await request.json().catch(() => ({}));
  const title = String(body.topic || "").trim();
  const text = String(body.body || "").trim();

  if (title.length < 3)
    return fail("Topic must be at least 3 characters.", 422);
  if (text.length < 8)
    return fail("Post body must be at least 8 characters.", 422);

  const topic = await prisma.discussionTopic.create({
    data: { userId: account.id, title, body: text },
    include: {
      _count: { select: { replies: true, likes: true } },
    },
  });
  const user = await prisma.user.findUnique({
    where: { id: topic.userId },
    select: { name: true, role: true },
  });

  return ok(mobileCommunityPost({ ...topic, user: user ?? undefined }), 201);
}
