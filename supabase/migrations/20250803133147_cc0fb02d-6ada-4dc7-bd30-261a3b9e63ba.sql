-- Fix security warning by adding SET search_path to calculate_lagervaerde function
CREATE OR REPLACE FUNCTION public.calculate_lagervaerde(vat_type_param text, purchase_price_param numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
 SECURITY DEFINER
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