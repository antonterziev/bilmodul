-- Create storage bucket for down payment documents
INSERT INTO storage.buckets (id, name, public) VALUES ('down-payment-docs', 'down-payment-docs', false);

-- Create policies for down payment document uploads
CREATE POLICY "Users can view their own down payment documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'down-payment-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own down payment documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'down-payment-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own down payment documents" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'down-payment-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own down payment documents" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'down-payment-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add column to store down payment document file path
ALTER TABLE public.inventory_items 
ADD COLUMN down_payment_document_path TEXT;