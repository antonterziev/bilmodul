import { z } from 'zod';

// Shared validation schemas for frontend and backend
export const inventoryItemSchema = z.object({
  id: z.string().uuid().optional(),
  registration_number: z.string().min(1, 'Registreringsnummer krävs'),
  brand: z.string().min(1, 'Märke krävs'),
  model: z.string().optional(),
  year_model: z.number().min(1900).max(new Date().getFullYear() + 1).optional(),
  mileage: z.number().min(0).optional(),
  purchase_price: z.number().min(0, 'Inköpspris måste vara större än 0'),
  purchase_date: z.string().min(1, 'Inköpsdatum krävs'),
  seller: z.string().optional(),
  purchaser: z.string().min(1, 'Inköpare krävs'),
  vat_type: z.enum(['MOMS', 'MOMSI', 'VMB', 'VMBI']).optional(),
  status: z.enum(['på_lager', 'såld', 'reserverad']).default('på_lager'),
  note: z.string().optional(),
});

export const pakostnadSchema = z.object({
  id: z.string().uuid().optional(),
  inventory_item_id: z.string().uuid(),
  category: z.string().min(1, 'Kategori krävs'),
  supplier: z.string().min(1, 'Leverantör krävs'),
  amount: z.number().min(0, 'Belopp måste vara större än 0'),
  date: z.string().min(1, 'Datum krävs'),
  description: z.string().optional(),
});

export const userPermissionSchema = z.object({
  user_id: z.string().uuid(),
  permission: z.enum(['admin', 'lager', 'inkop', 'forsaljning', 'ekonomi', 'pakostnad']),
});

export const invitationSchema = z.object({
  email: z.string().email('Ogiltig e-postadress'),
  permissions: z.array(z.enum(['admin', 'lager', 'inkop', 'forsaljning', 'ekonomi', 'pakostnad'])),
  organization_id: z.string().uuid(),
});

// Form validation helpers
export function validateForm<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors: Record<string, string> = {};
  result.error.issues.forEach((issue) => {
    const path = issue.path.join('.');
    errors[path] = issue.message;
  });
  
  return { success: false, errors };
}

// Type exports
export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export type Pakostnad = z.infer<typeof pakostnadSchema>;
export type UserPermission = z.infer<typeof userPermissionSchema>;
export type Invitation = z.infer<typeof invitationSchema>;