CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  display_name text,
  avatar_url text,
  bio text,
  account_type text NOT NULL DEFAULT 'user',
  region text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read all profiles"
  ON public.users FOR SELECT TO authenticated USING (true);

CREATE POLICY "users can update own profile"
  ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tmdb_id integer NOT NULL UNIQUE,
  type text NOT NULL,
  title text NOT NULL,
  overview text NOT NULL DEFAULT '',
  poster_url text,
  backdrop_url text,
  release_date date,
  cached_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.titles TO authenticated;
GRANT ALL ON public.titles TO service_role;

ALTER TABLE public.titles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can view titles"
  ON public.titles FOR SELECT TO authenticated USING (true);

CREATE TABLE public.entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title_id uuid NOT NULL REFERENCES public.titles(id) ON DELETE CASCADE,
  status text NOT NULL,
  rating integer CHECK (rating >= 1 AND rating <= 10),
  updated_at timestamptz,
  watched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, title_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entries TO authenticated;
GRANT ALL ON public.entries TO service_role;

ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage own entries"
  ON public.entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.activity_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  title_id uuid REFERENCES public.titles(id) ON DELETE SET NULL,
  entry_id uuid REFERENCES public.entries(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_feed TO authenticated;
GRANT ALL ON public.activity_feed TO service_role;

ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read feed"
  ON public.activity_feed FOR SELECT TO authenticated USING (true);

CREATE POLICY "users can insert own activity"
  ON public.activity_feed FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id);

CREATE POLICY "users can update own activity"
  ON public.activity_feed FOR UPDATE TO authenticated USING (auth.uid() = actor_id) WITH CHECK (auth.uid() = actor_id);

CREATE POLICY "users can delete own activity"
  ON public.activity_feed FOR DELETE TO authenticated USING (auth.uid() = actor_id);

CREATE TABLE public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view follow relationships"
  ON public.follows FOR SELECT TO authenticated USING (auth.uid() = follower_id OR auth.uid() = following_id);

CREATE POLICY "users can manage own follows"
  ON public.follows FOR ALL TO authenticated USING (auth.uid() = follower_id) WITH CHECK (auth.uid() = follower_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
begin
  insert into public.users (id, username, display_name)
  values (
    new.id,
    split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 4),
    split_part(new.email, '@', 1)
  );
  return new;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();