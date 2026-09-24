import type { Role } from '@/lib/auth';

export type Permission =
  | 'manage_users'
  | 'view_permissions'
  | 'block_users'
  | 'view_login_history'
  | 'manage_rate_limits'
  | 'manage_courses'
  | 'manage_payments'
  | 'manage_settings'
  | 'view_reports'
  | 'create_courses'
  | 'manage_own_courses'
  | 'create_live_sessions'
  | 'answer_questions'
  | 'request_withdrawals'
  | 'buy_courses'
  | 'learn'
  | 'review'
  | 'ask_questions'
  | 'view_certificates';

export const roleLabels: Record<Role, string> = {
  ADMIN: 'Administrator',
  INSTRUCTOR: 'Instructor',
  STUDENT: 'Student'
};

export const permissionLabels: Record<Permission, string> = {
  manage_users: 'Manage users',
  view_permissions: 'View roles and permissions',
  block_users: 'Block or reactivate users',
  view_login_history: 'View login history',
  manage_rate_limits: 'Manage rate limits',
  manage_courses: 'Manage courses',
  manage_payments: 'Manage payments',
  manage_settings: 'Manage settings',
  view_reports: 'View reports',
  create_courses: 'Create courses',
  manage_own_courses: 'Manage own courses',
  create_live_sessions: 'Create live sessions',
  answer_questions: 'Answer questions',
  request_withdrawals: 'Request withdrawals',
  buy_courses: 'Buy courses',
  learn: 'Learn',
  review: 'Review courses',
  ask_questions: 'Ask questions',
  view_certificates: 'View certificates'
};

export const permissions: Record<Role, Permission[]> = {
  ADMIN: [
    'manage_users',
    'view_permissions',
    'block_users',
    'view_login_history',
    'manage_rate_limits',
    'manage_courses',
    'manage_payments',
    'manage_settings',
    'view_reports'
  ],
  INSTRUCTOR: ['create_courses', 'manage_own_courses', 'create_live_sessions', 'answer_questions', 'request_withdrawals'],
  STUDENT: ['buy_courses', 'learn', 'review', 'ask_questions', 'view_certificates']
};

export function can(role: Role, permission: Permission) {
  return permissions[role]?.includes(permission) || false;
}
