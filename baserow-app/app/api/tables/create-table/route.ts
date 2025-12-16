import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * API route to create a Supabase table
 * This uses the service role or executes SQL via RPC
 */
export async function POST(request: NextRequest) {
  try {
    const { tableName, fieldNames = [] } = await request.json()
    
    if (!tableName) {
      return NextResponse.json(
        { error: 'Table name is required' },
        { status: 400 }
      )
    }

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
      // If RPC doesn't exist, return SQL for manual creation
      const sql = `CREATE TABLE IF NOT EXISTS "${tableName}" (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );`
      
      return NextResponse.json({
        success: false,
        error: 'RPC function not available. Please create the table manually or set up the RPC function.',
        sql,
        message: `Table "${tableName}" needs to be created. Run this SQL in Supabase: ${sql}`
      }, { status: 200 }) // Return 200 with instructions
    }
    
    return NextResponse.json({ success: true, tableName })
  } catch (error: any) {
    console.error('Error in create-table API:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create table' },
      { status: 500 }
    )
  }
}
