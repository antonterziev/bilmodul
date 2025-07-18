-- Add sales tracking fields to inventory_items table
ALTER TABLE public.inventory_items 
ADD COLUMN seller TEXT,
ADD COLUMN selling_price DECIMAL(10,2),
ADD COLUMN selling_date DATE,
ADD COLUMN warranty_provided BOOLEAN DEFAULT false,
ADD COLUMN warranty_details TEXT,
ADD COLUMN financing_provided BOOLEAN DEFAULT false,
ADD COLUMN financing_details TEXT,
ADD COLUMN sales_documentation TEXT,
ADD COLUMN sales_channel TEXT,
ADD COLUMN customer_type TEXT,
ADD COLUMN customer_country TEXT,
ADD COLUMN sales_notes TEXT;