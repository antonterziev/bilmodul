import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowLeft, DollarSign, FileText, Trash2, Car, Plus, TrendingUp, Calculator, Edit, Save, X, Upload, RefreshCw } from "lucide-react";
import { Calendar as CalendarIcon } from "lucide-react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { useToast } from "@/hooks/use-toast";
import { BookkeepingEventsTable } from "./BookkeepingEventsTable";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  const [activeButton, setActiveButton] = useState<string>(initialTab);
  
  // Notes state
  const [notes, setNotes] = useState<VehicleNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  
  // Mention state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionQuery, setMentionQuery] = useState('');
  const [orgUsers, setOrgUsers] = useState<Array<{ user_id: string; full_name: string; email: string }>>([]);
  const [mentionStartPos, setMentionStartPos] = useState(0);

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
    }
  }, [vehicleId, user]);

  // Load notes after vehicle data is loaded
  useEffect(() => {
    if (vehicle && vehicleId) {
      loadNotes();
    }
  }, [vehicle, vehicleId]);

  // Load suppliers when switching to påkostnad tab
  useEffect(() => {
    if (activeButton === 'pakostnad' && suppliers.length === 0) {
      loadSuppliers();
    }
  }, [activeButton]);

  // Load pakostnader when switching to påkostnad tab
  useEffect(() => {
    if (activeButton === 'pakostnad' && vehicleId) {
      loadPakostnader();
    }
  }, [activeButton, vehicleId]);

  // Load sellers (users with 'försäljning' permission) when opening Försäljning tab
  useEffect(() => {
    const loadSalesUsers = async () => {
      if (activeButton !== 'forsaljning' || !user?.id) return;
      try {
        // Get current user's organization
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('user_id', user.id)
          .single();
        if (profileError) throw profileError;

        if (!profileData?.organization_id) return;

        // Get all profiles in same organization
        const { data: orgProfiles, error: orgProfilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, first_name, last_name')
          .eq('organization_id', profileData.organization_id);
        if (orgProfilesError) throw orgProfilesError;

        // Filter to only those with 'forsaljning' permission using the SECURITY DEFINER function
        const withPermission = await Promise.all(
          (orgProfiles || []).map(async (p) => {
            const { data: hasSales, error } = await supabase.rpc('has_permission', {
              _user_id: p.user_id,
              _permission: 'forsaljning'
            } as any);
            if (error) {
              console.warn('Permission check error:', error);
              return null;
            }
            if (hasSales) {
              const fullName = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email;
              return { user_id: p.user_id, full_name: fullName, email: p.email };
            }
            return null;
          })
        );

        setSalesUsers(withPermission.filter(Boolean) as Array<{ user_id: string; full_name: string; email: string }>);
      } catch (e) {
        console.error('Error loading sales users:', e);
      }
    };

    loadSalesUsers();
  }, [activeButton, user]);

  // Load organization users for mentions
  useEffect(() => {
    const loadOrgUsers = async () => {
      if (!user?.id) return;
      try {
        // Get current user's organization
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('user_id', user.id)
          .single();
        if (profileError) throw profileError;

        if (!profileData?.organization_id) return;

        // Get all profiles in same organization
        const { data: orgProfiles, error: orgProfilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, first_name, last_name')
          .eq('organization_id', profileData.organization_id);
        if (orgProfilesError) throw orgProfilesError;

        const users = (orgProfiles || []).map(p => ({
          user_id: p.user_id,
          full_name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email,
          email: p.email
        }));

        setOrgUsers(users);
      } catch (e) {
        console.error('Error loading organization users:', e);
      }
    };

    if (user) {
      loadOrgUsers();
    }
  }, [user]);

  const loadSuppliers = async () => {
    try {
      console.log('Loading suppliers from Fortnox...');
      setSuppliersLoading(true);
      const { data, error } = await supabase.functions.invoke('fortnox-list-suppliers');
      
      console.log('Suppliers response:', { data, error });
      
      if (error) throw error;
      
      if (data?.suppliers) {
        console.log(`Loaded ${data.suppliers.length} suppliers`);
        setSuppliers(data.suppliers);
      } else {
        console.log('No suppliers data received:', data);
      }
    } catch (error) {
      console.error('Error loading suppliers:', error);
      toast({
        title: "Fel",
        description: `Kunde inte ladda leverantörer från Fortnox: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setSuppliersLoading(false);
    }
  };

  const loadPakostnader = async () => {
    if (!vehicleId) return;
    
    try {
      setLoadingPakostnader(true);
      const { data, error } = await supabase
        .from('pakostnader')
        .select('*')
        .eq('inventory_item_id', vehicleId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setPakostnader(data || []);
    } catch (error) {
      console.error('Error loading pakostnader:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ladda påkostnader.",
        variant: "destructive",
      });
    } finally {
      setLoadingPakostnader(false);
    }
  };

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
      // Handle vehicle purchase notes differently
      if (editingNoteId.startsWith('vehicle-note-')) {
        // This is the original vehicle purchase note - update the vehicle record
        const { error } = await supabase
          .from('inventory_items')
          .update({ note: editingNoteText.trim() })
          .eq('id', vehicleId);

        if (error) throw error;
        
        // Refresh vehicle data and notes
        await loadVehicleDetails();
      } else {
        // Regular note from vehicle_notes table
        const { error } = await supabase
          .from('vehicle_notes')
          .update({ note_text: editingNoteText.trim() })
          .eq('id', editingNoteId);

        if (error) throw error;
        
        loadNotes();
      }

      setEditingNoteId(null);
      setEditingNoteText('');
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
      // Handle vehicle purchase notes differently
      if (noteId.startsWith('vehicle-note-')) {
        // This is the original vehicle purchase note - update the vehicle record
        const { error } = await supabase
          .from('inventory_items')
          .update({ note: null })
          .eq('id', vehicleId);

        if (error) throw error;
        
        // Refresh vehicle data and notes
        await loadVehicleDetails();
      } else {
        // Regular note from vehicle_notes table
        const { error } = await supabase
          .from('vehicle_notes')
          .delete()
          .eq('id', noteId);

        if (error) throw error;
        
        loadNotes();
      }

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

  // Format price with thousands separator and decimals (for typing)
  const formatPriceWithThousands = (value: string) => {
    const cleanValue = value.replace(/\s/g, '').replace(/,/g, '.');
    if (!cleanValue) return '';
    const num = parseFloat(cleanValue);
    if (isNaN(num)) return value;
    return num.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const handleSalesPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cleanValue = value.replace(/\s/g, '').replace(/,/g, '.');
    if (cleanValue === '' || /^\d+([.,]\d{0,2})?$/.test(cleanValue)) {
      setSalesPriceDisplay(value === '' ? '' : formatPriceWithThousands(value));
    }
  };

  // Mention functionality
  const handleMentionSelect = (user: { user_id: string; full_name: string; email: string }) => {
    const beforeMention = newNote.slice(0, mentionStartPos);
    const afterMention = newNote.slice(mentionStartPos + mentionQuery.length + 1); // +1 for @
    const newText = `${beforeMention}@${user.full_name} ${afterMention}`;
    setNewNote(newText);
    setShowMentionDropdown(false);
    setMentionQuery('');
  };

  const handleNoteChange = (value: string) => {
    setNewNote(value);
    
    // Check for @ mentions
    const cursorPos = value.length; // Simplified - assumes typing at end
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Check if there's no space after @ (still typing the mention)
      if (!textAfterAt.includes(' ') && textAfterAt.length <= 50) {
        setMentionStartPos(lastAtIndex);
        setMentionQuery(textAfterAt);
        setShowMentionDropdown(true);
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  const filteredMentionUsers = orgUsers.filter(user =>
    user.full_name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(mentionQuery.toLowerCase())
  ).slice(0, 5);

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
    
    const vatType = vehicle.vat_type || '';
    let baseValue = vehicle.purchase_price;
    
    // For MOMSI and MOMS, deduct 20% VAT from purchase price
    if (vatType === 'MOMSI' || vatType === 'MOMS') {
      baseValue = vehicle.purchase_price * 0.8; // Purchase price less 20%
    }
    
    // Add additional costs for all cases
    return baseValue + (vehicle.additional_costs || 0);
  };

  // Removed placeholder handleSell toast



  const handleBookkeeping = () => {
    // This is now handled by showing the BookkeepingEventsTable component
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

  const handlePakostnadSubmit = async () => {
    if (!pakostnadAmount || !pakostnadSupplier || !pakostnadCategory || !vehicle?.id) {
      toast({
        title: "Fyll i alla fält",
        description: "Belopp, leverantör och kategori måste fyllas i.",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(pakostnadAmount);
    if (amount <= 0) {
      toast({
        title: "Ogiltigt belopp",
        description: "Beloppet måste vara större än noll.",
        variant: "destructive",
      });
      return;
    }

    try {
      // First, insert the påkostnad record using any to bypass TypeScript until types are updated
      const { data: pakostnad, error: insertError } = await (supabase as any)
        .from('pakostnader')
        .insert({
          inventory_item_id: vehicle.id,
          supplier: pakostnadSupplier,
          amount: amount,
          category: pakostnadCategory,
          date: new Date().toISOString().split('T')[0],
          description: '',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Then sync to Fortnox
      const { data: syncResult, error: syncError } = await supabase.functions.invoke('fortnox-pakostnad', {
        body: {
          pakostnadId: pakostnad.id,
          syncingUserId: user?.id
        }
      });

      if (syncError) {
        console.error('Fortnox sync error:', syncError);
        toast({
          title: "Varning",
          description: "Påkostnad registrerad men kunde inte synkas till Fortnox. Kontakta support.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Påkostnad registrerad",
          description: `Påkostnad på ${formatPrice(amount)} har registrerats och synkats till Fortnox.`,
        });
      }
      
      // Reset form
      setPakostnadAmount('');
      setPakostnadSupplier('');
      setPakostnadCategory('');
      setPakostnadDocument(null);

      // Reload vehicle data and pakostnader
      if (vehicleId) {
        loadVehicleDetails();
        loadPakostnader();
      }
    } catch (error) {
      console.error('Error registering påkostnad:', error);
      toast({
        title: "Fel",
        description: "Kunde inte registrera påkostnaden.",
        variant: "destructive",
      });
    }
  };

  const handleSyncPakostnad = async (pakostnadId: string) => {
    try {
      setSyncingPakostnad(pakostnadId);
      
      const { data, error } = await supabase.functions.invoke('fortnox-pakostnad', {
        body: {
          pakostnadId,
          syncingUserId: user?.id
        }
      });

      if (error) throw error;

      toast({
        title: "Påkostnad synkad",
        description: "Påkostnaden har synkats till Fortnox.",
      });

      loadPakostnader(); // Reload to get updated sync status
    } catch (error) {
      console.error('Error syncing pakostnad:', error);
      toast({
        title: "Fel",
        description: "Kunde inte synka påkostnaden till Fortnox.",
        variant: "destructive",
      });
    } finally {
      setSyncingPakostnad(null);
    }
  };

  const handleEditPakostnad = async (pakostnadId: string, updatedData: { supplier: string; category: string; amount: number }) => {
    try {
      const { error } = await supabase
        .from('pakostnader')
        .update(updatedData)
        .eq('id', pakostnadId);

      if (error) throw error;

      toast({
        title: "Påkostnad uppdaterad",
        description: "Påkostnaden har uppdaterats.",
      });

      setEditingPakostnad(null);
      loadPakostnader();
    } catch (error) {
      console.error('Error updating pakostnad:', error);
      toast({
        title: "Fel",
        description: "Kunde inte uppdatera påkostnaden.",
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

      toast({
        title: "Påkostnad borttagen",
        description: "Påkostnaden har tagits bort.",
      });

      loadPakostnader();
    } catch (error) {
      console.error('Error deleting pakostnad:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ta bort påkostnaden.",
        variant: "destructive",
      });
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
        <Button variant="outline" onClick={onBack}>
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left sidebar with key info */}
        <div className="space-y-4">
          {activeButton === 'pakostnad' ? (
            /* Påkostnad form */
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="text-sm font-medium text-foreground">Ny påkostnad</div>
                
                {/* Document type radio buttons */}
                <div>
                  <RadioGroup 
                    value={pakostnadType} 
                    onValueChange={setPakostnadType}
                    className="flex flex-row space-x-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="faktura" id="faktura" />
                      <Label htmlFor="faktura" className="text-sm text-foreground">Faktura</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="kvitto" id="kvitto" />
                      <Label htmlFor="kvitto" className="text-sm text-foreground">Kvitto</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                {/* Leverantör */}
                <div>
                  <label className="text-sm text-foreground mb-1 block">Leverantör *</label>
                  <Select value={pakostnadSupplier} onValueChange={setPakostnadSupplier} disabled={suppliersLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder={suppliersLoading ? "Laddar leverantörer..." : "Välj leverantör"} />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.supplierNumber} value={supplier.name}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Kategori */}
                <div>
                  <label className="text-sm text-foreground mb-1 block">Kategori *</label>
                  <Select value={pakostnadCategory} onValueChange={setPakostnadCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Lackering">Lackering</SelectItem>
                      <SelectItem value="Rekond">Rekond</SelectItem>
                      <SelectItem value="Glasbyte">Glasbyte</SelectItem>
                      <SelectItem value="Övrigt">Övrigt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Belopp (exkl. moms) */}
                <div>
                  <label className="text-sm text-foreground mb-1 block">Belopp (inkl. moms) *</label>
                  <div className="flex">
                    <Input
                      type="text"
                      value={pakostnadAmount}
                      onChange={(e) => setPakostnadAmount(e.target.value)}
                      className="rounded-r-none border-r-0"
                    />
                    <Select defaultValue="SEK" disabled>
                      <SelectTrigger className="w-20 rounded-l-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SEK">SEK</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Inköpsunderlag */}
                <div>
                  <label className="text-sm text-foreground mb-1 block">Inköpsunderlag</label>
                  <div className="border border-input rounded-md">
                    <input
                      type="file"
                      id="document-upload"
                      className="hidden"
                      onChange={(e) => setPakostnadDocument(e.target.files?.[0] || null)}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    />
                    <label
                      htmlFor="document-upload"
                      className="cursor-pointer flex items-center justify-between p-3 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Upload className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Välj fil (max 5mb)</span>
                      </div>
                    </label>
                    {pakostnadDocument && (
                      <div className="px-3 pb-3 text-sm text-foreground">
                        {pakostnadDocument.name}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Registrera button */}
                <Button 
                  onClick={handlePakostnadSubmit}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={!pakostnadAmount || !pakostnadSupplier || !pakostnadCategory}
                >
                  Registrera
                </Button>
              </CardContent>
            </Card>
          ) : (
            /* Purchase information and storage info for other tabs */
            <>
              {/* Storage value */}
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm font-medium text-muted-foreground">Lagervärde</div>
                  <div className="text-2xl font-bold">{formatPrice(vehicle.inventory_value || 0)}</div>
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

            </>
          )}
        </div>

        {/* Main content area - conditional based on active button */}
        <div className="lg:col-span-3 space-y-6 flex flex-col">
          {activeButton === 'pakostnad' ? (
            <Card className="flex-1">
              <CardHeader>
                <CardTitle>Påkostnader</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-6">
                {loadingPakostnader ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-muted rounded w-1/4" />
                            <div className="h-4 bg-muted rounded w-1/3" />
                          </div>
                          <div className="h-6 bg-muted rounded w-20" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : pakostnader.length > 0 ? (
                  <div className="space-y-3">
                    {pakostnader.map((pakostnad) => (
                      <div key={pakostnad.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between gap-4">
                          {/* Leverantör */}
                          <div className="flex-1">
                            {editingPakostnad === pakostnad.id ? (
                              <Input
                                defaultValue={pakostnad.supplier}
                                className="text-sm"
                                onBlur={(e) => {
                                  const supplier = e.target.value;
                                  const category = pakostnad.category;
                                  const amount = pakostnad.amount;
                                  handleEditPakostnad(pakostnad.id, { supplier, category, amount });
                                }}
                              />
                            ) : (
                              <div className="font-medium text-sm">{pakostnad.supplier}</div>
                            )}
                          </div>

                          {/* Kategori */}
                          <div className="flex-1">
                            {editingPakostnad === pakostnad.id ? (
                              <Select
                                defaultValue={pakostnad.category}
                                onValueChange={(category) => {
                                  const supplier = pakostnad.supplier;
                                  const amount = pakostnad.amount;
                                  handleEditPakostnad(pakostnad.id, { supplier, category, amount });
                                }}
                              >
                                <SelectTrigger className="text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Lackering">Lackering</SelectItem>
                                  <SelectItem value="Rekond">Rekond</SelectItem>
                                  <SelectItem value="Glasbyte">Glasbyte</SelectItem>
                                  <SelectItem value="Övrigt">Övrigt</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                {pakostnad.category}
                              </Badge>
                            )}
                          </div>

                          {/* Belopp */}
                          <div className="flex-1 text-right">
                            {editingPakostnad === pakostnad.id ? (
                              <Input
                                type="number"
                                defaultValue={pakostnad.amount}
                                className="text-sm text-right"
                                onBlur={(e) => {
                                  const amount = parseFloat(e.target.value);
                                  const supplier = pakostnad.supplier;
                                  const category = pakostnad.category;
                                  handleEditPakostnad(pakostnad.id, { supplier, category, amount });
                                }}
                              />
                            ) : (
                              <div className="font-medium text-sm">
                                <div>{formatPrice(pakostnad.amount)}</div>
                                <div className="text-xs text-muted-foreground">Moms: {formatPrice(pakostnad.amount * 0.2)}</div>
                              </div>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-2">
                            {/* Edit button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (editingPakostnad === pakostnad.id) {
                                  setEditingPakostnad(null);
                                } else {
                                  setEditingPakostnad(pakostnad.id);
                                }
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>

                            {/* Sync button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSyncPakostnad(pakostnad.id)}
                              disabled={syncingPakostnad === pakostnad.id}
                              className={`h-8 w-8 p-0 ${pakostnad.is_synced ? 'text-green-600' : 'text-blue-600'}`}
                            >
                              {syncingPakostnad === pakostnad.id ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>

                            {/* Remove button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePakostnad(pakostnad.id)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Sync status indicator */}
                        {pakostnad.is_synced && (
                          <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                            <div className="h-2 w-2 bg-green-600 rounded-full" />
                            Synkad till Fortnox
                            {pakostnad.fortnox_invoice_number && (
                              <span className="text-muted-foreground">
                                (#{pakostnad.fortnox_invoice_number})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    Inga påkostnader registrerade för detta fordon
                  </div>
                )}
              </CardContent>
            </Card>
          ) : activeButton === 'bokforing' ? (
            <BookkeepingEventsTable vehicleId={vehicleId} />
          ) : activeButton === 'forsaljning' ? (
              <Card className="flex-1">
                <CardHeader>
                  <CardTitle>Försäljning</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 1. Säljare */}
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Säljare</div>
                      <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Välj säljare" />
                        </SelectTrigger>
                        <SelectContent>
                          {salesUsers.map((u) => (
                            <SelectItem key={u.user_id} value={u.user_id}>
                              {u.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 2. Försäljningsdatum */}
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Försäljningsdatum</div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {salesDate ? format(salesDate, 'yyyy-MM-dd') : 'Välj datum'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={salesDate}
                            onSelect={setSalesDate}
                            className="pointer-events-auto"
                            disabled={(date) => {
                              const d = new Date(date);
                              d.setHours(0,0,0,0);
                              const today = new Date();
                              today.setHours(0,0,0,0);
                              const min = vehicle?.purchase_date ? new Date(vehicle.purchase_date) : undefined;
                              if (min) min.setHours(0,0,0,0);
                              return d > today || (min ? d < min : false);
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* 3. Försäljningspris (inkl. moms) */}
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Försäljningspris (inkl. moms)</div>
                      <div className="relative">
                        <Input
                          type="text"
                          value={salesPriceDisplay}
                          onChange={handleSalesPriceChange}
                          placeholder="t.ex. 200,000"
                          className="pr-20"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center">
                          <Select value="SEK" disabled>
                            <SelectTrigger className="w-16 h-8 border-0 bg-transparent text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="SEK">SEK</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>


                    {/* 5. Registrera försäljning */}
                    <div className="md:col-span-2">
                      <Button className="w-full" disabled>
                        Registrera försäljning
                      </Button>
                    </div>
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

          {/* Notes section - only show when not in påkostnad mode */}
          {activeButton !== 'pakostnad' && activeButton !== 'forsaljning' && (
            <Card className="flex-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Anteckningar</CardTitle>
                <span className="text-sm text-muted-foreground">
                  {notes.length} anteckning{notes.length !== 1 ? 'ar' : ''}
                </span>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add new note */}
                <div className="flex gap-2 relative">
                  <div className="flex-1 relative">
                    <Textarea
                      placeholder="Skriv en ny anteckning..."
                      value={newNote}
                      onChange={(e) => handleNoteChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (newNote.trim()) {
                            addNote();
                          }
                        }
                        if (e.key === 'Escape') {
                          setShowMentionDropdown(false);
                        }
                      }}
                      rows={1}
                      className="min-h-0 h-10 resize-none"
                    />
                    
                    {/* Mention dropdown */}
                    {showMentionDropdown && filteredMentionUsers.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto">
                        {filteredMentionUsers.map((user) => (
                          <div
                            key={user.user_id}
                            onClick={() => handleMentionSelect(user)}
                            className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                          >
                            <div className="font-medium text-sm">{user.full_name}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button 
                    onClick={addNote}
                    disabled={!newNote.trim()}
                    size="sm"
                    className="h-10 bg-blue-600 hover:bg-blue-700 text-white"
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
                          {user && (
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
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if (editingNoteText.trim()) {
                                  saveEditNote();
                                }
                              }
                              if (e.key === 'Escape') {
                                cancelEditNote();
                              }
                            }}
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
          )}
        </div>
      </div>
    </div>
  );
};