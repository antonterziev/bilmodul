-- Fix security warnings by setting search_path for new functions

-- Update calculate_inventory_value function with security definer and search_path
CREATE OR REPLACE FUNCTION public.calculate_inventory_value(
  vat_type_param text, 
  purchase_price_param numeric, 
  inventory_item_id_param uuid
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  base_value numeric;
  pakostnader_total numeric;
BEGIN
  -- Calculate base value based on VAT type
  IF vat_type_param IN ('MOMS', 'MOMSI') THEN
    base_value := purchase_price_param * 0.75; -- Deduct 25%
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
$$;

-- Update update_inventory_value function with security definer and search_path
CREATE OR REPLACE FUNCTION public.update_inventory_value()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  NEW.inventory_value = public.calculate_inventory_value(
    NEW.vat_type, 
    NEW.purchase_price, 
    NEW.id
  );
  RETURN NEW;
END;
$$;

-- Update update_related_inventory_value function with security definer and search_path
CREATE OR REPLACE FUNCTION public.update_related_inventory_value()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Update the related inventory item's inventory_value
  UPDATE public.inventory_items 
  SET inventory_value = public.calculate_inventory_value(
    vat_type, 
    purchase_price, 
    id
  )
  WHERE id = COALESCE(NEW.inventory_item_id, OLD.inventory_item_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;