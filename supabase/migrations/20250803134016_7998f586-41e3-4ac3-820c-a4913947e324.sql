-- Update calculate_inventory_value function to apply 80% to påkostnader amounts
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
    base_value := purchase_price_param * 0.8; -- Deduct 20% VAT
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

-- Update all existing inventory values to use the new calculation
UPDATE public.inventory_items 
SET inventory_value = public.calculate_inventory_value(vat_type, purchase_price, id)
WHERE vat_type IS NOT NULL;