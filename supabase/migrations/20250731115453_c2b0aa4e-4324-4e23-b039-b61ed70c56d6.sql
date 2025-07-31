-- First, let's check what type vat_type currently is
-- and then update it to support the new values

-- Since vat_type is currently text, we can simply update the form validation
-- The table already allows text values, so no schema change needed

-- Let's just ensure any existing data uses the new values
UPDATE inventory_items 
SET vat_type = CASE 
  WHEN vat_type = 'IMPORT_VMB' THEN 'VMBI'
  WHEN vat_type = 'IMPORT_MOMS' THEN 'MOMSI'
  ELSE vat_type 
END
WHERE vat_type IN ('IMPORT_VMB', 'IMPORT_MOMS');