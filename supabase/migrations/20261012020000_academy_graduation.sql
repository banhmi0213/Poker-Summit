-- Academy graduation achievement. Existing tables and data are unchanged.
CREATE TABLE IF NOT EXISTS public.academy_graduation (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 best_score integer NOT NULL CHECK (best_score BETWEEN 0 AND 15),
 passed_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.academy_graduation ENABLE ROW LEVEL SECURITY;
-- Public badges are visible to readers of Summit posts; only server-side actions write results.
DROP POLICY IF EXISTS "Public graduation badges" ON public.academy_graduation;
CREATE POLICY "Public graduation badges" ON public.academy_graduation FOR SELECT TO anon, authenticated USING (true);
-- No INSERT/UPDATE/DELETE policies: write through authenticated server-side action with service role.
CREATE INDEX IF NOT EXISTS academy_graduation_passed_at_idx ON public.academy_graduation(passed_at DESC);
