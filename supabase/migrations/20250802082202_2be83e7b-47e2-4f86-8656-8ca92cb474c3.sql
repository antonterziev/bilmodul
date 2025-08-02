-- Create pakostnader table
CREATE TABLE public.pakostnader (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    supplier TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    category TEXT NOT NULL,
    date DATE NOT NULL,
    description TEXT,
    fortnox_invoice_number TEXT,
    is_synced BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.pakostnader ENABLE ROW LEVEL SECURITY;

-- Create policies for pakostnader
CREATE POLICY "Users can view pakostnader from their organization" 
ON public.pakostnader 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.inventory_items i 
        JOIN public.profiles p ON p.organization_id = (
            SELECT p2.organization_id FROM public.profiles p2 WHERE p2.user_id = auth.uid()
        )
        WHERE i.id = pakostnader.inventory_item_id 
        AND i.organization_id = p.organization_id
    )
);

CREATE POLICY "Users can create pakostnader for their organization" 
ON public.pakostnader 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.inventory_items i 
        JOIN public.profiles p ON p.organization_id = (
            SELECT p2.organization_id FROM public.profiles p2 WHERE p2.user_id = auth.uid()
        )
        WHERE i.id = pakostnader.inventory_item_id 
        AND i.organization_id = p.organization_id
    )
);

CREATE POLICY "Users can update pakostnader from their organization" 
ON public.pakostnader 
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.inventory_items i 
        JOIN public.profiles p ON p.organization_id = (
            SELECT p2.organization_id FROM public.profiles p2 WHERE p2.user_id = auth.uid()
        )
        WHERE i.id = pakostnader.inventory_item_id 
        AND i.organization_id = p.organization_id
    )
);

CREATE POLICY "Users can delete pakostnader from their organization" 
ON public.pakostnader 
FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.inventory_items i 
        JOIN public.profiles p ON p.organization_id = (
            SELECT p2.organization_id FROM public.profiles p2 WHERE p2.user_id = auth.uid()
        )
        WHERE i.id = pakostnader.inventory_item_id 
        AND i.organization_id = p.organization_id
    )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_pakostnader_updated_at
BEFORE UPDATE ON public.pakostnader
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();