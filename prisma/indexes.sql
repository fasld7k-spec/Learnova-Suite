-- Optional production indexes for high traffic installations
CREATE INDEX IF NOT EXISTS idx_courses_status ON "Course"("status");
CREATE INDEX IF NOT EXISTS idx_courses_instructor ON "Course"("instructorId");
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON "Enrollment"("userId");
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON "Order"("userId", "status");
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON "Notification"("userId", "read");
