/**
 * GET /api/instructor/videos/[id]
 *
 * Returns the current VideoAsset record including processing status.
 * Only accessible by the instructor who owns the lesson.
 *
 * Requirements: 5.7
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(['INSTRUCTOR', 'ADMIN']);
    if (user.role === 'INSTRUCTOR' && user.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;

    const videoAsset = await prisma.videoAsset.findUnique({
      where: { id },
      include: {
        lesson: {
          include: {
            module: {
              include: {
                course: {
                  select: { instructorId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!videoAsset) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Instructors can only view their own videos
    if (
      user.role === 'INSTRUCTOR' &&
      videoAsset.lesson.module.course.instructorId !== user.id
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      id: videoAsset.id,
      lessonId: videoAsset.lessonId,
      provider: videoAsset.provider,
      externalId: videoAsset.externalId,
      embedUrl: videoAsset.embedUrl,
      hlsUrl: videoAsset.hlsUrl,
      duration: videoAsset.duration,
      status: videoAsset.status,
      createdAt: videoAsset.createdAt,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    if (msg === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
