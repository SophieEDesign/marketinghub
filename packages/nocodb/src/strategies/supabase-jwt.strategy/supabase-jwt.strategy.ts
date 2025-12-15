import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import type { NcRequest } from '~/interface/config';
import { sanitiseUserObj } from '~/utils';
import * as jwt from 'jsonwebtoken';

/**
 * Supabase JWT Strategy
 * Validates JWT tokens from Supabase Auth
 */
@Injectable()
export class SupabaseJwtStrategy extends PassportStrategy(Strategy, 'supabase-jwt') {
  private supabaseJwtSecret: string;

  constructor() {
    super();
    // Get Supabase JWT secret from environment
    this.supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.NEXT_PUBLIC_SUPABASE_JWT_SECRET || '';
    
    if (!this.supabaseJwtSecret) {
      console.warn('SUPABASE_JWT_SECRET not set. Supabase authentication will not work.');
    }
  }

  async validate(req: NcRequest, callback: Function) {
    try {
      // Extract Bearer token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return callback({ msg: 'No token provided' });
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      if (!this.supabaseJwtSecret) {
        return callback({ msg: 'Supabase JWT secret not configured' });
      }

      // Verify JWT token with Supabase secret
      let decoded: any;
      try {
        decoded = jwt.verify(token, this.supabaseJwtSecret);
      } catch (error) {
        return callback({ msg: 'Invalid or expired token' });
      }

      // Extract user information from JWT payload
      // Supabase JWT typically contains: sub (user id), email, role, app_metadata, user_metadata
      const userId = decoded.sub;
      const email = decoded.email || decoded.user_email;
      const roles = decoded.user_metadata?.roles || decoded.app_metadata?.roles || ['viewer'];
      
      // Map Supabase roles to our role system
      // admin, editor, viewer, client, ops, marketing
      const mappedRoles = this.mapSupabaseRoles(roles);

      // Create user object
      const user = {
        id: userId,
        email: email,
        display_name: decoded.user_metadata?.full_name || decoded.email?.split('@')[0] || 'User',
        roles: mappedRoles,
        base_roles: mappedRoles, // For compatibility
        is_new_user: false,
        // Store original Supabase data for reference
        supabase_user: {
          id: userId,
          email: email,
          metadata: decoded.user_metadata,
          app_metadata: decoded.app_metadata,
        },
      };

      return callback(null, sanitiseUserObj(user));
    } catch (error) {
      return callback(error);
    }
  }

  /**
   * Map Supabase roles to our role system
   */
  private mapSupabaseRoles(roles: string | string[]): Record<string, boolean> {
    const roleArray = Array.isArray(roles) ? roles : [roles];
    const roleMap: Record<string, boolean> = {
      admin: false,
      editor: false,
      viewer: false,
      client: false,
      ops: false,
      marketing: false,
    };

    // Map common role names
    for (const role of roleArray) {
      const normalizedRole = role.toLowerCase();
      if (normalizedRole === 'admin' || normalizedRole === 'administrator' || normalizedRole === 'super_admin') {
        roleMap.admin = true;
      } else if (normalizedRole === 'editor' || normalizedRole === 'edit') {
        roleMap.editor = true;
      } else if (normalizedRole === 'viewer' || normalizedRole === 'view' || normalizedRole === 'read') {
        roleMap.viewer = true;
      } else if (normalizedRole === 'client') {
        roleMap.client = true;
      } else if (normalizedRole === 'ops' || normalizedRole === 'operations') {
        roleMap.ops = true;
      } else if (normalizedRole === 'marketing') {
        roleMap.marketing = true;
      }
    }

    // Default to viewer if no roles match
    if (!Object.values(roleMap).some(v => v)) {
      roleMap.viewer = true;
    }

    return roleMap;
  }
}
