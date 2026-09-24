import { saveFileToStorage, saveProtectedFileToStorage } from '@/lib/storage';

const allowedImageTypes = ['image/png', 'image/jpeg', 'image/webp'];
const allowedVideoTypes = ['video/mp4'];
const allowedLessonAttachmentTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
const allowedCourseResourceTypes = ['application/pdf', 'application/zip', 'application/x-zip-compressed', 'video/mp4', 'image/png', 'image/jpeg', 'image/webp'];
const maxCoverBytes = 1024 * 1024 * 8;
const maxLessonVideoBytes = 1024 * 1024 * 500;
const maxLessonAttachmentBytes = 1024 * 1024 * 50;
const maxCourseResourceBytes = 1024 * 1024 * 500;

export async function saveCourseCover(file: File | null) {
  if (!file || file.size === 0) return null;
  if (!allowedImageTypes.includes(file.type)) throw new Error('Course cover must be PNG, JPG, or WEBP.');
  if (file.size > maxCoverBytes) throw new Error('Course cover image must be 8MB or smaller.');

  const uploaded = await saveFileToStorage(file, {
    directory: 'course-covers',
    allowedTypes: allowedImageTypes,
    maxBytes: maxCoverBytes,
    purpose: 'Course cover'
  });
  return uploaded?.url || null;
}

export async function saveLessonVideo(file: File | null) {
  if (!file || file.size === 0) return null;
  if (!allowedVideoTypes.includes(file.type)) throw new Error('Lesson video must be MP4.');
  if (file.size > maxLessonVideoBytes) throw new Error('Lesson video must be 500MB or smaller.');

  const uploaded = await saveProtectedFileToStorage(file, {
    directory: 'lesson-videos',
    allowedTypes: allowedVideoTypes,
    maxBytes: maxLessonVideoBytes,
    purpose: 'Lesson video'
  });
  return uploaded?.url || null;
}

export async function saveLessonAttachment(file: File | null) {
  if (!file || file.size === 0) return null;
  if (!allowedLessonAttachmentTypes.includes(file.type)) throw new Error('Lesson attachment must be PDF, PNG, JPG, or WEBP.');
  if (file.size > maxLessonAttachmentBytes) throw new Error('Lesson attachment must be 50MB or smaller.');

  const uploaded = await saveProtectedFileToStorage(file, {
    directory: 'lesson-attachments',
    allowedTypes: allowedLessonAttachmentTypes,
    maxBytes: maxLessonAttachmentBytes,
    purpose: 'Lesson attachment'
  });
  return uploaded?.url || null;
}

export async function saveCourseResourceFile(file: File | null) {
  if (!file || file.size === 0) return null;
  if (!allowedCourseResourceTypes.includes(file.type)) throw new Error('Course resource must be PDF, ZIP, MP4, PNG, JPG, or WEBP.');
  if (file.size > maxCourseResourceBytes) throw new Error('Course resource must be 500MB or smaller.');

  const uploaded = await saveProtectedFileToStorage(file, {
    directory: 'course-resources',
    allowedTypes: allowedCourseResourceTypes,
    maxBytes: maxCourseResourceBytes,
    purpose: 'Course resource'
  });
  return uploaded?.url || null;
}
