import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Vehicle {
  id: string;
  registration_number: string;
  chassis_number: string;
  brand: string;
  model: string;
  year_model: number;
  purchaser: string;
  purchase_date: string;
  purchase_price: number;
  additional_costs: number;
  status: string;
  current_location: string;
  expected_selling_price: number;
}

interface SalesFormProps {
  vehicleId: string;
  onBack: () => void;
  onSuccess: () => void;
}

export const SalesForm = ({ vehicleId, onBack, onSuccess }: SalesFormProps) => {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Form state
  const [seller, setSeller] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [sellingDate, setSellingDate] = useState<Date | undefined>(new Date());
  const [warrantyProvided, setWarrantyProvided] = useState(false);
  const [warrantyDetails, setWarrantyDetails] = useState("");
  const [financingProvided, setFinancingProvided] = useState(false);
  const [financingDetails, setFinancingDetails] = useState("");
  const [salesDocumentation, setSalesDocumentation] = useState("Köpeavtal");
  const [salesChannel, setSalesChannel] = useState("Showroom");
  const [customSalesChannel, setCustomSalesChannel] = useState("");
  const [customerType, setCustomerType] = useState("Privatperson");
  const [customerCountry, setCustomerCountry] = useState("SE");
  const [salesNotes, setSalesNotes] = useState("");

  useEffect(() => {
    loadVehicle();
  }, [vehicleId]);

  const loadVehicle = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('id', vehicleId)
        .single();

      if (error) throw error;
      
      setVehicle(data);
      setSellingPrice(data.expected_selling_price?.toString() || "");
    } catch (error) {
      console.error('Error loading vehicle:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ladda fordonsinformation",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSell = async () => {
    if (!seller || !sellingPrice || !sellingDate) {
      toast({
        title: "Fel",
        description: "Vänligen fyll i alla obligatoriska fält",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const finalSalesChannel = salesChannel === "Annat" ? customSalesChannel : salesChannel;
      
      const { error } = await supabase
        .from('inventory_items')
        .update({
          status: 'såld',
          seller: seller,
          selling_price: parseFloat(sellingPrice),
          selling_date: format(sellingDate, 'yyyy-MM-dd'),
          warranty_provided: warrantyProvided,
          warranty_details: warrantyProvided ? warrantyDetails : null,
          financing_provided: financingProvided,
          financing_details: financingProvided ? financingDetails : null,
          sales_documentation: salesDocumentation,
          sales_channel: finalSalesChannel,
          customer_type: customerType,
          customer_country: customerCountry,
          sales_notes: salesNotes,
        })
        .eq('id', vehicleId);

      if (error) throw error;

      toast({
        title: "Sålt!",
        description: "Fordonet har registrerats som sålt",
      });
      
      onSuccess();
    } catch (error) {
      console.error('Error selling vehicle:', error);
      toast({
        title: "Fel",
        description: "Kunde inte registrera försäljning",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Laddar fordonsinformation...</div>;
  }

  if (!vehicle) {
    return <div>Fordon hittades inte</div>;
  }

  const totalCosts = (vehicle.purchase_price || 0) + (vehicle.additional_costs || 0);
  const expectedProfit = (parseFloat(sellingPrice) || 0) - totalCosts;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Tillbaka
        </Button>
        <h2 className="text-2xl font-bold">Försäljning</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Vehicle Data */}
        <Card>
          <CardHeader>
            <CardTitle>Fordonsdata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">Reg / Chassinummer</Label>
              <div className="font-semibold p-2 bg-yellow-100 border rounded">
                {vehicle.registration_number}
              </div>
            </div>
            
            <div>
              <Label className="text-sm text-muted-foreground">Inköpare</Label>
              <div>{vehicle.purchaser}</div>
            </div>
            
            <div>
              <Label className="text-sm text-muted-foreground">Inköpsdatum</Label>
              <div>{new Date(vehicle.purchase_date).toLocaleDateString('sv-SE')}</div>
            </div>
            
            <div>
              <Label className="text-sm text-muted-foreground">Märke</Label>
              <div>{vehicle.brand}</div>
            </div>
            
            <div>
              <Label className="text-sm text-muted-foreground">Modell</Label>
              <div>{vehicle.model}</div>
            </div>
            
            <div>
              <Label className="text-sm text-muted-foreground">Modellår</Label>
              <div>{vehicle.year_model}</div>
            </div>
            
            <div>
              <Label className="text-sm text-muted-foreground">Nuvarande lagerplats</Label>
              <div>{vehicle.current_location}</div>
            </div>
            
            <div>
              <Label className="text-sm text-muted-foreground">Nuvarande status</Label>
              <div>{vehicle.status}</div>
            </div>
            
            <div>
              <Label className="text-sm text-muted-foreground">Total påkostnad</Label>
              <div className="font-semibold">{totalCosts.toLocaleString('sv-SE')} SEK</div>
            </div>
          </CardContent>
        </Card>

        {/* Sales Data */}
        <Card>
          <CardHeader>
            <CardTitle>Försäljningsdata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="seller">Säljare *</Label>
              <div className="p-2 bg-yellow-100 border rounded">
                <Input
                  id="seller"
                  value={seller}
                  onChange={(e) => setSeller(e.target.value)}
                  className="border-0 bg-transparent p-0"
                  required
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="price">Säljpris bil (ink. moms) *</Label>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-yellow-100 border rounded flex-1">
                  <Input
                    id="price"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    type="number"
                    className="border-0 bg-transparent p-0"
                    required
                  />
                </div>
                <span>SEK</span>
              </div>
            </div>
            
            <div>
              <Label>Försäljningsdatum *</Label>
              <div className="p-2 bg-yellow-100 border rounded">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-start text-left font-normal p-0 h-auto",
                        !sellingDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {sellingDate ? format(sellingDate, "PPP", { locale: sv }) : <span>Välj datum</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={sellingDate}
                      onSelect={setSellingDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            <div>
              <Label>Garanti</Label>
              <div className="p-2 bg-yellow-100 border rounded space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="warranty"
                    checked={warrantyProvided}
                    onCheckedChange={(checked) => setWarrantyProvided(checked as boolean)}
                  />
                  <Label htmlFor="warranty">Ja</Label>
                </div>
                {warrantyProvided && (
                  <Input
                    placeholder="Ange leverantör och detaljer..."
                    value={warrantyDetails}
                    onChange={(e) => setWarrantyDetails(e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>
            </div>
            
            <div>
              <Label>Finans</Label>
              <div className="p-2 bg-yellow-100 border rounded space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="financing"
                    checked={financingProvided}
                    onCheckedChange={(checked) => setFinancingProvided(checked as boolean)}
                  />
                  <Label htmlFor="financing">Ja</Label>
                </div>
                {financingProvided && (
                  <Input
                    placeholder="Ange leverantör och ränta..."
                    value={financingDetails}
                    onChange={(e) => setFinancingDetails(e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>
            </div>
            
            <div>
              <Label htmlFor="documentation">Säljunderlag</Label>
              <div className="p-2 bg-yellow-100 border rounded">
                <Select value={salesDocumentation} onValueChange={setSalesDocumentation}>
                  <SelectTrigger className="border-0 bg-transparent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Köpeavtal">Köpeavtal</SelectItem>
                    <SelectItem value="Faktura">Faktura</SelectItem>
                    <SelectItem value="Kvitto">Kvitto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="channel">Säljkanal</Label>
              <div className="p-2 bg-yellow-100 border rounded space-y-2">
                <Select value={salesChannel} onValueChange={setSalesChannel}>
                  <SelectTrigger className="border-0 bg-transparent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Showroom">Showroom</SelectItem>
                    <SelectItem value="Online">Online</SelectItem>
                    <SelectItem value="Telefon">Telefon</SelectItem>
                    <SelectItem value="Annat">Annat</SelectItem>
                  </SelectContent>
                </Select>
                {salesChannel === "Annat" && (
                  <Input
                    placeholder="Ange annan säljkanal..."
                    value={customSalesChannel}
                    onChange={(e) => setCustomSalesChannel(e.target.value)}
                  />
                )}
              </div>
            </div>
            
            <div>
              <Label htmlFor="customerType">Kundtyp</Label>
              <div className="p-2 bg-yellow-100 border rounded">
                <Select value={customerType} onValueChange={setCustomerType}>
                  <SelectTrigger className="border-0 bg-transparent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Privatperson">Privatperson</SelectItem>
                    <SelectItem value="Aktiebolag">Aktiebolag</SelectItem>
                    <SelectItem value="Handelsbolag">Handelsbolag</SelectItem>
                    <SelectItem value="Kommanditbolag">Kommanditbolag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="country">Kunds land</Label>
              <div className="p-2 bg-yellow-100 border rounded">
                <Select value={customerCountry} onValueChange={setCustomerCountry}>
                  <SelectTrigger className="border-0 bg-transparent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SE">SE (Sverige)</SelectItem>
                    <SelectItem value="EU">EU (Övriga EU)</SelectItem>
                    <SelectItem value="NO">NO (Norge)</SelectItem>
                    <SelectItem value="DK">DK (Danmark)</SelectItem>
                    <SelectItem value="US">US (USA)</SelectItem>
                    <SelectItem value="OTHER">Annat land</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Anteckningar</Label>
              <Textarea
                id="notes"
                value={salesNotes}
                onChange={(e) => setSalesNotes(e.target.value)}
                placeholder="Lägg till anteckningar..."
                rows={3}
              />
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-muted-foreground">Beräknad vinst</div>
              <div className={`text-lg font-semibold ${expectedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {expectedProfit.toLocaleString('sv-SE')} SEK
              </div>
            </div>
            
            <Button 
              onClick={handleSell} 
              disabled={saving}
              className="w-full"
            >
              {saving ? "Registrerar..." : "Registrera försäljning"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};