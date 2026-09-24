-- Link lesson-scoped features without breaking existing course-level records.
ALTER TABLE "LiveSession" ADD COLUMN "lessonId" TEXT;
ALTER TABLE "Question" ADD COLUMN "lessonId" TEXT;

CREATE UNIQUE INDEX "LiveSession_lessonId_key" ON "LiveSession"("lessonId");
CREATE INDEX "Question_lessonId_idx" ON "Question"("lessonId");
