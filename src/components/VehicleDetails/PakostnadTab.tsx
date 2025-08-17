import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Plus, Calculator, Edit, Save, X, Upload, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface PakostnadTabProps {
  vehicleId: string;
  pakostnadAmount: string;
  setPakostnadAmount: (amount: string) => void;
  pakostnadSupplier: string;
  setPakostnadSupplier: (supplier: string) => void;
  pakostnadCategory: string;
  setPakostnadCategory: (category: string) => void;
  pakostnadDocument: File | null;
  setPakostnadDocument: (file: File | null) => void;
  pakostnadType: string;
  setPakostnadType: (type: string) => void;
  suppliers: Array<{supplierNumber: string, name: string, organisationNumber: string}>;
  pakostnader: Array<any>;
  loadingPakostnader: boolean;
  editingPakostnad: string | null;
  setEditingPakostnad: (id: string | null) => void;
  syncingPakostnad: string | null;
  setSyncingPakostnad: (id: string | null) => void;
  suppliersLoading: boolean;
  formatPrice: (price: number) => string;
  formatDate: (dateString: string) => string;
  loadPakostnader: () => void;
}

export const PakostnadTab = ({
  vehicleId,
  pakostnadAmount,
  setPakostnadAmount,
  pakostnadSupplier,
  setPakostnadSupplier,
  pakostnadCategory,
  setPakostnadCategory,
  pakostnadDocument,
  setPakostnadDocument,
  pakostnadType,
  setPakostnadType,
  suppliers,
  pakostnader,
  loadingPakostnader,
  editingPakostnad,
  setEditingPakostnad,
  syncingPakostnad,
  setSyncingPakostnad,
  suppliersLoading,
  formatPrice,
  formatDate,
  loadPakostnader
}: PakostnadTabProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handlePakostnadSubmit = async () => {
    if (!pakostnadAmount || !pakostnadSupplier || !pakostnadCategory || !user || !vehicleId) {
      toast({
        title: "Ofullständig information",
        description: "Vänligen fyll i alla obligatoriska fält.",
        variant: "destructive",
      });
      return;
    }

    try {
      setActionLoading('submit');
      
      let documentUrl = null;
      if (pakostnadDocument) {
        const fileExt = pakostnadDocument.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `pakostnader/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, pakostnadDocument);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);
        
        documentUrl = urlData.publicUrl;
      }

      const amount = parseFloat(pakostnadAmount);
      
      const { error } = await supabase
        .from('pakostnader')
        .insert({
          inventory_item_id: vehicleId,
          amount: amount,
          supplier: pakostnadSupplier,
          category: pakostnadCategory,
          date: new Date().toISOString().split('T')[0],
          description: `${pakostnadType}: ${pakostnadCategory}`
        });

      if (error) throw error;

      // Clear form
      setPakostnadAmount('');
      setPakostnadSupplier('');
      setPakostnadCategory('');
      setPakostnadDocument(null);
      setPakostnadType('faktura');
      
      // Reload påkostnader
      loadPakostnader();
      
      toast({
        title: "Påkostnad tillagd",
        description: "Påkostnaden har lagts till och kommer synkas med Fortnox.",
      });
    } catch (error) {
      console.error('Error adding påkostnad:', error);
      toast({
        title: "Fel",
        description: "Kunde inte lägga till påkostnad.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncPakostnad = async (pakostnadId: string) => {
    try {
      setSyncingPakostnad(pakostnadId);
      
      const { data, error } = await supabase.functions.invoke('fortnox-pakostnad', {
        body: { pakostnadId }
      });

      if (error) throw error;

      toast({
        title: "Synkroniserat",
        description: "Påkostnaden har synkroniserats med Fortnox.",
      });
      
      loadPakostnader();
    } catch (error) {
      console.error('Error syncing påkostnad:', error);
      toast({
        title: "Synkroniseringsfel",
        description: `Kunde inte synkronisera påkostnad: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setSyncingPakostnad(null);
    }
  };

  const handleEditPakostnad = async (pakostnadId: string, field: string, value: string | number) => {
    try {
      const updates: any = {};
      if (field === 'amount') {
        updates.amount = parseFloat(value as string);
      } else {
        updates[field] = value;
      }

      const { error } = await supabase
        .from('pakostnader')
        .update(updates)
        .eq('id', pakostnadId);

      if (error) throw error;

      loadPakostnader();
      setEditingPakostnad(null);
      
      toast({
        title: "Uppdaterat",
        description: "Påkostnaden har uppdaterats.",
      });
    } catch (error) {
      console.error('Error updating påkostnad:', error);
      toast({
        title: "Fel",
        description: "Kunde inte uppdatera påkostnad.",
        variant: "destructive",
      });
    }
  };

  const handleDeletePakostnad = async (pakostnadId: string) => {
    if (!confirm('Är du säker på att du vill ta bort denna påkostnad?')) return;

    try {
      const { error } = await supabase
        .from('pakostnader')
        .delete()
        .eq('id', pakostnadId);

      if (error) throw error;

      loadPakostnader();
      
      toast({
        title: "Borttaget",
        description: "Påkostnaden har tagits bort.",
      });
    } catch (error) {
      console.error('Error deleting påkostnad:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ta bort påkostnad.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Add New Påkostnad Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Lägg till påkostnad
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Belopp (SEK)</Label>
              <Input
                id="amount"
                type="number"
                value={pakostnadAmount}
                onChange={(e) => setPakostnadAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            
            <div>
              <Label htmlFor="supplier">Leverantör</Label>
              <Select value={pakostnadSupplier} onValueChange={setPakostnadSupplier}>
                <SelectTrigger>
                  <SelectValue placeholder={suppliersLoading ? "Laddar leverantörer..." : "Välj leverantör"} />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.supplierNumber} value={supplier.name}>
                      {supplier.name} ({supplier.supplierNumber})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="category">Kategori</Label>
              <Select value={pakostnadCategory} onValueChange={setPakostnadCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reparation">Reparation</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="transport">Transport</SelectItem>
                  <SelectItem value="besiktning">Besiktning</SelectItem>
                  <SelectItem value="övrigt">Övrigt</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Dokumenttyp</Label>
              <RadioGroup value={pakostnadType} onValueChange={setPakostnadType}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="faktura" id="faktura" />
                  <Label htmlFor="faktura">Faktura</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="kvitto" id="kvitto" />
                  <Label htmlFor="kvitto">Kvitto</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <div>
            <Label htmlFor="document">Dokument (PDF, JPG, PNG)</Label>
            <Input
              id="document"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setPakostnadDocument(e.target.files?.[0] || null)}
            />
          </div>

          <Button 
            onClick={handlePakostnadSubmit}
            disabled={actionLoading === 'submit' || !pakostnadAmount || !pakostnadSupplier || !pakostnadCategory}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            {actionLoading === 'submit' ? 'Lägger till...' : 'Lägg till påkostnad'}
          </Button>
        </CardContent>
      </Card>

      {/* Existing Påkostnader */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Befintliga påkostnader
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingPakostnader ? (
            <div className="text-center py-4">Laddar påkostnader...</div>
          ) : pakostnader.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">Inga påkostnader registrerade</div>
          ) : (
            <div className="space-y-4">
              {pakostnader.map((pakostnad) => (
                <div key={pakostnad.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 space-y-2">
                      {editingPakostnad === pakostnad.id ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <Input
                            type="number"
                            defaultValue={pakostnad.amount}
                            onBlur={(e) => handleEditPakostnad(pakostnad.id, 'amount', e.target.value)}
                            placeholder="Belopp"
                          />
                          <Input
                            defaultValue={pakostnad.supplier}
                            onBlur={(e) => handleEditPakostnad(pakostnad.id, 'supplier', e.target.value)}
                            placeholder="Leverantör"
                          />
                          <Input
                            defaultValue={pakostnad.category}
                            onBlur={(e) => handleEditPakostnad(pakostnad.id, 'category', e.target.value)}
                            placeholder="Kategori"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold">{formatPrice(pakostnad.amount)}</h4>
                            <span className="text-sm text-muted-foreground">
                              {formatDate(pakostnad.created_at)}
                            </span>
                          </div>
                          <p className="text-sm"><strong>Leverantör:</strong> {pakostnad.supplier}</p>
                          <p className="text-sm"><strong>Kategori:</strong> {pakostnad.category}</p>
                          {pakostnad.document_type && (
                            <p className="text-sm"><strong>Typ:</strong> {pakostnad.document_type}</p>
                          )}
                          {pakostnad.fortnox_voucher_number && (
                            <p className="text-sm text-green-600">
                              <strong>Fortnox verifikat:</strong> {pakostnad.fortnox_voucher_number}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      {editingPakostnad === pakostnad.id ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setEditingPakostnad(null)}>
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingPakostnad(null)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setEditingPakostnad(pakostnad.id)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          {!pakostnad.fortnox_voucher_number && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleSyncPakostnad(pakostnad.id)}
                              disabled={syncingPakostnad === pakostnad.id}
                            >
                              <RefreshCw className={`w-4 h-4 ${syncingPakostnad === pakostnad.id ? 'animate-spin' : ''}`} />
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleDeletePakostnad(pakostnad.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {pakostnad.document_url && (
                    <div>
                      <a 
                        href={pakostnad.document_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                      >
                        <Upload className="w-3 h-3" />
                        Visa dokument
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
