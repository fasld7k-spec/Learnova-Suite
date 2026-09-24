ALTER TABLE "LessonProgress" ADD COLUMN "watchSeconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LessonProgress" ADD COLUMN "lastPositionSeconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LessonProgress" ADD COLUMN "lastWatchedAt" DATETIME;
ALTER TABLE "LessonProgress" ADD COLUMN "completedAt" DATETIME;

CREATE TABLE "LiveSessionAttendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "liveSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "LiveSessionAttendance_liveSessionId_userId_key" ON "LiveSessionAttendance"("liveSessionId", "userId");
CREATE INDEX "LiveSessionAttendance_userId_idx" ON "LiveSessionAttendance"("userId");
