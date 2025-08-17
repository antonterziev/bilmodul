import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { DashboardStats } from "@/components/Dashboard/DashboardStats";
import { VehicleList } from "@/components/Dashboard/VehicleList";
import { PurchaseForm } from "@/components/Dashboard/PurchaseForm";

import { Settings } from "@/components/Settings/Settings";
import { DeleteAccount } from "@/components/Settings/DeleteAccount";
import { AdminDashboard } from "@/components/Admin/AdminDashboard";
import { VehicleDetailsView } from "@/components/VehicleDetails/VehicleDetailsView";
import { Integrations } from "@/components/Integrations/Integrations";
import { AppSidebar } from "@/components/AppSidebar";

import { supabase } from "@/integrations/supabase/client";
import { Phone, MessageCircle, LogOut, Search, Filter, RotateCcw, Triangle, Unlink, Link, Bell, HelpCircle, ChevronDown, User, FileText, File, CheckSquare, BookOpen, Download, FileCheck, Receipt } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import * as Sentry from '@sentry/react';

// Test component for Sentry error tracking
function ErrorButton() {
  return (
    <button
      onClick={() => {
        throw new Error('This is your first error!');
      }}
      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
    >
      Break the world
    </button>
  );
}

const Index = () => {
  const { user, signOut, isLoading } = useAuth();
  const navigate = useNavigate();
  
  // Current view state
  const [currentView, setCurrentView] = useState("overview");
  const [previousView, setPreviousView] = useState("overview");
  
  // Expanded sections state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    lager: false,
    inkop: false,
    finansiering: false,
    affarer: false,
    direktfloden: false,
  });

  // Form and data states
  const [purchaseFormKey, setPurchaseFormKey] = useState(0);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  
  const [viewingVehicleId, setViewingVehicleId] = useState<string | null>(null);
  
  const [userProfile, setUserProfile] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [searchPlaceholder, setSearchPlaceholder] = useState("Laddar...");
  const [lagerFilter, setLagerFilter] = useState<'all' | 'på_lager' | 'såld'>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); // högst till lägst = desc, lägst till högst = asc
  const [sortField, setSortField] = useState<'storage-days' | 'purchase-price' | 'selling-price' | 'gross-profit'>('storage-days');
  
  // Dialog states
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showSupportDialog, setShowSupportDialog] = useState(false);
  const [showKundtjanst, setShowKundtjanst] = useState(false);
  const [showVerifikationDialog, setShowVerifikationDialog] = useState(false);
  const [showDokumentDialog, setShowDokumentDialog] = useState(false);
  
  // Stats state
  const [stats, setStats] = useState({
    totalStock: 0,
    averageStorageDays: 0,
    inventoryValue: 0
  });

  // Fortnox integration status
  const [fortnoxConnected, setFortnoxConnected] = useState(false);
  const [fortnoxIntegration, setFortnoxIntegration] = useState<any>(null);
  const [disconnectingFortnox, setDisconnectingFortnox] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login-or-signup");
    } else if (!isLoading && user) {
      // Check if email is verified first
      if (!user.email_confirmed_at) {
        navigate("/login-or-signup");
        return;
      }
      
      // Check if user has completed onboarding
      // Skip onboarding check if user is on password reset flow
      const hasCompletedOnboarding = user.user_metadata?.onboarding_completed;
      const isPasswordReset = window.location.pathname === '/password-reset';
      if (!hasCompletedOnboarding && !isPasswordReset) {
        navigate("/onboarding");
      }
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadStats();
      loadUserProfile();
      loadInventoryItems();
      checkFortnoxConnection();
    }
  }, [user]);

  // Listen for profile updates to refresh welcome message
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          
          loadUserProfile();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Navigation handlers
  const handleViewChange = (view: string) => {
    setPreviousView(currentView); // Store current view as previous before changing
    setCurrentView(view);
    setSelectedVehicleId(null);
    setViewingVehicleId(null); // Clear vehicle details view when navigating
    
    
    // Handle special cases
    if (view === "registrera_inkop") {
      setPurchaseFormKey(prev => prev + 1);
    }
    if (view.startsWith("lager")) {
      const filterMap: Record<string, 'all' | 'på_lager' | 'såld'> = {
        'lager_all': 'all',
        'lager_sold': 'såld'
      };
      setLagerFilter(filterMap[view] || 'all');
    }
  };

  const handleSectionToggle = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleLogout = () => {
    if (confirm("Är du säker på att du vill logga ut?")) {
      signOut();
    }
  };

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, full_name')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        
        setUserProfile(data);
      } else if (error) {
        console.error('Profile loading error:', error);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadStats = async () => {
    if (!user) return;

    try {
      // Get inventory counts by status
      const { data: inventoryData, error } = await supabase
        .from('inventory_items')
        .select('status, registration_number, created_at, purchase_price, selling_price, purchase_date, inventory_value');

      if (error) throw error;

      const vehiclesInStock = inventoryData?.filter(item => item.status === 'på_lager') || [];
      const totalStock = vehiclesInStock.length;
      
      // Calculate inventory value (sum of inventory_value for vehicles with status "på_lager")
      const inventoryValue = vehiclesInStock.reduce((sum, item) => sum + (item.inventory_value || 0), 0);
      
      // Calculate simple average of storage days
      let averageStorageDays = 0;
      if (vehiclesInStock.length > 0) {
        const calculateStorageDays = (purchaseDate: string) => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const purchase = new Date(purchaseDate);
          purchase.setHours(0, 0, 0, 0);
          const diffTime = today.getTime() - purchase.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          return Math.max(1, diffDays + 1); // Ensure minimum 1 day, add 1 to show day 1 when purchased today
        };
        
        const totalStorageDays = vehiclesInStock.reduce((sum, item) => {
          const storageDays = calculateStorageDays(item.purchase_date);
          return sum + storageDays;
        }, 0);
        
        averageStorageDays = Math.round(totalStorageDays / vehiclesInStock.length);
      }
      
      setStats({ totalStock, averageStorageDays, inventoryValue });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadInventoryItems = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('registration_number, brand, model')
        .eq('user_id', user.id)
        .limit(100);

      if (error) throw error;

      setInventoryItems(data || []);
      
      // Generate random placeholder text from existing data
      if (data && data.length > 0) {
        const randomItem = data[Math.floor(Math.random() * data.length)];
        
        const regNumber = randomItem.registration_number;
        const brand = randomItem.brand;
        
        if (regNumber && brand) {
          setSearchPlaceholder(`Sök fordon (t.ex. ${regNumber})`);
        } else if (regNumber) {
          setSearchPlaceholder(`Sök fordon (t.ex. ${regNumber})`);
        } else if (brand) {
          setSearchPlaceholder(`Sök fordon (t.ex. ${brand})`);
        } else {
          setSearchPlaceholder("Sök fordon...");
        }
      } else {
        setSearchPlaceholder("Ingen data tillgänglig");
      }
    } catch (error) {
      console.error('Error loading inventory items:', error);
      setSearchPlaceholder("Fel vid laddning");
    }
  };

  const checkFortnoxConnection = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('fortnox_integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking Fortnox connection:', error);
        setFortnoxConnected(false);
        setFortnoxIntegration(null);
        return;
      }

      setFortnoxConnected(!!data);
      setFortnoxIntegration(data);
    } catch (error) {
      console.error('Error checking Fortnox connection:', error);
      setFortnoxConnected(false);
      setFortnoxIntegration(null);
    }
  };

  const disconnectFortnox = async () => {
    if (!fortnoxIntegration) return;

    setDisconnectingFortnox(true);
    try {
      const { error } = await supabase
        .from('fortnox_integrations')
        .update({ is_active: false })
        .eq('id', fortnoxIntegration.id);

      if (error) throw error;

      setFortnoxIntegration(null);
      setFortnoxConnected(false);
      alert('Du har kopplats från Fortnox');
    } catch (error) {
      console.error('Error disconnecting Fortnox:', error);
      alert('Kunde inte koppla från Fortnox');
    } finally {
      setDisconnectingFortnox(false);
    }
  };

  const getDisplayName = () => {
    if (userProfile?.first_name) {
      return userProfile.first_name;
    }
    return user?.email?.split('@')[0] || 'Användare';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-xl text-muted-foreground">Laddar...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }


  const renderMainContent = () => {
    // Check if we're viewing a specific vehicle
    if (viewingVehicleId) {
      return (
        <VehicleDetailsView 
          vehicleId={viewingVehicleId} 
          onBack={() => {
            setViewingVehicleId(null);
            // Stay on the current view (like lagerlista) when going back
          }} 
        />
      );
    }

    switch (currentView) {
      case "purchase_form":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Registrera fordon</h2>
            <PurchaseForm 
              key={purchaseFormKey}
              onSuccess={() => {
                loadStats();
                handleViewChange("lager_all");
              }}
            />
          </div>
        );

      case "registrera_inkop":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Registrera inköp</h2>
            <PurchaseForm 
              key={purchaseFormKey}
              onSuccess={() => {
                loadStats();
                handleViewChange("lager_all");
              }}
            />
          </div>
        );



      case "settings":
        return <Settings />;

      case "radera-kontot":
        return <DeleteAccount onBack={() => handleViewChange("settings")} />;

      case "admin":
        return <AdminDashboard onBack={() => handleViewChange("overview")} />;

      case "lager_all":
      case "lager_sold":
        const getHeaderTitle = () => {
          switch (currentView) {
            case "lager_all": return "Lagerlista";
            case "lager_sold": return "Sålda";
            default: return "Lager";
          }
        };
        
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">{getHeaderTitle()}</h2>
            
            {/* Filter bar */}
             <div className="flex items-center justify-between gap-4 p-4 bg-card border rounded-lg">
               <div className="flex items-center gap-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8">
                        <Filter className="w-4 h-4 mr-1" />
                        Filter
                      </Button>
                    </DropdownMenuTrigger>
                     <DropdownMenuContent align="start" className="w-48">
                       <DropdownMenuItem>
                         <Checkbox className="mr-2" />
                         Såld
                       </DropdownMenuItem>
                     </DropdownMenuContent>
                   </DropdownMenu>
                   
                   <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                     <RotateCcw className="w-4 h-4" />
                   </Button>
                  
                  <div className="relative">
                    <Input
                      placeholder={inventoryItems.length > 0 ? searchPlaceholder : "Lägg till fordon först..."}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      disabled={inventoryItems.length === 0}
                      className="w-64 h-8 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <Search className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${inventoryItems.length > 0 ? 'text-muted-foreground' : 'text-muted-foreground/50'}`} />
                  </div>
                </div>
              
               <div className="flex items-center gap-4">
                
                 <div className="flex items-center gap-2">
                   <span className="text-sm text-muted-foreground">Sortera efter</span>
                   <Select 
                     defaultValue="storage-days" 
                     onValueChange={(value) => setSortField(value as 'storage-days' | 'purchase-price' | 'selling-price' | 'gross-profit')}
                   >
                     <SelectTrigger className="w-48 h-8">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                        <SelectItem value="storage-days">Lagerdagar</SelectItem>
                        <SelectItem value="purchase-price">Inköpspris</SelectItem>
                     </SelectContent>
                   </Select>
                   
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 w-8 p-0"
                      onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                    >
                      <Triangle className={`w-4 h-4 transition-transform ${sortOrder === 'asc' ? '' : 'rotate-180'}`} />
                   </Button>
                 </div>
              </div>
            </div>
            
            <VehicleList 
              filter={lagerFilter} 
              searchTerm={searchTerm}
              sortField={sortField}
              sortOrder={sortOrder}
              onViewVehicle={(vehicleId) => {
                setViewingVehicleId(vehicleId);
              }}
              onStatsUpdate={loadStats}
            />
           </div>
        );

      case 'integrationer':
        return <Integrations />;

      default:
        // Default overview content - includes both dashboard stats and statistics
        const getFirstName = () => {
          if (userProfile?.first_name) {
            return userProfile.first_name;
          }
          return user?.email?.split('@')[0] || 'Användare';
        };

        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Översikt</h2>
              <ErrorButton />
            </div>
            <DashboardStats
              totalStock={stats.totalStock}
              averageStorageDays={stats.averageStorageDays}
              inventoryValue={stats.inventoryValue}
            />
          </div>
        );
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen w-full bg-background flex flex-col">
        {/* Top header with logo spanning full width */}
        <div className="bg-white border-b flex h-16 z-10">
          <div className="flex items-center pl-6 py-3 w-72">
            <img src="/lovable-uploads/600c4315-b18a-44c9-9a47-d558560c64a8.png" alt="Bilmodul" className="h-8" />
          </div>
          <div className="flex-1 px-4 py-4 flex justify-end items-center">
            <div className="flex items-center gap-4">
              <div className="text-right">
                
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex items-center justify-center w-10">
                  <Bell className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-2 w-32">
                      <HelpCircle className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">Hjälp</span>
                      <ChevronDown className="h-3 w-3 flex-shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => setShowSupportDialog(true)}>
                      Kontakta support
                    </DropdownMenuItem>
                    <DropdownMenuItem className="flex items-center justify-between cursor-not-allowed pointer-events-none">
                      <span>Telefonsupport</span>
                      <span className="inline-flex items-center rounded-full bg-yellow-200 px-2 py-0.5 text-xs font-medium text-yellow-900">
                        PRO
                      </span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-2 w-32">
                      <User className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{userProfile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Profil'}</span>
                      <ChevronDown className="h-3 w-3 flex-shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-3 py-2 border-b">
                      <p className="font-medium">{userProfile?.full_name || 'Användare'}</p>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                    </div>
                    <DropdownMenuItem onClick={() => setCurrentView('settings')}>
                      Inställningar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                      <LogOut className="mr-2 h-4 w-4" />
                      Logga ut
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-row flex-1">
          <AppSidebar 
            currentView={currentView}
            onViewChange={handleViewChange}
            expandedSections={expandedSections}
            onSectionToggle={handleSectionToggle}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder={searchPlaceholder}
            hasVehicles={inventoryItems.length > 0}
          />
        
          <div className="flex-1 flex flex-col min-w-0">
            {/* Main Content Area */}
            <main className="flex-1 p-6 overflow-auto">
            <div className="max-w-7xl mx-auto">
              {renderMainContent()}
            </div>
          </main>
          </div>
        </div>

        {/* Dialogs */}
        <Dialog open={showKundtjanst} onOpenChange={setShowKundtjanst}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Kundtjänst</DialogTitle>
            </DialogHeader>
            <div className="p-4">
              <p className="mb-4">Kontakta vår kundtjänst för hjälp och support.</p>
              <div className="space-y-2">
                <p><strong>Telefon:</strong> +46 8-123 456 78</p>
                <p><strong>E-post:</strong> support@bilmodul.se</p>
                <p><strong>Öppettider:</strong> Mån-Fre 09:00-17:00</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showSupportDialog} onOpenChange={setShowSupportDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Supportchatt</DialogTitle>
            </DialogHeader>
            <div className="p-4">
              <p className="mb-4">Supportchatten är inte tillgänglig just nu.</p>
              <p>Vänligen kontakta oss via telefon eller e-post istället.</p>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Exportera data</DialogTitle>
            </DialogHeader>
            <div className="p-4">
              <p className="mb-4">Välj vilket format du vill exportera dina data i:</p>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="mr-2 h-4 w-4" />
                  Excel (.xlsx)
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <File className="mr-2 h-4 w-4" />
                  CSV (.csv)
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="mr-2 h-4 w-4" />
                  PDF-rapport
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showVerifikationDialog} onOpenChange={setShowVerifikationDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verifikation</DialogTitle>
            </DialogHeader>
            <div className="p-4">
              <p className="mb-4">Här kan du hantera verifikationer och bokföringsunderlag.</p>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Skapa ny verifikation
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Visa alla verifikationer
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Download className="mr-2 h-4 w-4" />
                  Exportera till bokföringsprogram
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showDokumentDialog} onOpenChange={setShowDokumentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dokument</DialogTitle>
            </DialogHeader>
            <div className="p-4">
              <p className="mb-4">Hantera alla dina affärsdokument på ett ställe.</p>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <FileCheck className="mr-2 h-4 w-4" />
                  Köpeavtal
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Receipt className="mr-2 h-4 w-4" />
                  Fakturor
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <File className="mr-2 h-4 w-4" />
                  Övriga dokument
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Download className="mr-2 h-4 w-4" />
                  Ladda upp dokument
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarProvider>
  );
};

export default Index;
