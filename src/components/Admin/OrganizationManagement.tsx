import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Building, Plus, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

interface Organization {
  id: string;
  name: string;
  created_at: string;
  user_count: number;
}

const organizationSchema = z.object({
  name: z.string().min(1, "Organisationsnamn krävs")
});

type OrganizationForm = z.infer<typeof organizationSchema>;

export const OrganizationManagement = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<OrganizationForm>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: ""
    }
  });

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select(`
          id,
          name,
          created_at,
          profiles(count)
        `)
        .order('name');

      if (error) throw error;

      const formattedOrgs: Organization[] = data?.map((org: any) => ({
        id: org.id,
        name: org.name,
        created_at: org.created_at,
        user_count: org.profiles?.[0]?.count || 0
      })) || [];

      setOrganizations(formattedOrgs);
    } catch (error) {
      console.error('Error loading organizations:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ladda organisationer",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createOrganization = async (data: OrganizationForm) => {
    try {
      const { error } = await supabase
        .from('organizations')
        .insert({ name: data.name });

      if (error) throw error;

      toast({
        title: "Skapad",
        description: "Organisationen har skapats"
      });

      form.reset();
      setIsDialogOpen(false);
      loadOrganizations();
    } catch (error) {
      console.error('Error creating organization:', error);
      toast({
        title: "Fel",
        description: "Kunde inte skapa organisation",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Laddar organisationer...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Organisationshantering</h3>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Ny organisation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Skapa ny organisation</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(createOrganization)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organisationsnamn</FormLabel>
                      <FormControl>
                        <Input placeholder="Ange organisationsnamn" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Skapa
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Avbryt
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alla organisationer</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Namn</TableHead>
                <TableHead>Antal användare</TableHead>
                <TableHead>Skapad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell>{org.user_count}</TableCell>
                  <TableCell>
                    {new Date(org.created_at).toLocaleDateString('sv-SE')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};