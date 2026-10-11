ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS device text NOT NULL DEFAULT 'all' CHECK (device IN ('all','pc','mobile'));
