import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Car } from "lucide-react";
import { BrandLogo } from "@/components/ui/brand-logo";

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
  inventory_value?: number;
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
  note?: string;
  registered_by?: string;
  created_at?: string;
}

interface VagnkortTabProps {
  vehicle: VehicleDetails;
  onDelete: () => void;
  actionLoading: string | null;
  formatPrice: (price: number) => string;
  formatDate: (dateString: string) => string;
  getStatusVariant: (status: string) => "default" | "secondary" | "destructive" | "outline";
  getStatusLabel: (status: string) => string;
  getVatInfo: (vatType?: string) => { label: string; description: string };
  calculateStorageValue: () => number;
  calculateStorageDays: () => number;
}

export const VagnkortTab = ({ 
  vehicle, 
  onDelete, 
  actionLoading, 
  formatPrice, 
  formatDate, 
  getStatusVariant, 
  getStatusLabel, 
  getVatInfo, 
  calculateStorageValue, 
  calculateStorageDays 
}: VagnkortTabProps) => {
  const vatInfo = getVatInfo(vehicle.vat_type);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Car className="w-5 h-5" />
              Grundläggande information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Registreringsnummer</p>
                <p className="text-lg font-semibold">{vehicle.registration_number}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge variant={getStatusVariant(vehicle.status)}>
                  {getStatusLabel(vehicle.status)}
                </Badge>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center gap-3">
                <BrandLogo brandName={vehicle.brand} className="w-8 h-8" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Märke & Modell</p>
                  <p className="font-semibold">{vehicle.brand} {vehicle.model || 'Okänd modell'}</p>
                </div>
              </div>
            </div>

            {vehicle.year_model && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Årsmodell</p>
                <p className="font-semibold">{vehicle.year_model}</p>
              </div>
            )}

            {vehicle.mileage && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Mätarställning</p>
                <p className="font-semibold">{vehicle.mileage.toLocaleString()} mil</p>
              </div>
            )}

            {vehicle.chassis_number && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Chassinummer</p>
                <p className="font-semibold">{vehicle.chassis_number}</p>
              </div>
            )}

            {vehicle.first_registration_date && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Första registrering</p>
                <p className="font-semibold">{formatDate(vehicle.first_registration_date)}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Purchase Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Inköpsinformation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Inköpsdatum</p>
              <p className="font-semibold">{formatDate(vehicle.purchase_date)}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Inköpare</p>
              <p className="font-semibold">{vehicle.purchaser}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Inköpspris</p>
              <p className="font-semibold text-lg">{formatPrice(vehicle.purchase_price)}</p>
            </div>

            {vehicle.seller && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Säljare</p>
                <p className="font-semibold">{vehicle.seller}</p>
              </div>
            )}

            {vehicle.purchase_channel && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Inköpskanal</p>
                <p className="font-semibold">{vehicle.purchase_channel}</p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-muted-foreground">Momstyp</p>
              <div className="flex items-center gap-2">
                <p className="font-semibold">{vatInfo.label}</p>
                {vatInfo.description && (
                  <span className="text-xs text-muted-foreground">({vatInfo.description})</span>
                )}
              </div>
            </div>

            {vehicle.registered_by && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Registrerad av</p>
                <p className="font-semibold">{vehicle.registered_by}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financial Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ekonomisk information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Inköpspris</p>
              <p className="font-semibold text-lg">{formatPrice(vehicle.purchase_price)}</p>
            </div>

            {vehicle.additional_costs && vehicle.additional_costs > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Påkostnader</p>
                <p className="font-semibold">{formatPrice(vehicle.additional_costs)}</p>
              </div>
            )}

            {vehicle.inventory_value && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Lagervärde</p>
                <p className="font-semibold text-lg text-blue-600">{formatPrice(vehicle.inventory_value)}</p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-muted-foreground">Aktuellt lagervärde</p>
              <p className="font-semibold text-lg text-green-600">{formatPrice(calculateStorageValue())}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Lagerdagar</p>
              <p className="font-semibold">{calculateStorageDays()} dagar</p>
            </div>

            {vehicle.selling_price && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Försäljningspris</p>
                <p className="font-semibold text-lg text-green-600">{formatPrice(vehicle.selling_price)}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sales Information */}
        {(vehicle.selling_date || vehicle.sales_channel || vehicle.customer_type || vehicle.customer_country) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Försäljningsinformation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {vehicle.selling_date && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Försäljningsdatum</p>
                  <p className="font-semibold">{formatDate(vehicle.selling_date)}</p>
                </div>
              )}

              {vehicle.sales_channel && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Försäljningskanal</p>
                  <p className="font-semibold">{vehicle.sales_channel}</p>
                </div>
              )}

              {vehicle.customer_type && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Kundtyp</p>
                  <p className="font-semibold">{vehicle.customer_type}</p>
                </div>
              )}

              {vehicle.customer_country && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Kundland</p>
                  <p className="font-semibold">{vehicle.customer_country}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Åtgärder</CardTitle>
        </CardHeader>
        <CardContent>
          <Button 
            variant="destructive" 
            onClick={onDelete}
            disabled={actionLoading === 'delete'}
            className="w-full sm:w-auto"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {actionLoading === 'delete' ? 'Tar bort...' : 'Ta bort fordon'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};