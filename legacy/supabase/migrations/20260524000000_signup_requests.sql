-- Access requests: users request access; admins approve and send Supabase invite.

CREATE TABLE IF NOT EXISTS public.signup_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT signup_requests_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS signup_requests_pending_email_unique
  ON public.signup_requests (lower(trim(email)))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_signup_requests_status ON public.signup_requests (status);
CREATE INDEX IF NOT EXISTS idx_signup_requests_requested_at ON public.signup_requests (requested_at DESC);

ALTER TABLE public.signup_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read signup requests" ON public.signup_requests;
DROP POLICY IF EXISTS "Admins can update signup requests" ON public.signup_requests;

CREATE POLICY "Admins can read signup requests"
  ON public.signup_requests
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can update signup requests"
  ON public.signup_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.signup_requests IS 'User access requests pending admin approval before Supabase invite';
