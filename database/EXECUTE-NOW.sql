-- ============================================================
-- WICHTIG: Diese SQL-Befehle JETZT in Supabase ausführen!
-- ============================================================
-- Ohne diese Setup-Scripts funktioniert der Image-Upload NICHT!
--
-- Anleitung:
-- 1. Öffne: https://supabase.com/dashboard
-- 2. Wähle dein Projekt
-- 3. Gehe zu: SQL Editor (linke Sidebar)
-- 4. Kopiere ALLE Befehle unten
-- 5. Klicke "Run"
-- ============================================================

-- SCHRITT 1: Image URL Spalte hinzufügen
-- ============================================================
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN products.image_url IS 'URL to product image in Supabase Storage';


-- SCHRITT 2: Storage Bucket erstellen
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;


-- SCHRITT 3: Storage Policies erstellen
-- ============================================================

-- Policy: Öffentlicher Lesezugriff auf Bilder
CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Policy: Authentifizierte User können Bilder hochladen
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Policy: User können eigene Uploads aktualisieren
CREATE POLICY "Users can update own product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

-- Policy: Admins können Bilder löschen
CREATE POLICY "Admins can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images' 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);


-- SCHRITT 4: Verifikation
-- ============================================================

-- Prüfe ob Bucket erstellt wurde
SELECT 
  id, 
  name, 
  public,
  created_at
FROM storage.buckets 
WHERE id = 'product-images';

-- Erwartetes Ergebnis:
-- | id             | name           | public | created_at              |
-- |----------------|----------------|--------|-------------------------|
-- | product-images | product-images | true   | 2025-12-30 XX:XX:XX+00  |

-- Prüfe ob image_url Spalte existiert
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'products' AND column_name = 'image_url';

-- Erwartetes Ergebnis:
-- | column_name | data_type | is_nullable |
-- |-------------|-----------|-------------|
-- | image_url   | text      | YES         |

-- Prüfe Storage Policies
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE '%product%';

-- Erwartetes Ergebnis: 4 Policies (SELECT, INSERT, UPDATE, DELETE)
