import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, DollarSign, FileText, Trash2, Car, Plus, ShoppingCart, Calculator } from "lucide-react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { useToast } from "@/hooks/use-toast";

interface VehicleDetails {
  id: string;
  registration_number: string;
  brand: string;
  model: string | null;
  year_model?: number;
  mileage?: number;
  chassis_number?: string;
  first_registration_date?: string;
  purchase_date: string;
  selling_date?: string;
  purchaser: string;
  purchase_price: number;
  selling_price: number | null;
  additional_costs?: number;
  status: string;
  fortnox_sync_status?: string;
  fortnox_verification_number?: string;
  vat_type?: string;
  user_id: string;
  seller?: string;
  purchase_channel?: string;
  sales_channel?: string;
  customer_type?: string;
  customer_country?: string;
  comment?: string;
  registered_by?: string;
}

interface VehicleDetailsViewProps {
  vehicleId: string;
  onBack: () => void;
}

export const VehicleDetailsView = ({ vehicleId, onBack }: VehicleDetailsViewProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vehicle, setVehicle] = useState<VehicleDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeButton, setActiveButton] = useState<string>('vagnkort');

  useEffect(() => {
    if (vehicleId && user) {
      loadVehicleDetails();
    }
  }, [vehicleId, user]);

  const loadVehicleDetails = async () => {
    if (!vehicleId || !user) return;

    try {
      setLoading(true);
      
      const { data: vehicleData, error: vehicleError } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('id', vehicleId)
        .single();

      if (vehicleError) throw vehicleError;

      // Get the user profile who registered this vehicle
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, first_name, last_name')
        .eq('user_id', vehicleData.user_id)
        .single();

      if (profileError) {
        console.error('Error loading profile:', profileError);
      }

      const vehicleWithProfile = {
        ...vehicleData,
        registered_by: profile?.full_name || 
                      `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() ||
                      'Okänd användare'
      };

      setVehicle(vehicleWithProfile);
    } catch (error) {
      console.error('Error loading vehicle details:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ladda fordonsdetaljer.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE');
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'på_lager':
        return 'outline' as const;
      case 'på_väg':
        return 'secondary' as const;
      case 'såld':
        return 'outline' as const;
      default:
        return 'default' as const;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'på_lager':
        return 'I lager';
      case 'på_väg':
        return 'På väg';
      case 'såld':
        return 'Såld';
      default:
        return status;
    }
  };

  const getVatInfo = (vatType: string) => {
    switch (vatType) {
      case 'VMB':
        return { label: '25% MOMS', description: 'Väggränsbeskattad bil' };
      case 'MOMS':
        return { label: '25% MOMS', description: 'Moms på hela beloppet' };
      case 'VMBI':
        return { label: 'VMB Import', description: 'Väggränsbeskattad bil - Import' };
      case 'MOMSI':
        return { label: 'MOMS Import', description: 'Moms - Import' };
      default:
        return { label: vatType || 'Okänd', description: '' };
    }
  };

  const calculateStorageDays = (purchaseDate: string, status: string, sellingDate?: string) => {
    const purchase = new Date(purchaseDate);
    purchase.setHours(0, 0, 0, 0); // Reset to start of purchase day
    
    let endDate: Date;
    if (status === 'såld' && sellingDate) {
      // For sold vehicles, use selling date
      endDate = new Date(sellingDate);
      endDate.setHours(0, 0, 0, 0); // Reset to start of selling day
    } else {
      // For vehicles in stock, use today's date
      endDate = new Date();
      endDate.setHours(0, 0, 0, 0); // Reset to start of today
    }
    
    const diffTime = endDate.getTime() - purchase.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays + 1); // Ensure minimum 1 day, add 1 to include both start and end day
  };

  const calculateStorageValue = () => {
    if (!vehicle) return 0;
    return vehicle.purchase_price + (vehicle.additional_costs || 0);
  };

  const handleSell = () => {
    toast({
      title: "Säljfunktion",
      description: "Säljfunktionen kommer att implementeras här.",
    });
  };

  const handleBookkeeping = () => {
    toast({
      title: "Bokföring",
      description: "Bokförings- och transaktionsvy kommer att implementeras här.",
    });
  };

  const handleDelete = async () => {
    if (!vehicle) return;
    
    if (!confirm(`Är du säker på att du vill ta bort ${vehicle.registration_number}? Detta kan inte ångras.`)) {
      return;
    }

    try {
      setActionLoading('delete');
      
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', vehicle.id);

      if (error) throw error;

      toast({
        title: "Fordon borttaget",
        description: `${vehicle.registration_number} har tagits bort från lagret.`,
      });

      onBack();
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ta bort fordonet. Försök igen.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-8 w-32 bg-muted animate-pulse rounded" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-4 bg-muted rounded w-2/3" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Fordon hittades inte</h1>
        </div>
      </div>
    );
  }

  const vatInfo = getVatInfo(vehicle.vat_type || '');
  const storageValue = calculateStorageValue();

  return (
    <div className="space-y-6">
      {/* Header positioned like Lagerlista with back button */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {vehicle.brand}{vehicle.model && ` ${vehicle.model}`} ({vehicle.registration_number})
        </h2>
        <Button variant="ghost" onClick={onBack}>
          Tillbaka
        </Button>
      </div>

      {/* Action buttons row */}
      <div className="flex items-center justify-between gap-4 p-4 bg-card border rounded-lg">
        <Button 
          variant={activeButton === 'vagnkort' ? 'default' : 'outline'} 
          className={`flex-1 ${activeButton === 'vagnkort' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
          onClick={() => setActiveButton('vagnkort')}
        >
          <Car className="h-4 w-4 mr-2" />
          Vagnkort
        </Button>
        <Button 
          variant={activeButton === 'pakostnad' ? 'default' : 'outline'} 
          className={`flex-1 ${activeButton === 'pakostnad' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
          onClick={() => setActiveButton('pakostnad')}
        >
          <Plus className="h-4 w-4 mr-2" />
          Påkostnad
        </Button>
        <Button 
          variant={activeButton === 'forsaljning' ? 'default' : 'outline'} 
          className={`flex-1 ${activeButton === 'forsaljning' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
          onClick={() => {
            setActiveButton('forsaljning');
            handleSell();
          }}
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          Försäljning
        </Button>
        <Button 
          variant={activeButton === 'bokforing' ? 'default' : 'outline'} 
          className={`flex-1 ${activeButton === 'bokforing' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
          onClick={() => {
            setActiveButton('bokforing');
            handleBookkeeping();
          }}
        >
          <Calculator className="h-4 w-4 mr-2" />
          Bokföring
        </Button>
        <Button 
          variant="destructive" 
          onClick={handleDelete}
          disabled={actionLoading === 'delete'}
          className="aspect-square p-0"
          size="icon"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left sidebar with key info */}
        <div className="space-y-4">
          {/* Storage value */}
          <Card>
            <CardContent className="p-4">
              <div className="text-sm font-medium text-muted-foreground">Lagervärde</div>
              <div className="text-2xl font-bold">{formatPrice(storageValue)}</div>
            </CardContent>
          </Card>

          {/* Storage days */}
          <Card>
            <CardContent className="p-4">
              <div className="text-sm font-medium text-muted-foreground">Lagerdagar</div>
              <div className="text-2xl font-bold">
                {calculateStorageDays(vehicle.purchase_date, vehicle.status, vehicle.selling_date)} dagar
              </div>
            </CardContent>
          </Card>

          {/* Purchase information */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="text-sm font-medium text-muted-foreground">Inköpsinformation</div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Inköpt av</div>
                <div className="font-medium">{vehicle.purchaser}</div>
              </div>
              
              <div>
                <div className="text-sm text-muted-foreground mb-1">Inköpsdatum</div>
                <div className="font-medium">{formatDate(vehicle.purchase_date)}</div>
              </div>
              
              <div>
                <div className="text-sm text-muted-foreground mb-1">Inköpspris (inkl. moms)</div>
                <div className="font-medium">{formatPrice(vehicle.purchase_price)}</div>
              </div>
              
              <div>
                <div className="text-sm text-muted-foreground mb-1">Momsmetod</div>
                <div className="font-medium">{vehicle.vat_type === "Vinstmarginalbeskattning (VMB)" ? "VMB" : vehicle.vat_type || "Ej angiven"}</div>
              </div>

              {vehicle.seller && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Säljare</div>
                  <div className="font-medium">{vehicle.seller}</div>
                </div>
              )}

            </CardContent>
          </Card>
        </div>

        {/* Main content area - Facts */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Fakta</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {/* Row 1 */}
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Bränsle</div>
                  <div className="font-medium">-</div>
                </div>
                
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Växellåda</div>
                  <div className="font-medium">-</div>
                </div>
                
                {vehicle.mileage && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Miltal</div>
                    <div className="font-medium">{vehicle.mileage.toLocaleString('sv-SE')} km</div>
                  </div>
                )}

                {/* Row 2 */}
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Biltyp</div>
                  <div className="font-medium">-</div>
                </div>
                
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Drivning</div>
                  <div className="font-medium">-</div>
                </div>
                
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Hästkrafter</div>
                  <div className="font-medium">-</div>
                </div>

                {/* Row 3 */}
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Motorstorlek</div>
                  <div className="font-medium">-</div>
                </div>
                
                {vehicle.first_registration_date && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Datum i trafik</div>
                    <div className="font-medium">{formatDate(vehicle.first_registration_date)}</div>
                  </div>
                )}
                
                {vehicle.year_model && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Modellår</div>
                    <div className="font-medium">{vehicle.year_model}</div>
                  </div>
                )}

                {/* Row 4 */}
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Färg</div>
                  <div className="font-medium">-</div>
                </div>
                
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Märke</div>
                  <div className="font-medium">{vehicle.brand}</div>
                </div>
                
                {vehicle.model && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Modell</div>
                    <div className="font-medium">{vehicle.model}</div>
                  </div>
                )}

                {/* Sales info for sold vehicles */}
                {vehicle.status === 'såld' && (
                  <div className="col-span-2 md:col-span-3 pt-4 border-t">
                    <h4 className="font-semibold mb-4">Försäljningsinformation</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {vehicle.selling_date && (
                        <div>
                          <div className="text-sm text-muted-foreground mb-1">Säljdatum</div>
                          <div className="font-medium">{formatDate(vehicle.selling_date)}</div>
                        </div>
                      )}
                      
                      {vehicle.selling_price && (
                        <div>
                          <div className="text-sm text-muted-foreground mb-1">Säljpris</div>
                          <div className="font-medium">{formatPrice(vehicle.selling_price)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};