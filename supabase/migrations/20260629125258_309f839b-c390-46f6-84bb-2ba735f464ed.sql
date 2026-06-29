
DROP POLICY IF EXISTS "users can manage own entries" ON public.entries;
CREATE POLICY "users can manage own entries" ON public.entries
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "curators can manage own lists" ON public.curator_lists;
CREATE POLICY "curators can manage own lists" ON public.curator_lists
  FOR ALL TO authenticated
  USING (auth.uid() = curator_id)
  WITH CHECK (auth.uid() = curator_id);

DROP POLICY IF EXISTS "curators can manage own list items" ON public.curator_list_items;
CREATE POLICY "curators can manage own list items" ON public.curator_list_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.curator_lists WHERE curator_lists.id = curator_list_items.list_id AND curator_lists.curator_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.curator_lists WHERE curator_lists.id = curator_list_items.list_id AND curator_lists.curator_id = auth.uid()));
