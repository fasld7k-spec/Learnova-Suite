-- CreateTable
CREATE TABLE "DiscussionTopicLike" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscussionTopicLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscussionTopicLike_topicId_userId_key" ON "DiscussionTopicLike"("topicId", "userId");

-- CreateIndex
CREATE INDEX "DiscussionTopicLike_userId_idx" ON "DiscussionTopicLike"("userId");

-- AddForeignKey
ALTER TABLE "DiscussionTopicLike" ADD CONSTRAINT "DiscussionTopicLike_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "DiscussionTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
