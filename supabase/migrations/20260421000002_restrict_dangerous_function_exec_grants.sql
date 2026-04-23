-- Restrict execution of high-risk SECURITY DEFINER functions.
-- These functions should never be callable by anon/authenticated API roles.

REVOKE EXECUTE ON FUNCTION public.execute_sql_safe(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.execute_sql_safe(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.execute_sql_safe(text) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.create_dynamic_table(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_dynamic_table(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_dynamic_table(text) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.add_column_to_table(text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_column_to_table(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.add_column_to_table(text, text, text) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.create_table_with_columns(text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_table_with_columns(text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_table_with_columns(text, jsonb) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.get_table_columns(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_table_columns(text) FROM anon;
