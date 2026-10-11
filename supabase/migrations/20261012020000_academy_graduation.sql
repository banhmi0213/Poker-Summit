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

-- Database verifies the answer sheet before granting the graduation badge.
CREATE OR REPLACE FUNCTION public.submit_academy_graduation(p_answers integer[])
RETURNS TABLE(score integer, passed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
 expected integer[] := ARRAY[0,1,2,0,1,0,1,2,0,1,0,1,1,2,1];
 n integer := 0;
 i integer;
 uid uuid := auth.uid();
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Login required'; END IF;
 IF p_answers IS NULL OR array_length(p_answers,1) IS DISTINCT FROM 15 THEN RAISE EXCEPTION 'Invalid answer count'; END IF;
 FOR i IN 1..15 LOOP
   IF p_answers[i] IS NULL OR p_answers[i] < 0 OR p_answers[i] > 2 THEN RAISE EXCEPTION 'Invalid answer'; END IF;
   IF p_answers[i] = expected[i] THEN n := n+1; END IF;
 END LOOP;
 IF n >= 12 THEN
   INSERT INTO public.academy_graduation(user_id,best_score)
   VALUES(uid,n)
   ON CONFLICT(user_id) DO UPDATE SET
    best_score=GREATEST(academy_graduation.best_score, EXCLUDED.best_score),
    updated_at=now();
 END IF;
 RETURN QUERY SELECT n,n>=12;
END $$;
REVOKE ALL ON FUNCTION public.submit_academy_graduation(integer[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_academy_graduation(integer[]) TO authenticated;
