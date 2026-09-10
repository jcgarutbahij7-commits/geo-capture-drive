CREATE TABLE public.submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  local_id TEXT UNIQUE,
  company TEXT NOT NULL,
  village TEXT NOT NULL,
  cpcl_no TEXT NOT NULL,
  cpcl_name TEXT NOT NULL,
  pelimpahan BOOLEAN NOT NULL DEFAULT false,
  pelimpahan_name TEXT,
  nik TEXT NOT NULL,
  address TEXT NOT NULL,
  cpcl_phone TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  officer_name TEXT NOT NULL,
  officer_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  photo_count INTEGER NOT NULL DEFAULT 0,
  drive_folder_id TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX submissions_company_idx ON public.submissions (company);
CREATE INDEX submissions_submitted_at_idx ON public.submissions (submitted_at DESC);

GRANT ALL ON public.submissions TO service_role;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;