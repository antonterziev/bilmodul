
-- Create inventory/purchase table for vehicles
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  
  -- Vehicle data
  registration_number TEXT NOT NULL,
  chassis_number TEXT,
  mileage INTEGER,
  brand TEXT,
  model TEXT,
  comment TEXT,
  year_model INTEGER,
  first_registration_date DATE,
  vat_type TEXT,
  
  -- Purchase information
  purchaser TEXT NOT NULL,
  purchase_price DECIMAL(10,2) NOT NULL,
  purchase_date DATE NOT NULL,
  down_payment DECIMAL(10,2) DEFAULT 0,
  down_payment_docs_sent BOOLEAN DEFAULT false,
  purchase_documentation TEXT,
  purchase_docs_sent BOOLEAN DEFAULT false,
  purchase_channel TEXT,
  expected_selling_price DECIMAL(10,2),
  
  -- Status and timestamps
  status TEXT NOT NULL DEFAULT 'på_lager',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT valid_status CHECK (status IN ('på_lager', 'såld', 'på_väg'))
);

-- Enable Row Level Security
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own inventory items" 
ON public.inventory_items 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own inventory items" 
ON public.inventory_items 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own inventory items" 
ON public.inventory_items 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own inventory items" 
ON public.inventory_items 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_inventory_items_updated_at
BEFORE UPDATE ON public.inventory_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_inventory_items_user_id ON public.inventory_items(user_id);
CREATE INDEX idx_inventory_items_status ON public.inventory_items(status);
CREATE INDEX idx_inventory_items_registration ON public.inventory_items(registration_number);
