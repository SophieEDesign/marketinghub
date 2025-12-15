/**
 * View Access Control Helper
 * Implements page-level access control for views
 */

export type AccessLevel = 'public' | 'authenticated' | 'role' | 'owner';

export interface ViewAccessControl {
  access_level?: AccessLevel;
  allowed_roles?: string[];
  owner_id?: string;
  is_public?: boolean;
}

export interface UserContext {
  id?: string;
  email?: string;
  roles?: Record<string, boolean> | string[];
}

/**
 * Check if user has access to a view
 */
export function checkViewAccess(
  view: ViewAccessControl,
  user: UserContext | null | undefined,
): boolean {
  // Public views are accessible to everyone
  if (view.is_public === true || view.access_level === 'public') {
    return true;
  }

  // If no user, deny access (except public)
  if (!user || !user.id) {
    return false;
  }

  const accessLevel = view.access_level || 'authenticated';

  switch (accessLevel) {
    case 'public':
      return true;

    case 'authenticated':
      // Any authenticated user can access
      return !!user.id;

    case 'role':
      // Check if user has any of the allowed roles
      if (!view.allowed_roles || view.allowed_roles.length === 0) {
        // Default to admin if no roles specified
        return hasRole(user, 'admin');
      }

      return view.allowed_roles.some((role) => hasRole(user, role));

    case 'owner':
      // Only the owner can access
      if (!view.owner_id) {
        // If no owner set, allow authenticated users
        return !!user.id;
      }
      return user.id === view.owner_id;

    default:
      // Default to authenticated
      return !!user.id;
  }
}

/**
 * Check if user has a specific role
 */
function hasRole(user: UserContext, role: string): boolean {
  if (!user.roles) {
    return false;
  }

  // Handle both object and array formats
  if (Array.isArray(user.roles)) {
    return user.roles.includes(role);
  }

  // Object format: { admin: true, editor: false, ... }
  if (typeof user.roles === 'object') {
    return user.roles[role] === true;
  }

  return false;
}

/**
 * Filter views based on access control
 */
export function filterViewsByAccess(
  views: Array<ViewAccessControl & { id: string; [key: string]: any }>,
  user: UserContext | null | undefined,
): Array<ViewAccessControl & { id: string; [key: string]: any }> {
  return views.filter((view) => checkViewAccess(view, user));
}
