import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { UserManagement } from "./UserManagement";
import { useToast } from "@/hooks/use-toast";
import { Shield, ArrowLeft } from "lucide-react";

interface AdminDashboardProps {
  onBack: () => void;
}

export const AdminDashboard = ({ onBack }: AdminDashboardProps) => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['administrator', 'superuser'])
        .maybeSingle();

      if (error) throw error;

      setIsAdmin(!!data);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
      toast({
        title: "Fel",
        description: "Kunde inte verifiera administratörsrättigheter",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-xl text-muted-foreground">Verifierar rättigheter...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center p-8">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 mx-auto text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Åtkomst nekad</h3>
            <p className="text-muted-foreground mb-4">
              Du har inte administratörsrättigheter för att komma åt detta område.
            </p>
            <Button onClick={onBack} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Tillbaka
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="w-6 h-6" />
        <h2 className="text-2xl font-bold">Administratörsområde</h2>
      </div>

      <UserManagement />
    </div>
  );
};