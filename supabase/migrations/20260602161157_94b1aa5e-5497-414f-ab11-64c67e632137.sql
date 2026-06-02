
CREATE TABLE public.compression_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  original_size BIGINT NOT NULL,
  compressed_size BIGINT NOT NULL,
  compression_ratio NUMERIC NOT NULL,
  space_saving_pct NUMERIC NOT NULL,
  original_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.compression_history TO anon, authenticated;
GRANT ALL ON public.compression_history TO service_role;

ALTER TABLE public.compression_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read history" ON public.compression_history FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can insert history" ON public.compression_history FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public can delete history" ON public.compression_history FOR DELETE TO anon, authenticated USING (true);
