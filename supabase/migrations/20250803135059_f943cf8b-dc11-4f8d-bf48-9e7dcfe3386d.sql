-- Remove additional_costs column since we have separate pakostnader table
ALTER TABLE public.inventory_items DROP COLUMN IF EXISTS additional_costs;

-- Add VAT_amount column for easier calculations
ALTER TABLE public.inventory_items ADD COLUMN VAT_amount numeric;

-- Populate VAT_amount based on vat_type
UPDATE public.inventory_items 
SET VAT_amount = CASE 
  WHEN vat_type IN ('MOMS', 'MOMSI') THEN purchase_price * 0.8
  ELSE NULL
END;

-- Update calculate_inventory_value function to use VAT_amount column
CREATE OR REPLACE FUNCTION public.calculate_inventory_value(vat_type_param text, purchase_price_param numeric, inventory_item_id_param uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  base_value numeric;
  pakostnader_total numeric;
  vat_amount_value numeric;
BEGIN
  -- Get VAT amount from the inventory item
  SELECT VAT_amount INTO vat_amount_value
  FROM public.inventory_items 
  WHERE id = inventory_item_id_param;
  
  -- Calculate base value based on VAT type
  IF vat_type_param IN ('MOMS', 'MOMSI') THEN
    base_value := COALESCE(vat_amount_value, purchase_price_param * 0.8);
  ELSIF vat_type_param IN ('VMB', 'VMBI') THEN
    base_value := purchase_price_param; -- Full purchase price
  ELSE
    base_value := purchase_price_param; -- Default to full price
  END IF;
  
  -- Get sum of påkostnader for this inventory item, applying 80% (excluding 20% VAT)
  SELECT COALESCE(SUM(amount * 0.8), 0) 
  INTO pakostnader_total
  FROM public.pakostnader 
  WHERE inventory_item_id = inventory_item_id_param;
  
  -- Return base value plus adjusted påkostnader
  RETURN base_value + pakostnader_total;
END;
$function$;

-- Update calculate_lagervaerde function to use VAT_amount column
CREATE OR REPLACE FUNCTION public.calculate_lagervaerde(vat_type_param text, purchase_price_param numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- If VMB or VMBI, use full purchase price
  IF vat_type_param IN ('VMB', 'VMBI') THEN
    RETURN purchase_price_param;
  END IF;
  
  -- If MOMS or MOMSI, use purchase price less 20%
  IF vat_type_param IN ('MOMS', 'MOMSI') THEN
    RETURN purchase_price_param * 0.8;
  END IF;
  
  -- Default: return full purchase price for unknown VAT types
  RETURN purchase_price_param;
END;
$function$;

-- Create trigger to automatically populate VAT_amount on insert/update
CREATE OR REPLACE FUNCTION public.update_vat_amount()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Set VAT_amount based on vat_type
  IF NEW.vat_type IN ('MOMS', 'MOMSI') THEN
    NEW.VAT_amount := NEW.purchase_price * 0.8;
  ELSE
    NEW.VAT_amount := NULL;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for VAT_amount updates
DROP TRIGGER IF EXISTS update_vat_amount_trigger ON public.inventory_items;
CREATE TRIGGER update_vat_amount_trigger
  BEFORE INSERT OR UPDATE OF purchase_price, vat_type ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_vat_amount();

-- Update all existing inventory values to use the new calculation
UPDATE public.inventory_items 
SET inventory_value = public.calculate_inventory_value(vat_type, purchase_price, id)
WHERE vat_type IS NOT NULL;