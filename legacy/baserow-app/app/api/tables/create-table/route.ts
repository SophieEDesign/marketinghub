import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * API route to create a Supabase table
 * This uses the service role or executes SQL via RPC
 */
export async function POST(request: NextRequest) {
  try {
    const { tableName: rawTableName, fieldNames = [] } = await request.json()
    
    if (!rawTableName) {
      return NextResponse.json(
        { error: 'Table name is required' },
        { status: 400 }
      )
    }

    // Strip "public." prefix if present
    const tableName = rawTableName.replace(/^public\./, '')
    const safeTableName = tableName.trim()

    // Defense-in-depth: only allow safe, unqualified identifiers.
    // Supabase/Postgres identifiers are limited (commonly 63 chars).
    if (!/^[a-zA-Z0-9_]+$/.test(safeTableName) || safeTableName.length > 63) {
      return NextResponse.json(
        { error: 'Invalid table name. Use only letters, numbers, and underscores.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Try to create table using RPC function (must create system audit fields too)
    // This requires a PostgreSQL function to be created in Supabase:
    // CREATE OR REPLACE FUNCTION create_dynamic_table(table_name text)
    // RETURNS void AS $$
    // BEGIN
    //   EXECUTE format('CREATE TABLE IF NOT EXISTS %I (
    //     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    //     created_at timestamptz DEFAULT now(),
    //     created_by uuid DEFAULT auth.uid(),
    //     updated_at timestamptz DEFAULT now()
    //     updated_by uuid DEFAULT auth.uid()
    //   )', table_name);
    // END;
    // $$ LANGUAGE plpgsql SECURITY DEFINER;
    
    const { error } = await supabase.rpc('create_dynamic_table', {
      table_name: safeTableName
    })
    
    if (error) {
      console.error('RPC create_dynamic_table error:', error)
      
      // If RPC doesn't exist or fails, try using execute_sql_safe if available.
      // IMPORTANT: `execute_sql_safe` creates the table as the function owner. We MUST also
      // grant `authenticated` access or PostgREST cannot read/write the new table.
      //
      // We also try to use `ensure_audit_fields_for_table` if available so new tables match
      // the app's expected audit schema/trigger behavior.
      const sql = `
DO $$
DECLARE
  tname text := '${safeTableName}';
  has_audit_fn boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'ensure_audit_fields_for_table'
  ) INTO has_audit_fn;

  IF has_audit_fn THEN
    EXECUTE format('CREATE TABLE IF NOT EXISTS public.%I (id uuid PRIMARY KEY DEFAULT gen_random_uuid());', tname);
    PERFORM public.ensure_audit_fields_for_table('public', tname);
  ELSE
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS public.%I (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        created_by uuid NOT NULL DEFAULT auth.uid(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid NOT NULL DEFAULT auth.uid()
      );', tname);
  END IF;

  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated;', tname);
END $$;`.trim()
      
      // Try execute_sql_safe as fallback
      const { error: sqlError } = await supabase.rpc('execute_sql_safe', {
        sql_text: sql
      })
      
      if (sqlError) {
        console.error('execute_sql_safe error:', sqlError)
        return NextResponse.json({
          success: false,
          error: 'RPC functions not available. Please create the table manually or set up the RPC functions.',
          sql,
          message: `Table "${tableName}" needs to be created. Run this SQL in Supabase SQL Editor:\n\n${sql}`
        }, { status: 200 }) // Return 200 with instructions
      }
      
      // If execute_sql_safe succeeded, the table was created
      return NextResponse.json({ success: true, tableName: safeTableName, method: 'execute_sql_safe' })
    }
    
    return NextResponse.json({ success: true, tableName: safeTableName, method: 'create_dynamic_table' })
  } catch (error: unknown) {
    console.error('Error in create-table API:', error)
    const errorMessage = (error as { message?: string })?.message || 'Failed to create table'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
