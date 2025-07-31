-- Update the vat_type enum to include the new import options
ALTER TYPE vat_type ADD VALUE IF NOT EXISTS 'VMBI';
ALTER TYPE vat_type ADD VALUE IF NOT EXISTS 'MOMSI';

-- Update any existing 'IMPORT_VMB' values to 'VMBI' if they exist
UPDATE inventory_items SET vat_type = 'VMBI' WHERE vat_type = 'IMPORT_VMB';

-- Update any existing 'IMPORT_MOMS' values to 'MOMSI' if they exist  
UPDATE inventory_items SET vat_type = 'MOMSI' WHERE vat_type = 'IMPORT_MOMS';