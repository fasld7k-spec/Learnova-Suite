-- Add metadata for mobile push providers so buyer installations can distinguish
-- Firebase Messaging tokens from any future notification channel.
ALTER TABLE "UserDevice" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'firebase_messaging';
ALTER TABLE "UserDevice" ADD COLUMN "platform" TEXT NOT NULL DEFAULT 'mobile';
