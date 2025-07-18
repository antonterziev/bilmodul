import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const purchaseSchema = z.object({
  // Vehicle data
  registration_number: z.string().min(1, "Registreringsnummer krävs"),
  chassis_number: z.string().optional(),
  mileage: z.number().min(0).optional(),
  brand: z.string().min(1, "Bilmärke krävs"),
  model: z.string().optional(),
  comment: z.string().optional(),
  year_model: z.number().min(1900).max(new Date().getFullYear() + 1).optional(),
  first_registration_date: z.date().optional(),
  vat_type: z.string().optional(),
  
  // Purchase information
  purchaser: z.string().min(1, "Inköpare krävs"),
  purchase_price: z.number().min(0, "Inköpspris måste vara positivt"),
  purchase_date: z.date(),
  down_payment: z.number().min(0).optional(),
  down_payment_docs_sent: z.boolean().default(false),
  purchase_documentation: z.string().optional(),
  purchase_docs_sent: z.boolean().default(false),
  purchase_channel: z.string().optional(),
  expected_selling_price: z.number().min(0).optional(),
});

type PurchaseFormData = z.infer<typeof purchaseSchema>;

interface PurchaseFormProps {
  onSuccess: () => void;
}

export const PurchaseForm = ({ onSuccess }: PurchaseFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<PurchaseFormData>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      purchase_date: new Date(),
      down_payment: 0,
      down_payment_docs_sent: false,
      purchase_docs_sent: false,
    },
  });

  const onSubmit = async (data: PurchaseFormData) => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      const insertData = {
        user_id: user.id,
        status: 'på_lager' as const,
        registration_number: data.registration_number,
        chassis_number: data.chassis_number || null,
        mileage: data.mileage || null,
        brand: data.brand,
        model: data.model || null,
        comment: data.comment || null,
        year_model: data.year_model || null,
        first_registration_date: data.first_registration_date?.toISOString().split('T')[0] || null,
        vat_type: data.vat_type || null,
        purchaser: data.purchaser,
        purchase_price: data.purchase_price,
        purchase_date: data.purchase_date.toISOString().split('T')[0],
        down_payment: data.down_payment || 0,
        down_payment_docs_sent: data.down_payment_docs_sent,
        purchase_documentation: data.purchase_documentation || null,
        purchase_docs_sent: data.purchase_docs_sent,
        purchase_channel: data.purchase_channel || null,
        expected_selling_price: data.expected_selling_price || null,
      };

      const { error } = await supabase
        .from('inventory_items')
        .insert(insertData);

      if (error) throw error;

      toast({
        title: "Framgång",
        description: "Fordon har lagts till i lagret",
      });
      
      form.reset();
      onSuccess();
    } catch (error) {
      console.error('Error creating purchase:', error);
      toast({
        title: "Fel",
        description: "Det gick inte att lägga till fordonet",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Ny Inköp</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Vehicle Data Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Fordonsdata</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="registration_number">Registreringsnummer *</Label>
                <Input
                  id="registration_number"
                  {...form.register("registration_number")}
                  className={form.formState.errors.registration_number ? "border-destructive" : ""}
                />
                {form.formState.errors.registration_number && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.registration_number.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="chassis_number">Chassinummer</Label>
                <Input id="chassis_number" {...form.register("chassis_number")} />
              </div>

              <div>
                <Label htmlFor="mileage">Milttal (km)</Label>
                <Input
                  id="mileage"
                  type="number"
                  {...form.register("mileage", { valueAsNumber: true })}
                />
              </div>

              <div>
                <Label htmlFor="brand">Bilmärke *</Label>
                <Input
                  id="brand"
                  {...form.register("brand")}
                  className={form.formState.errors.brand ? "border-destructive" : ""}
                />
                {form.formState.errors.brand && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.brand.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="model">Modell</Label>
                <Input id="model" {...form.register("model")} />
              </div>

              <div>
                <Label htmlFor="year_model">Årsmodell</Label>
                <Input
                  id="year_model"
                  type="number"
                  {...form.register("year_model", { valueAsNumber: true })}
                />
              </div>

              <div>
                <Label htmlFor="first_registration_date">Första registreringsdatum</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.watch("first_registration_date") 
                        ? format(form.watch("first_registration_date"), "yyyy-MM-dd")
                        : "Välj datum"
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={form.watch("first_registration_date")}
                      onSelect={(date) => form.setValue("first_registration_date", date)}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label htmlFor="vat_type">Momstyp</Label>
                <Select onValueChange={(value) => form.setValue("vat_type", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj momstyp" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VMB">VMB</SelectItem>
                    <SelectItem value="Moms">Moms</SelectItem>
                    <SelectItem value="Momsfri">Momsfri</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="comment">Kommentar</Label>
              <Textarea id="comment" {...form.register("comment")} />
            </div>
          </div>

          {/* Purchase Information Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Inköpsinformation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="purchaser">Inköpare *</Label>
                <Input
                  id="purchaser"
                  {...form.register("purchaser")}
                  className={form.formState.errors.purchaser ? "border-destructive" : ""}
                />
                {form.formState.errors.purchaser && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.purchaser.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="purchase_price">Inköpspris (SEK) *</Label>
                <Input
                  id="purchase_price"
                  type="number"
                  step="0.01"
                  {...form.register("purchase_price", { valueAsNumber: true })}
                  className={form.formState.errors.purchase_price ? "border-destructive" : ""}
                />
                {form.formState.errors.purchase_price && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.purchase_price.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="purchase_date">Inköpsdatum *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.watch("purchase_date") 
                        ? format(form.watch("purchase_date"), "yyyy-MM-dd")
                        : "Välj datum"
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={form.watch("purchase_date")}
                      onSelect={(date) => form.setValue("purchase_date", date || new Date())}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label htmlFor="down_payment">Handpenning (SEK)</Label>
                <Input
                  id="down_payment"
                  type="number"
                  step="0.01"
                  {...form.register("down_payment", { valueAsNumber: true })}
                />
              </div>

              <div>
                <Label htmlFor="purchase_channel">Inköpskanal</Label>
                <Input id="purchase_channel" {...form.register("purchase_channel")} />
              </div>

              <div>
                <Label htmlFor="expected_selling_price">Förväntad säljpris (SEK)</Label>
                <Input
                  id="expected_selling_price"
                  type="number"
                  step="0.01"
                  {...form.register("expected_selling_price", { valueAsNumber: true })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="purchase_documentation">Inköpsunderlag</Label>
              <Textarea id="purchase_documentation" {...form.register("purchase_documentation")} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="down_payment_docs_sent"
                  checked={form.watch("down_payment_docs_sent")}
                  onCheckedChange={(checked) => form.setValue("down_payment_docs_sent", !!checked)}
                />
                <Label htmlFor="down_payment_docs_sent">Handpenningsunderlag skickat?</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="purchase_docs_sent"
                  checked={form.watch("purchase_docs_sent")}
                  onCheckedChange={(checked) => form.setValue("purchase_docs_sent", !!checked)}
                />
                <Label htmlFor="purchase_docs_sent">Inköpsunderlag skickat?</Label>
              </div>
            </div>
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Registrerar..." : "Registrera inköp"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};