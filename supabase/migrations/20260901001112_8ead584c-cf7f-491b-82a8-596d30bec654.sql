ALTER TABLE public.sugestoes_populares ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'lp';

-- Backfill existing records
UPDATE public.sugestoes_populares SET origem = 'lp' WHERE origem IS NULL OR origem = '';

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_sugestoes_populares_origem ON public.sugestoes_populares(origem);