export function isAuthBypass() {
  return process.env.AUTH_BYPASS === "true";
}

export function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export const DEMO_STAFF: {
  id: string;
  email: string;
  full_name: string;
  role: "admin";
} = {
  id: "demo-staff",
  email: "marketing@petersandmay.com",
  full_name: "Marketing Team",
  role: "admin",
};
