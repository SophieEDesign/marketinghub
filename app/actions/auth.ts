"use server";

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create Supabase client for server actions
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder-key');

export async function signInWithEmail(email: string) {
  try {
    // Check if user exists by trying to sign in
    // If user doesn't exist, we'll send a magic link which will create the account
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // This will create the user if they don't exist
        shouldCreateUser: true,
      },
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      message: 'Check your email for the magic link',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to send magic link',
    };
  }
}

export async function signUpWithEmail(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      message: 'Check your email to confirm your account',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to create account',
    };
  }
}

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to sign out',
    };
  }
}

