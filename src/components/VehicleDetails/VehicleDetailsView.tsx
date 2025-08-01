import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, DollarSign, FileText, Trash2, Car, Plus, TrendingUp, Calculator, Edit, Save, X } from "lucide-react";
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
  note?: string;
  registered_by?: string;
  created_at?: string;
}

interface VehicleNote {
  id: string;
  vehicle_id: string;
  user_id: string;
  note_text: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
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
  
  // Notes state
  const [notes, setNotes] = useState<VehicleNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  useEffect(() => {
    if (vehicleId && user) {
      loadVehicleDetails();
    }
  }, [vehicleId, user]);

  // Load notes after vehicle data is loaded
  useEffect(() => {
    if (vehicle && vehicleId) {
      loadNotes();
    }
  }, [vehicle, vehicleId]);

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

  // Notes functions
  const loadNotes = async () => {
    if (!vehicleId) return;
    
    try {
      setNotesLoading(true);
      
      const { data, error } = await supabase
        .from('vehicle_notes')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get user names for each note
      const notesWithNames = await Promise.all(
        (data || []).map(async (note) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, first_name, last_name')
            .eq('user_id', note.user_id)
            .single();

          return {
            ...note,
            user_name: profile?.full_name || 
                      `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() ||
                      'Okänd användare'
          };
        })
      );

      // If vehicle has a note from purchase form and no note exists for it yet, add it as a note
      if (vehicle?.note && !notesWithNames.some(note => note.note_text === vehicle.note)) {
        const vehicleOwnerNote = {
          id: `vehicle-note-${vehicle.id}`,
          vehicle_id: vehicleId,
          user_id: vehicle.user_id,
          note_text: vehicle.note,
          created_at: vehicle.created_at || vehicle.purchase_date,
          updated_at: vehicle.created_at || vehicle.purchase_date,
          user_name: vehicle.registered_by || 'Okänd användare'
        };
        notesWithNames.push(vehicleOwnerNote);
        // Sort again to maintain chronological order
        notesWithNames.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }

      setNotes(notesWithNames);
    } catch (error) {
      console.error('Error loading notes:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ladda anteckningar.",
        variant: "destructive",
      });
    } finally {
      setNotesLoading(false);
    }
  };

  const addNote = async () => {
    if (!newNote.trim() || !user || !vehicleId) return;

    try {
      const { error } = await supabase
        .from('vehicle_notes')
        .insert({
          vehicle_id: vehicleId,
          user_id: user.id,
          note_text: newNote.trim()
        });

      if (error) throw error;

      setNewNote('');
      loadNotes();
      toast({
        title: "Anteckning tillagd",
        description: "Din anteckning har sparats.",
      });
    } catch (error) {
      console.error('Error adding note:', error);
      toast({
        title: "Fel",
        description: "Kunde inte spara anteckningen.",
        variant: "destructive",
      });
    }
  };

  const startEditNote = (note: VehicleNote) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.note_text);
  };

  const cancelEditNote = () => {
    setEditingNoteId(null);
    setEditingNoteText('');
  };

  const saveEditNote = async () => {
    if (!editingNoteId || !editingNoteText.trim()) return;

    try {
      const { error } = await supabase
        .from('vehicle_notes')
        .update({ note_text: editingNoteText.trim() })
        .eq('id', editingNoteId);

      if (error) throw error;

      setEditingNoteId(null);
      setEditingNoteText('');
      loadNotes();
      toast({
        title: "Anteckning uppdaterad",
        description: "Anteckningen har sparats.",
      });
    } catch (error) {
      console.error('Error updating note:', error);
      toast({
        title: "Fel",
        description: "Kunde inte uppdatera anteckningen.",
        variant: "destructive",
      });
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!confirm('Är du säker på att du vill ta bort denna anteckning?')) return;

    try {
      const { error } = await supabase
        .from('vehicle_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      loadNotes();
      toast({
        title: "Anteckning borttagen",
        description: "Anteckningen har tagits bort.",
      });
    } catch (error) {
      console.error('Error deleting note:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ta bort anteckningen.",
        variant: "destructive",
      });
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
          <TrendingUp className="h-4 w-4 mr-2" />
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
          variant="outline" 
          onClick={handleDelete}
          disabled={actionLoading === 'delete'}
          className="text-destructive hover:bg-destructive hover:text-destructive-foreground w-10 h-10 p-0"
        >
          {actionLoading === 'delete' ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 px-4">
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
                {calculateStorageDays(vehicle.purchase_date, vehicle.status, vehicle.selling_date)} {calculateStorageDays(vehicle.purchase_date, vehicle.status, vehicle.selling_date) === 1 ? 'dag' : 'dagar'}
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

        {/* Main content area - conditional based on active button */}
        <div className="lg:col-span-3 space-y-6 flex flex-col">
          {activeButton === 'pakostnad' ? (
            <Card className="flex-1">
              <CardHeader>
                <CardTitle>Fakta</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {/* Row 1 - Top three: Märke, Modell, Regnummer */}
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Märke</div>
                    <div className="font-medium">{vehicle.brand}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Modell</div>
                    <div className="font-medium">{vehicle.model || '-'}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Regnummer</div>
                    <div className="font-medium">{vehicle.registration_number}</div>
                  </div>

                  {/* Row 2 - Modellår, Miltal, Datum i trafik */}
                  {vehicle.year_model ? (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Modellår</div>
                      <div className="font-medium">{vehicle.year_model}</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Modellår</div>
                      <div className="font-medium">-</div>
                    </div>
                  )}
                  
                  {vehicle.mileage ? (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Miltal</div>
                      <div className="font-medium">{vehicle.mileage.toLocaleString('sv-SE')} km</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Miltal</div>
                      <div className="font-medium">-</div>
                    </div>
                  )}
                  
                  {vehicle.first_registration_date ? (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Datum i trafik</div>
                      <div className="font-medium">{formatDate(vehicle.first_registration_date)}</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Datum i trafik</div>
                      <div className="font-medium">-</div>
                    </div>
                  )}

                  {/* Row 3 */}
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Bränsle</div>
                    <div className="font-medium">-</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Växellåda</div>
                    <div className="font-medium">-</div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Hästkrafter</div>
                    <div className="font-medium">-</div>
                  </div>

                  {/* Row 4 */}
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Biltyp</div>
                    <div className="font-medium">-</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Motorstorlek</div>
                    <div className="font-medium">-</div>
                  </div>

                  {/* Row 5 */}
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Färg</div>
                    <div className="font-medium">-</div>
                  </div>

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
          ) : (
            <Card className="flex-1">
              <CardHeader>
                <CardTitle>Fakta</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {/* Row 1 - Top three: Märke, Modell, Regnummer */}
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Märke</div>
                    <div className="font-medium">{vehicle.brand}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Modell</div>
                    <div className="font-medium">{vehicle.model || '-'}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Regnummer</div>
                    <div className="font-medium">{vehicle.registration_number}</div>
                  </div>

                  {/* Row 2 - Modellår, Miltal, Datum i trafik */}
                  {vehicle.year_model ? (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Modellår</div>
                      <div className="font-medium">{vehicle.year_model}</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Modellår</div>
                      <div className="font-medium">-</div>
                    </div>
                  )}
                  
                  {vehicle.mileage ? (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Miltal</div>
                      <div className="font-medium">{vehicle.mileage.toLocaleString('sv-SE')} km</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Miltal</div>
                      <div className="font-medium">-</div>
                    </div>
                  )}
                  
                  {vehicle.first_registration_date ? (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Datum i trafik</div>
                      <div className="font-medium">{formatDate(vehicle.first_registration_date)}</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Datum i trafik</div>
                      <div className="font-medium">-</div>
                    </div>
                  )}

                  {/* Row 3 */}
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Bränsle</div>
                    <div className="font-medium">-</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Växellåda</div>
                    <div className="font-medium">-</div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Hästkrafter</div>
                    <div className="font-medium">-</div>
                  </div>

                  {/* Row 4 */}
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Biltyp</div>
                    <div className="font-medium">-</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Motorstorlek</div>
                    <div className="font-medium">-</div>
                  </div>

                  {/* Row 5 */}
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Färg</div>
                    <div className="font-medium">-</div>
                  </div>

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
          )}

          {/* Notes section */}
          <Card className="flex-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Anteckningar</CardTitle>
              <span className="text-sm text-muted-foreground">
                {notes.length} anteckning{notes.length !== 1 ? 'ar' : ''}
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add new note */}
              <div className="flex gap-2">
                <Textarea
                  placeholder="Skriv en ny anteckning..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={1}
                  className="flex-1 min-h-0 h-10 resize-none"
                />
                <Button 
                  onClick={addNote}
                  disabled={!newNote.trim()}
                  size="sm"
                  className="h-10"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Existing notes */}
              {notesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-muted rounded w-1/4 mb-2" />
                      <div className="h-16 bg-muted rounded" />
                    </div>
                  ))}
                </div>
              ) : notes.length > 0 ? (
                <div className="space-y-4">
                  {notes.map((note) => (
                    <div key={note.id} className="border border-border rounded-lg p-2 space-y-1">
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>
                          {note.user_name} • {formatDate(note.created_at)}
                          {note.updated_at !== note.created_at && (
                            <span className="ml-2 text-xs">(redigerad {formatDate(note.updated_at)})</span>
                          )}
                        </span>
                        {user && user.id === note.user_id && (
                          <div className="flex gap-1">
                            {editingNoteId === note.id ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={saveEditNote}
                                  disabled={!editingNoteText.trim()}
                                >
                                  <Save className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={cancelEditNote}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => startEditNote(note)}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteNote(note.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {editingNoteId === note.id ? (
                        <Textarea
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          rows={3}
                          className="text-sm"
                        />
                      ) : (
                        <div className="text-sm whitespace-pre-wrap">{note.note_text}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};