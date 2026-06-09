-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title_tr text NOT NULL,
  title_en text,
  title_de text,
  title_fr text,
  title_ru text,
  description_tr text,
  description_en text,
  description_de text,
  description_fr text,
  description_ru text,
  file_url text NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint,
  file_type text,
  uploaded_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read documents"
  ON documents FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin can insert documents"
  ON documents FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can update documents"
  ON documents FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can delete documents"
  ON documents FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── Storage bucket (run these in Supabase dashboard SQL editor) ─────────────
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true)
--   ON CONFLICT (id) DO NOTHING;
--
-- CREATE POLICY "Authenticated users can read document files"
--   ON storage.objects FOR SELECT TO authenticated
--   USING (bucket_id = 'documents');
--
-- CREATE POLICY "Admin can upload document files"
--   ON storage.objects FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'documents' AND
--     EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
--
-- CREATE POLICY "Admin can delete document files"
--   ON storage.objects FOR DELETE TO authenticated
--   USING (bucket_id = 'documents' AND
--     EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
