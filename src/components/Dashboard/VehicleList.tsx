import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Vehicle {
  id: string;
  registration_number: string;
  brand: string;
  model: string | null;
  purchase_date: string;
  purchaser: string;
  status: string;
}

export const VehicleList = () => {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadVehicles();
    }
  }, [user]);

  const loadVehicles = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, registration_number, brand, model, purchase_date, purchaser, status')
        .eq('user_id', user.id)
        .order('purchase_date', { ascending: false });

      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'på_lager':
        return 'default';
      case 'på_väg':
        return 'secondary';
      case 'såld':
        return 'outline';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'på_lager':
        return 'På lager';
      case 'på_väg':
        return 'På väg';
      case 'såld':
        return 'Såld';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fordon</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Laddar fordon...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrerade fordon</CardTitle>
      </CardHeader>
      <CardContent>
        {vehicles.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Inga fordon registrerade än.</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Registreringsnummer</TableHead>
                  <TableHead>Bilmärke</TableHead>
                  <TableHead>Modell</TableHead>
                  <TableHead>Inköpsdatum</TableHead>
                  <TableHead>Inköpare</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell className="font-medium">{vehicle.registration_number}</TableCell>
                    <TableCell>{vehicle.brand}</TableCell>
                    <TableCell>{vehicle.model || '-'}</TableCell>
                    <TableCell>{formatDate(vehicle.purchase_date)}</TableCell>
                    <TableCell>{vehicle.purchaser}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(vehicle.status)}>
                        {getStatusLabel(vehicle.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};