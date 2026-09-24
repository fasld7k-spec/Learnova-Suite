import { fromJsonArray, listHas, toList } from "@/lib/json-fields";
import { prisma } from "@/lib/prisma";

type ConversationWithLastMessage = {
  id: string;
  subject: string;
  userIds: string;
  createdAt: Date;
  messages: {
    id: string;
    senderId: string;
    body: string;
    read: boolean;
    createdAt: Date;
  }[];
};

type MobileChatAccount = {
  id: string;
  name: string;
  role: string;
};

type MobileChatUser = {
  id: string;
  name: string;
  role: string;
};

type InstructorTarget = {
  id: string;
  name: string;
  courseTitle: string | null;
  enrolled: boolean;
};

export function participantIds(conversation: { userIds: string }) {
  return fromJsonArray<string>(conversation.userIds);
}

export function isMobileChatRole(role: string) {
  return role === "STUDENT" || role === "INSTRUCTOR";
}

export function isAllowedMobileConversation(
  account: MobileChatAccount,
  participants: MobileChatUser[],
) {
  if (!isMobileChatRole(account.role)) return false;
  if (participants.some((participant) => !isMobileChatRole(participant.role))) {
    return false;
  }

  const otherParticipants = participants.filter(
    (participant) => participant.id !== account.id,
  );
  const expectedRole = account.role === "STUDENT" ? "INSTRUCTOR" : "STUDENT";
  return otherParticipants.some(
    (participant) => participant.role === expectedRole,
  );
}

export async function participantsForConversations(
  conversations: { userIds: string }[],
) {
  const ids = [
    ...new Set(
      conversations.flatMap((conversation) => participantIds(conversation)),
    ),
  ];
  if (!ids.length) return new Map<string, MobileChatUser>();

  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, role: true },
  });
  return new Map(users.map((user) => [user.id, user]));
}

export function formatMobileConversation(
  conversation: ConversationWithLastMessage,
  account: MobileChatAccount,
  participantMap: Map<string, MobileChatUser>,
  unreadCount: number,
) {
  const participants = participantIds(conversation)
    .map((id) => participantMap.get(id))
    .filter(Boolean) as MobileChatUser[];
  if (!isAllowedMobileConversation(account, participants)) return null;

  const expectedRole = account.role === "STUDENT" ? "INSTRUCTOR" : "STUDENT";
  const participant =
    participants.find(
      (user) => user.id !== account.id && user.role === expectedRole,
    ) ?? participants.find((user) => user.id !== account.id);
  const lastMessage = conversation.messages[0] ?? null;
  const updatedAt = lastMessage?.createdAt ?? conversation.createdAt;

  return {
    id: conversation.id,
    title: conversation.subject,
    participantName: participant?.name ?? "Chat",
    lastMessage: lastMessage?.body ?? null,
    updatedAt: updatedAt.toISOString(),
    unreadCount,
  };
}

function addTarget(
  targets: InstructorTarget[],
  seen: Set<string>,
  target: InstructorTarget,
) {
  if (seen.has(target.id)) return;
  seen.add(target.id);
  targets.push(target);
}

export async function instructorTargetsForStudent(studentId: string) {
  const targets: InstructorTarget[] = [];
  const seen = new Set<string>();

  const enrolledCourses = await prisma.enrollment.findMany({
    where: { userId: studentId },
    select: {
      course: {
        select: {
          title: true,
          instructor: {
            select: { id: true, name: true, role: true, status: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  for (const enrollment of enrolledCourses) {
    const instructor = enrollment.course.instructor;
    if (instructor.role !== "INSTRUCTOR" || instructor.status === "SUSPENDED") {
      continue;
    }
    addTarget(targets, seen, {
      id: instructor.id,
      name: instructor.name,
      courseTitle: enrollment.course.title,
      enrolled: true,
    });
  }

  const publishedCourses = await prisma.course.findMany({
    where: {
      status: "PUBLISHED",
      instructor: { role: "INSTRUCTOR", status: { not: "SUSPENDED" } },
    },
    select: {
      title: true,
      instructor: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  for (const course of publishedCourses) {
    addTarget(targets, seen, {
      id: course.instructor.id,
      name: course.instructor.name,
      courseTitle: course.title,
      enrolled: false,
    });
  }

  return targets;
}

export async function availableInstructorForStudent(
  studentId: string,
  instructorId: string,
) {
  const targets = await instructorTargetsForStudent(studentId);
  return targets.find((target) => target.id === instructorId) ?? null;
}

export async function findConversationBetweenUsers(
  userId: string,
  otherUserId: string,
) {
  const conversations = await prisma.conversation.findMany({
    where: { userIds: listHas(userId) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    conversations.find((conversation) =>
      participantIds(conversation).includes(otherUserId),
    ) ?? null
  );
}

export async function findOrCreateStudentInstructorConversation(
  studentId: string,
  instructorId: string,
) {
  const target = await availableInstructorForStudent(studentId, instructorId);
  if (!target) return null;

  const existing = await findConversationBetweenUsers(studentId, instructorId);
  if (existing) return existing;

  return prisma.conversation.create({
    data: {
      subject:
        target.enrolled && target.courseTitle
          ? `Course chat: ${target.courseTitle}`
          : `Chat with ${target.name}`,
      userIds: toList([studentId, instructorId]),
    },
  });
}

export async function ensureStudentInstructorConversations(studentId: string) {
  const targets = await instructorTargetsForStudent(studentId);
  if (!targets.length) return;

  const conversations = await prisma.conversation.findMany({
    where: { userIds: listHas(studentId) },
    select: { userIds: true },
  });
  const existingInstructorIds = new Set(
    conversations.flatMap((conversation) =>
      participantIds(conversation).filter((id) => id !== studentId),
    ),
  );

  for (const target of targets.slice(0, 10)) {
    if (existingInstructorIds.has(target.id)) continue;
    await prisma.conversation.create({
      data: {
        subject:
          target.enrolled && target.courseTitle
            ? `Course chat: ${target.courseTitle}`
            : `Chat with ${target.name}`,
        userIds: toList([studentId, target.id]),
      },
    });
    existingInstructorIds.add(target.id);
  }
}
