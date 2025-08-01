-- Create a table for vehicle notes
CREATE TABLE public.vehicle_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  note_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.vehicle_notes ENABLE ROW LEVEL SECURITY;

-- Create policies for vehicle notes
CREATE POLICY "Users can view notes for vehicles in their organization" 
ON public.vehicle_notes 
FOR SELECT 
USING (
  vehicle_id IN (
    SELECT id FROM public.inventory_items 
    WHERE organization_id = get_user_organization_id()
  )
);

CREATE POLICY "Users can create notes for vehicles in their organization" 
ON public.vehicle_notes 
FOR INSERT 
WITH CHECK (
  vehicle_id IN (
    SELECT id FROM public.inventory_items 
    WHERE organization_id = get_user_organization_id()
  )
  AND auth.uid() = user_id
);

CREATE POLICY "Users can update their own notes" 
ON public.vehicle_notes 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes" 
ON public.vehicle_notes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_vehicle_notes_updated_at
BEFORE UPDATE ON public.vehicle_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();