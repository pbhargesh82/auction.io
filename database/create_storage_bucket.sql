-- =====================================================
-- Supabase Storage: Create images bucket with RLS
-- =====================================================

-- 1. Create the storage bucket for images (team logos, player photos)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow authenticated users to upload their own images
CREATE POLICY "Authenticated users can upload images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'images');

-- 3. Allow authenticated users to update their own images
CREATE POLICY "Users can update their own images" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 4. Allow authenticated users to delete their own images
CREATE POLICY "Users can delete their own images" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 5. Allow public read access to all images in the bucket
CREATE POLICY "Public read access for images" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'images');

-- =====================================================
-- DONE: Run this in Supabase SQL Editor
-- =====================================================
