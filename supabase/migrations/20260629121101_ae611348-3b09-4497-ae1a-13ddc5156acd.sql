
DROP POLICY "authenticated users can insert activity" ON public.activity_feed;
CREATE POLICY "authenticated users can insert activity" ON public.activity_feed
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id);

DROP POLICY "users can manage own follows" ON public.follows;
CREATE POLICY "users can manage own follows" ON public.follows
  FOR ALL TO authenticated
  USING (auth.uid() = follower_id)
  WITH CHECK (auth.uid() = follower_id);

DROP POLICY "authenticated users can send recommendations" ON public.recommendations;
CREATE POLICY "authenticated users can send recommendations" ON public.recommendations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

DROP POLICY "recipient can update recommendation status" ON public.recommendations;
CREATE POLICY "recipient can update recommendation status" ON public.recommendations
  FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);
