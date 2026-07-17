-- Event Attendance: per-user RSVP status linked to source table event rows (Content record id).

CREATE TABLE IF NOT EXISTS public.event_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attendance_status text NOT NULL CHECK (
    attendance_status IN ('attending', 'maybe', 'not_attending', 'interested')
  ),
  company text,
  role text,
  notes text,
  visibility text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_attendance_event_id ON public.event_attendance (event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendance_user_id ON public.event_attendance (user_id);

ALTER TABLE public.event_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_attendance_select_authenticated" ON public.event_attendance;
CREATE POLICY "event_attendance_select_authenticated"
  ON public.event_attendance FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "event_attendance_insert_own" ON public.event_attendance;
CREATE POLICY "event_attendance_insert_own"
  ON public.event_attendance FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "event_attendance_update_own" ON public.event_attendance;
CREATE POLICY "event_attendance_update_own"
  ON public.event_attendance FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "event_attendance_delete_own" ON public.event_attendance;
CREATE POLICY "event_attendance_delete_own"
  ON public.event_attendance FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "event_attendance_admin_all" ON public.event_attendance;
CREATE POLICY "event_attendance_admin_all"
  ON public.event_attendance FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_attendance TO authenticated;

CREATE OR REPLACE FUNCTION public.event_attendance_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS event_attendance_updated_at ON public.event_attendance;
CREATE TRIGGER event_attendance_updated_at
  BEFORE UPDATE ON public.event_attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.event_attendance_set_updated_at();
