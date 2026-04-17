import type { ApiUser } from '../api';

export function userInitials(user: Pick<ApiUser, 'displayName' | 'email'> | null): string {
  if (!user) return '?';
  if (user.displayName?.trim()) {
    const parts = user.displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return user.email.slice(0, 2).toUpperCase();
}
