-- Update the calculate_inventory_value function to use 20% VAT for MOMS/MOMSI
CREATE OR REPLACE FUNCTION public.calculate_inventory_value(vat_type_param text, purchase_price_param numeric, inventory_item_id_param uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  base_value numeric;
  pakostnader_total numeric;
BEGIN
  -- Calculate base value based on VAT type
  IF vat_type_param IN ('MOMS', 'MOMSI') THEN
    base_value := purchase_price_param * 0.8; -- Deduct 20% VAT (was 25%)
  ELSIF vat_type_param IN ('VMB', 'VMBI') THEN
    base_value := purchase_price_param; -- Full purchase price
  ELSE
    base_value := purchase_price_param; -- Default to full price
  END IF;
  
  -- Get sum of påkostnader for this inventory item
  SELECT COALESCE(SUM(amount), 0) 
  INTO pakostnader_total
  FROM public.pakostnader 
  WHERE inventory_item_id = inventory_item_id_param;
  
  -- Return base value plus påkostnader
  RETURN base_value + pakostnader_total;
END;
$function$;

-- Update the calculate_lagervaerde function to use 20% VAT for MOMS/MOMSI
CREATE OR REPLACE FUNCTION public.calculate_lagervaerde(vat_type_param text, purchase_price_param numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
  -- If VMB or VMBI, use full purchase price
  IF vat_type_param IN ('VMB', 'VMBI') THEN
    RETURN purchase_price_param;
  END IF;
  
  -- If MOMS or MOMSI, use purchase price less 20% (was 25%)
  IF vat_type_param IN ('MOMS', 'MOMSI') THEN
    RETURN purchase_price_param * 0.8;
  END IF;
  
  -- Default: return full purchase price for unknown VAT types
  RETURN purchase_price_param;
END;
$function$;

-- Update all existing inventory values to use the new calculation
UPDATE public.inventory_items 
SET inventory_value = public.calculate_inventory_value(vat_type, purchase_price, id)
WHERE vat_type IS NOT NULL;