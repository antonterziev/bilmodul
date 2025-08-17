import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { VagnkortTab } from "./VagnkortTab";
import { PakostnadTab } from "./PakostnadTab";
import { ForsaljningTab } from "./ForsaljningTab";
import { BokforingTab } from "./BokforingTab";
import { NotesSection } from "./NotesSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  initialTab?: string;
}

export const VehicleDetailsView = ({ vehicleId, onBack, initialTab = 'vagnkort' }: VehicleDetailsViewProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vehicle, setVehicle] = useState<VehicleDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  
  // Notes state
  const [notes, setNotes] = useState<VehicleNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  
  // Påkostnad form state
  const [pakostnadAmount, setPakostnadAmount] = useState('');
  const [pakostnadSupplier, setPakostnadSupplier] = useState('');
  const [pakostnadCategory, setPakostnadCategory] = useState('');
  const [pakostnadDocument, setPakostnadDocument] = useState<File | null>(null);
  const [pakostnadType, setPakostnadType] = useState<string>('faktura');
  const [suppliers, setSuppliers] = useState<Array<{supplierNumber: string, name: string, organisationNumber: string}>>([]);
  const [pakostnader, setPakostnader] = useState<Array<any>>([]);
  const [loadingPakostnader, setLoadingPakostnader] = useState(false);
  const [editingPakostnad, setEditingPakostnad] = useState<string | null>(null);
  const [syncingPakostnad, setSyncingPakostnad] = useState<string | null>(null);
  const [suppliersLoading, setSuppliersLoading] = useState(false);

  // Försäljning form state
  const [salesUsers, setSalesUsers] = useState<Array<{ user_id: string; full_name: string; email: string }>>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<string>("");
  const [salesDate, setSalesDate] = useState<Date | undefined>(new Date());
  const [salesPriceDisplay, setSalesPriceDisplay] = useState<string>("");

  useEffect(() => {
    if (vehicleId && user) {
      loadVehicleDetails();
      loadNotes();
    }
  }, [vehicleId, user]);

  const loadVehicleDetails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('id', vehicleId)
        .single();

      if (error) {
        throw error;
      }

      setVehicle(data);
      
      // Load sales users
      const { data: salesUsersData, error: salesUsersError } = await supabase
        .from('users')
        .select('user_id, full_name, email')
        .eq('role', 'sales');

      if (salesUsersError) {
        throw salesUsersError;
      }

      setSalesUsers(salesUsersData);

      // Load suppliers
      setSuppliersLoading(true);
      const { data: suppliersData, error: suppliersError } = await supabase
        .from('suppliers')
        .select('supplierNumber, name, organisationNumber');

      if (suppliersError) {
        throw suppliersError;
      }

      setSuppliers(suppliersData);
      setSuppliersLoading(false);
      
      // Load påkostnader
      loadPakostnader();
    } catch (error: any) {
      console.error("Error loading vehicle details:", error);
      toast({
        title: "Error",
        description: "Failed to load vehicle details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async () => {
    setNotesLoading(true);
    try {
      const { data: vehicleData, error: vehicleError } = await supabase
        .from('inventory_items')
        .select('note')
        .eq('id', vehicleId)
        .single();

      if (vehicleError) {
        throw vehicleError;
      }

      const vehicleNote = vehicleData.note ? [{
        id: `vehicle-note-${vehicleId}`,
        vehicle_id: vehicleId,
        user_id: user?.id || 'system',
        note_text: vehicleData.note,
        created_at: vehicleData.created_at || new Date().toISOString(),
        updated_at: vehicleData.updated_at || new Date().toISOString(),
        user_name: 'System'
      }] : [];

      const { data, error } = await supabase
        .from('vehicle_notes')
        .select('*, user_name:users(full_name)')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const enrichedNotes = data.map(note => ({
        ...note,
        user_name: (note.user_name as any)?.full_name || 'Unknown User'
      }));

      setNotes([...vehicleNote, ...enrichedNotes]);
    } catch (error: any) {
      console.error("Error loading notes:", error);
      toast({
        title: "Error",
        description: "Failed to load notes.",
        variant: "destructive",
      });
    } finally {
      setNotesLoading(false);
    }
  };

  const loadPakostnader = async () => {
    setLoadingPakostnader(true);
    try {
      const { data, error } = await supabase
        .from('pakostnader')
        .select('*')
        .eq('inventory_item_id', vehicleId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setPakostnader(data);
    } catch (error: any) {
      console.error("Error loading påkostnader:", error);
      toast({
        title: "Error",
        description: "Failed to load påkostnader.",
        variant: "destructive",
      });
    } finally {
      setLoadingPakostnader(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Är du säker på att du vill ta bort detta fordon?')) return;

    try {
      setActionLoading('delete');
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', vehicleId);

      if (error) throw error;

      toast({
        title: "Fordon borttaget",
        description: "Fordonet har tagits bort.",
      });
      onBack();
    } catch (error: any) {
      console.error("Error deleting vehicle:", error);
      toast({
        title: "Error",
        description: "Failed to delete vehicle.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Helper functions
  const formatPrice = (price: number) => `${price.toLocaleString()} kr`;
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('sv-SE');
  const getStatusVariant = (status: string) => status === 'sold' ? 'default' : 'secondary';
  const getStatusLabel = (status: string) => status === 'sold' ? 'Såld' : 'I lager';
  const getVatInfo = (vatType?: string) => ({ label: vatType || 'Okänd', description: '' });
  const calculateStorageValue = () => vehicle?.inventory_value || vehicle?.purchase_price || 0;
  const calculateStorageDays = () => Math.floor((Date.now() - new Date(vehicle?.purchase_date || 0).getTime()) / (1000 * 60 * 60 * 24));

  if (loading) {
    return <div className="flex items-center justify-center p-8">Laddar...</div>;
  }

  if (!vehicle) {
    return <div className="flex items-center justify-center p-8">Fordon hittades inte</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Tillbaka
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{vehicle.registration_number}</h1>
          <p className="text-muted-foreground">{vehicle.brand} {vehicle.model}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="vagnkort">Vagnkort</TabsTrigger>
          <TabsTrigger value="pakostnad">Påkostnad</TabsTrigger>
          <TabsTrigger value="forsaljning">Försäljning</TabsTrigger>
          <TabsTrigger value="bokforing">Bokföring</TabsTrigger>
        </TabsList>

        <TabsContent value="vagnkort" className="space-y-6">
          <VagnkortTab
            vehicle={vehicle}
            onDelete={handleDelete}
            actionLoading={actionLoading}
            formatPrice={formatPrice}
            formatDate={formatDate}
            getStatusVariant={getStatusVariant}
            getStatusLabel={getStatusLabel}
            getVatInfo={getVatInfo}
            calculateStorageValue={calculateStorageValue}
            calculateStorageDays={calculateStorageDays}
          />
          <NotesSection
            vehicleId={vehicleId}
            notes={notes}
            newNote={newNote}
            setNewNote={setNewNote}
            editingNoteId={editingNoteId}
            setEditingNoteId={setEditingNoteId}
            editingNoteText={editingNoteText}
            setEditingNoteText={setEditingNoteText}
            notesLoading={notesLoading}
            formatDate={formatDate}
            loadNotes={loadNotes}
          />
        </TabsContent>

        <TabsContent value="pakostnad">
          <PakostnadTab
            vehicleId={vehicleId}
            pakostnadAmount={pakostnadAmount}
            setPakostnadAmount={setPakostnadAmount}
            pakostnadSupplier={pakostnadSupplier}
            setPakostnadSupplier={setPakostnadSupplier}
            pakostnadCategory={pakostnadCategory}
            setPakostnadCategory={setPakostnadCategory}
            pakostnadDocument={pakostnadDocument}
            setPakostnadDocument={setPakostnadDocument}
            pakostnadType={pakostnadType}
            setPakostnadType={setPakostnadType}
            suppliers={suppliers}
            pakostnader={pakostnader}
            loadingPakostnader={loadingPakostnader}
            editingPakostnad={editingPakostnad}
            setEditingPakostnad={setEditingPakostnad}
            syncingPakostnad={syncingPakostnad}
            setSyncingPakostnad={setSyncingPakostnad}
            suppliersLoading={suppliersLoading}
            formatPrice={formatPrice}
            formatDate={formatDate}
            loadPakostnader={loadPakostnader}
          />
        </TabsContent>

        <TabsContent value="forsaljning">
          <ForsaljningTab
            salesUsers={salesUsers}
            selectedSellerId={selectedSellerId}
            setSelectedSellerId={setSelectedSellerId}
            salesDate={salesDate}
            setSalesDate={setSalesDate}
            salesPriceDisplay={salesPriceDisplay}
            setSalesPriceDisplay={setSalesPriceDisplay}
          />
        </TabsContent>

        <TabsContent value="bokforing">
          <BokforingTab vehicleId={vehicleId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
