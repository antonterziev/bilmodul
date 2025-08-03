-- Fix security warning by adding SET search_path to update_lagervaerde function
CREATE OR REPLACE FUNCTION public.update_lagervaerde()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  NEW.lagervaerde = public.calculate_lagervaerde(NEW.vat_type, NEW.purchase_price);
  RETURN NEW;
END;
$function$;