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
import { LogisticsList } from "@/components/Logistics/LogisticsList";
import { LogisticsDetail } from "@/components/Logistics/LogisticsDetail";
import { SalesList } from "@/components/Sales/SalesList";
import { SalesForm } from "@/components/Sales/SalesForm";
import { Settings } from "@/components/Settings/Settings";
import { Statistics } from "@/components/Statistics/Statistics";
import { AppSidebar } from "@/components/AppSidebar";

import { supabase } from "@/integrations/supabase/client";
import { Phone, MessageCircle, LogOut, Search, Download, FileText, File, FileCheck, Receipt, BookOpen, CheckSquare, User, ChevronDown, Bell, HelpCircle, Link, Filter } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Index = () => {
  const { user, signOut, isLoading } = useAuth();
  const navigate = useNavigate();
  
  // Current view state
  const [currentView, setCurrentView] = useState("overview");
  
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
  const [selectedSaleVehicleId, setSelectedSaleVehicleId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [searchPlaceholder, setSearchPlaceholder] = useState("Laddar...");
  const [lagerFilter, setLagerFilter] = useState<'all' | 'på_lager' | 'såld'>('all');
  
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
    inventoryValue: 0,
    grossProfit: 0,
    grossMargin: 0
  });

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
          console.log('Profile updated, refreshing...');
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
    setCurrentView(view);
    setSelectedVehicleId(null);
    setSelectedSaleVehicleId(null);
    
    // Handle special cases
    if (view === "purchase_form") {
      setPurchaseFormKey(prev => prev + 1);
    }
    if (view.startsWith("lager")) {
      const filterMap: Record<string, 'all' | 'på_lager' | 'såld'> = {
        'lager_all': 'all',
        'lager_stock': 'på_lager', 
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
        .select('first_name, last_name, full_name, company_name')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        console.log('Profile data loaded:', data);
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
        .select('status, registration_number, created_at, purchase_price, expected_selling_price, purchase_date')
        .eq('user_id', user.id);

      if (error) throw error;

      const vehiclesInStock = inventoryData?.filter(item => item.status === 'på_lager') || [];
      const totalStock = vehiclesInStock.length;
      
      // Calculate inventory value (sum of purchase prices for vehicles with status "på_lager")
      const inventoryValue = vehiclesInStock.reduce((sum, item) => sum + (item.purchase_price || 0), 0);
      
      // Calculate price-weighted average storage days
      let averageStorageDays = 0;
      if (vehiclesInStock.length > 0 && inventoryValue > 0) {
        const calculateStorageDays = (purchaseDate: string) => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const purchase = new Date(purchaseDate);
          purchase.setHours(0, 0, 0, 0);
          const diffTime = today.getTime() - purchase.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          return Math.max(1, diffDays + 1); // Ensure minimum 1 day, add 1 to show day 1 when purchased today
        };
        
        const weightedSum = vehiclesInStock.reduce((sum, item) => {
          const storageDays = calculateStorageDays(item.purchase_date);
          return sum + (storageDays * item.purchase_price);
        }, 0);
        
        averageStorageDays = Math.round(weightedSum / inventoryValue);
      }
      
      // Calculate gross profit (sum of (expected_selling_price - purchase_price) for vehicles with status "på_lager")
      const grossProfit = vehiclesInStock
        .filter(item => item.expected_selling_price)
        .reduce((sum, item) => sum + ((item.expected_selling_price || 0) - item.purchase_price), 0);

      // Calculate gross margin (expected profit / expected selling price * 100)
      const totalExpectedSellingPrice = vehiclesInStock
        .filter(item => item.expected_selling_price)
        .reduce((sum, item) => sum + (item.expected_selling_price || 0), 0);
      
      const grossMargin = totalExpectedSellingPrice > 0 ? (grossProfit / totalExpectedSellingPrice) * 100 : 0;

      setStats({ totalStock, averageStorageDays, inventoryValue, grossProfit, grossMargin });
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

  const getDisplayName = () => {
    if (userProfile?.full_name) {
      return userProfile.full_name;
    }
    return user?.email || 'Användare';
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
    switch (currentView) {
      case "purchase_form":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Registrera fordon</h2>
            <PurchaseForm 
              key={purchaseFormKey}
              onSuccess={() => {
                loadStats();
                handleViewChange("lager_stock");
              }}
              onNavigateToVehicle={(vehicleId) => {
                setSelectedVehicleId(vehicleId);
                handleViewChange("logistics");
              }}
            />
          </div>
        );

      case "logistics":
        if (selectedVehicleId) {
          return <LogisticsDetail 
            vehicleId={selectedVehicleId} 
            onBack={() => setSelectedVehicleId(null)} 
          />;
        }
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Logistik</h2>
            <LogisticsList onViewVehicle={(vehicleId) => setSelectedVehicleId(vehicleId)} />
          </div>
        );

      case "sales":
        if (selectedSaleVehicleId) {
          return <SalesForm 
            vehicleId={selectedSaleVehicleId} 
            onBack={() => setSelectedSaleVehicleId(null)}
            onSuccess={() => {
              setSelectedSaleVehicleId(null);
              handleViewChange("overview");
              loadStats();
            }}
          />;
        }
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Försäljning</h2>
            <SalesList onSellVehicle={(vehicleId) => setSelectedSaleVehicleId(vehicleId)} />
          </div>
        );

      case "settings":
        return <Settings />;

      case "lager_all":
      case "lager_stock":
      case "lager_sold":
        const getHeaderTitle = () => {
          switch (currentView) {
            case "lager_all": return "Lagerlista";
            case "lager_stock": return "I lager";
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
                      I lager
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Checkbox className="mr-2" />
                      Såld
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Checkbox className="mr-2" />
                      Leverantörsfaktura
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Checkbox className="mr-2" />
                      Annat
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Checkbox className="mr-2" />
                      Okategoriserad
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Input
                    placeholder="Sök"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64 h-8"
                  />
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Sortera efter</span>
                  <Select defaultValue="newest">
                    <SelectTrigger className="w-48 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Skapandedatum (nyast till äldst)</SelectItem>
                      <SelectItem value="oldest">Skapandedatum (äldst till nyast)</SelectItem>
                      <SelectItem value="price-high">Pris (högst till lägst)</SelectItem>
                      <SelectItem value="price-low">Pris (lägst till högst)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            <DashboardStats
              totalStock={stats.totalStock}
              averageStorageDays={stats.averageStorageDays}
              inventoryValue={stats.inventoryValue}
              grossProfit={stats.grossProfit}
              grossMargin={stats.grossMargin}
            />
            <VehicleList 
              filter={lagerFilter} 
              searchTerm={searchTerm}
              onSellVehicle={(vehicleId) => {
                setSelectedSaleVehicleId(vehicleId);
                handleViewChange("sales");
              }}
              onStatsUpdate={loadStats}
            />
          </div>
        );

      case 'integrationer':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold mb-2">Integrationer</h1>
            <p className="text-muted-foreground mb-6">Här hittar du alla integrationer som för närvarande finns i Veksla.</p>
            
            <div className="space-y-4">
              <div className="bg-card border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
                      <img src="/lovable-uploads/06ce5fbb-cb35-47f9-9b24-5b51bdbe0647.png" alt="Fortnox" className="w-10 h-10 object-contain" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">Automatisk bokföring – Fortnox</h3>
                      <p className="text-sm text-muted-foreground">Bokför dina fordonsaffärer smidigt och automatiskt med Fortnox</p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    disabled
                  onClick={async () => {
                    console.log('Koppla button clicked - initiating Fortnox connection');
                    try {
                      console.log('Calling fortnox-oauth function...');
                      const { data, error } = await supabase.functions.invoke('fortnox-oauth', {
                        body: { action: 'get_auth_url' }
                      });

                      console.log('Fortnox OAuth response:', { data, error });

                      if (error) {
                        console.error('Fortnox OAuth error:', error);
                        throw error;
                      }

                      if (!data?.auth_url) {
                        throw new Error('No auth URL received from Fortnox OAuth function');
                      }

                      console.log('Redirecting to Fortnox OAuth URL:', data.auth_url);
                      // Redirect to Fortnox OAuth
                      window.location.href = data.auth_url;
                      
                    } catch (error: any) {
                      console.error('Fortnox connection error:', error);
                      // You could add a toast here if needed
                    }
                  }}
                  >
                    <Link className="h-4 w-4 mr-2" />
                    Koppla
                  </Button>
                </div>
              </div>

              <div className="bg-card border rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
                    <img src="/lovable-uploads/7b240d76-c798-4b46-828d-0bb9b4250b35.png" alt="Visma" className="w-10 h-10 object-contain" />
                  </div>
                  <div>
                    <h3 className="font-medium">Automatisk bokföring – Visma</h3>
                    <p className="text-sm text-muted-foreground">Bokför dina fordonsaffärer smidigt och automatiskt med Visma</p>
                  </div>
                </div>
                <Button variant="outline" disabled>
                  <Link className="h-4 w-4 mr-2" />
                  Koppla
                </Button>
              </div>


            </div>
          </div>
        );

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
            <h2 className="text-2xl font-bold">Översikt</h2>
          <Statistics
            onBack={() => {}}
            totalStock={stats.totalStock}
            averageStorageDays={stats.averageStorageDays}
            inventoryValue={stats.inventoryValue}
            grossProfit={stats.grossProfit}
            grossMargin={stats.grossMargin}
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
            <img src="/lovable-uploads/057dc8b8-62ce-4b36-b42f-7cda0b9a01d1.png" alt="Veksla" className="h-8" />
          </div>
          <div className="flex-1 px-4 py-4 flex justify-end items-center">
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-muted-foreground">
                  Välkommen {userProfile?.first_name || user?.email?.split('@')[0] || 'Användare'}
                </div>
                <div className="text-xs text-muted-foreground truncate max-w-48 text-left">
                  {userProfile?.company_name || ''}
                </div>
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
                    <DropdownMenuItem onClick={() => setCurrentView('radera-kontot')}>
                      Radera kontot
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
                <p><strong>E-post:</strong> support@veksla.se</p>
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
