# End-to-End Flow

## Course Sale Flow
1. Instructor creates course.
2. Admin publishes course.
3. Student opens course detail.
4. Student enters coupon and chooses gateway.
5. Order is created.
6. Admin marks manual payment as paid, or webhook marks payment as paid.
7. Enrollment is created automatically.
8. Student learns lessons and progress updates.
9. At 100%, certificate is generated.
10. Student can view printable certificate and verify it by code.

## Subscription Flow
1. Admin creates subscription plan.
2. Student opens `/subscriptions`.
3. Student subscribes.
4. Subscription record and notification are created.

## Live Session Flow
1. Instructor creates session.
2. Student sees sessions for enrolled courses or independent public sessions.
3. Student joins via external URL.

## Withdrawal Flow
1. Instructor requests withdrawal.
2. Admin reviews request.
3. Admin updates status to approved/rejected/paid.
