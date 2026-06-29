-- Add DELETE policy so users can remove their own activity_feed rows
CREATE POLICY "users can delete own activity"
  ON public.activity_feed
  FOR DELETE
  TO authenticated
  USING (auth.uid() = actor_id);

-- Restrict titles INSERT/UPDATE to service_role only (admin/server-side).
-- Public SELECT remains; user-facing upserts will be routed through a server
-- function using the service role client.
DROP POLICY IF EXISTS "titles can be inserted by authenticated users" ON public.titles;
DROP POLICY IF EXISTS "titles can be updated by authenticated users" ON public.titles;

CREATE POLICY "titles can be inserted by service role"
  ON public.titles
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "titles can be updated by service role"
  ON public.titles
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);