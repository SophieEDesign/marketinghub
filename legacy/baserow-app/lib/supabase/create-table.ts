import { createClient } from './server'

/**
 * Creates a Supabase table dynamically
 * This requires a PostgreSQL function to be created in Supabase first
 */
export async function createSupabaseTable(tableName: string, fieldNames: string[] = []) {
  const supabase = await createClient()
  
  try {
    // First, try to create the table using RPC if a function exists
    // The function should be created in Supabase with:
    // CREATE OR REPLACE FUNCTION create_dynamic_table(table_name text, columns text[])
    // RETURNS void AS $$
    // BEGIN
    //   EXECUTE format('CREATE TABLE IF NOT EXISTS %I (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now())', table_name);
    //   -- Add columns dynamically if needed
    // END;
    // $$ LANGUAGE plpgsql SECURITY DEFINER;
    
    // For now, we'll use a simpler approach: create table with just id and timestamps
    // Additional columns will be added dynamically as data is inserted
    
    const { error: rpcError } = await supabase.rpc('create_dynamic_table', {
      table_name: tableName,
      columns: fieldNames
    })
    
    if (rpcError) {
      // If RPC function doesn't exist, try direct SQL execution via REST API
      // This requires service role key, so we'll handle it differently
      console.warn('RPC function not available, table may need to be created manually:', rpcError)
      
      // Fallback: Return success but log that manual creation may be needed
      // The table will be created on first insert if it doesn't exist (if auto-create is enabled)
      return { success: false, error: rpcError.message }
    }
    
    return { success: true }
  } catch (error: any) {
    console.error('Error creating Supabase table:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Alternative: Create table using direct SQL (requires service role)
 * This should only be called from server-side API routes
 */
export async function createSupabaseTableDirect(tableName: string) {
  // This would require using the service role key
  // For security, this should be in an API route, not exposed to client
  // Implementation would use Supabase Management API or direct PostgreSQL connection
  
  // For now, return a helper message
  return {
    success: false,
    error: 'Direct table creation requires service role. Use RPC function or create manually.',
    sql: `CREATE TABLE IF NOT EXISTS "${tableName}" (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );`
  }
}
