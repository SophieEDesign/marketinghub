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

    const supabase = await createClient()
    
    // Try to create table using RPC function
    // This requires a PostgreSQL function to be created in Supabase:
    // CREATE OR REPLACE FUNCTION create_dynamic_table(table_name text)
    // RETURNS void AS $$
    // BEGIN
    //   EXECUTE format('CREATE TABLE IF NOT EXISTS %I (
    //     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    //     created_at timestamptz DEFAULT now(),
    //     updated_at timestamptz DEFAULT now()
    //   )', table_name);
    // END;
    // $$ LANGUAGE plpgsql SECURITY DEFINER;
    
    const { error } = await supabase.rpc('create_dynamic_table', {
      table_name: tableName
    })
    
    if (error) {
      console.error('RPC create_dynamic_table error:', error)
      
      // If RPC doesn't exist or fails, try using execute_sql_safe if available
      const sql = `CREATE TABLE IF NOT EXISTS "${tableName}" (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );`
      
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
      return NextResponse.json({ success: true, tableName, method: 'execute_sql_safe' })
    }
    
    return NextResponse.json({ success: true, tableName, method: 'create_dynamic_table' })
  } catch (error: any) {
    console.error('Error in create-table API:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create table' },
      { status: 500 }
    )
  }
}
