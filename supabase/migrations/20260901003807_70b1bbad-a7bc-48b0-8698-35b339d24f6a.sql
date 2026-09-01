CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.whatsapp_ingest_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.whatsapp_ingest_config TO authenticated;
GRANT ALL ON public.whatsapp_ingest_config TO service_role;

ALTER TABLE public.whatsapp_ingest_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view whatsapp ingest config"
ON public.whatsapp_ingest_config FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_master'));

CREATE POLICY "Admins can update whatsapp ingest config"
ON public.whatsapp_ingest_config FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_master'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_master'));

INSERT INTO public.whatsapp_ingest_config (token)
SELECT encode(gen_random_bytes(32), 'hex')
WHERE NOT EXISTS (SELECT 1 FROM public.whatsapp_ingest_config);

ALTER TABLE public.sugestoes_populares ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS sugestoes_populares_external_id_uidx
  ON public.sugestoes_populares (external_id) WHERE external_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.regenerate_whatsapp_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_token TEXT;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_master')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  new_token := encode(gen_random_bytes(32), 'hex');

  IF EXISTS (SELECT 1 FROM public.whatsapp_ingest_config) THEN
    UPDATE public.whatsapp_ingest_config
      SET token = new_token, updated_at = now()
      WHERE id = (SELECT id FROM public.whatsapp_ingest_config ORDER BY created_at LIMIT 1);
  ELSE
    INSERT INTO public.whatsapp_ingest_config (token) VALUES (new_token);
  END IF;

  RETURN new_token;
END;
$$;

REVOKE ALL ON FUNCTION public.regenerate_whatsapp_token() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regenerate_whatsapp_token() TO authenticated;