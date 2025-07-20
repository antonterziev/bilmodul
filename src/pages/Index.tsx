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
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { supabase } from "@/integrations/supabase/client";
import { Phone, MessageCircle, LogOut, Search, Download, FileText, File, FileCheck, Receipt, BookOpen, CheckSquare } from "lucide-react";

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
    grossProfit: 0
  });

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login-or-signup");
    } else if (!isLoading && user) {
      // Check if user has completed onboarding
      const hasCompletedOnboarding = user.user_metadata?.onboarding_completed;
      if (!hasCompletedOnboarding) {
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
        .select('full_name, company_name')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        setUserProfile(data);
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

      setStats({ totalStock, averageStorageDays, inventoryValue, grossProfit });
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
          setSearchPlaceholder(`t.ex. ${regNumber} eller ${brand}`);
        } else if (regNumber) {
          setSearchPlaceholder(`t.ex. ${regNumber}`);
        } else if (brand) {
          setSearchPlaceholder(`t.ex. ${brand}`);
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

  const getBreadcrumbs = () => {
    const breadcrumbs = [];
    
    switch (currentView) {
      case "overview":
        breadcrumbs.push({ label: "Översikt" });
        break;
      case "statistics":
        breadcrumbs.push({ label: "Statistik" });
        break;
      case "purchase_form":
        breadcrumbs.push({ 
          label: "Inköp", 
          onClick: () => handleSectionToggle("inkop") 
        });
        breadcrumbs.push({ label: "Registrera inköp" });
        break;
      case "logistics":
        breadcrumbs.push({ 
          label: "Inköp", 
          onClick: () => handleSectionToggle("inkop") 
        });
        if (selectedVehicleId) {
          breadcrumbs.push({ 
            label: "Logistik", 
            onClick: () => setSelectedVehicleId(null) 
          });
          breadcrumbs.push({ label: "Fordonsdetaljer" });
        } else {
          breadcrumbs.push({ label: "Logistik" });
        }
        break;
      case "sales":
        breadcrumbs.push({ 
          label: "Affärer", 
          onClick: () => handleSectionToggle("affarer") 
        });
        if (selectedSaleVehicleId) {
          breadcrumbs.push({ 
            label: "Försäljning", 
            onClick: () => setSelectedSaleVehicleId(null) 
          });
          breadcrumbs.push({ label: "Säljformulär" });
        } else {
          breadcrumbs.push({ label: "Försäljning" });
        }
        break;
      case "lager_all":
      case "lager_stock":
      case "lager_sold":
        breadcrumbs.push({ 
          label: "Lager", 
          onClick: () => handleSectionToggle("lager") 
        });
        const lagerLabels = {
          'lager_all': 'Alla fordon',
          'lager_stock': 'På lager',
          'lager_sold': 'Sålda'
        };
        breadcrumbs.push({ label: lagerLabels[currentView as keyof typeof lagerLabels] });
        break;
      case "settings":
        breadcrumbs.push({ label: "Inställningar" });
        break;
      default:
        breadcrumbs.push({ label: "Dashboard" });
    }
    
    return breadcrumbs;
  };

  const renderMainContent = () => {
    switch (currentView) {
      case "purchase_form":
        return <PurchaseForm 
          key={purchaseFormKey}
          onSuccess={() => {
            loadStats();
            handleViewChange("lager_stock");
          }}
          onNavigateToVehicle={(vehicleId) => {
            setSelectedVehicleId(vehicleId);
            handleViewChange("logistics");
          }}
        />;

      case "logistics":
        if (selectedVehicleId) {
          return <LogisticsDetail 
            vehicleId={selectedVehicleId} 
            onBack={() => setSelectedVehicleId(null)} 
          />;
        }
        return <LogisticsList onViewVehicle={(vehicleId) => setSelectedVehicleId(vehicleId)} />;

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
        return <SalesList onSellVehicle={(vehicleId) => setSelectedSaleVehicleId(vehicleId)} />;

      case "settings":
        return <Settings />;

      case "statistics":
        return <Statistics 
          onBack={() => handleViewChange("overview")}
          totalStock={stats.totalStock}
          averageStorageDays={stats.averageStorageDays}
          inventoryValue={stats.inventoryValue}
          grossProfit={stats.grossProfit}
        />;

      case "lager_all":
      case "lager_stock":
      case "lager_sold":
        return (
          <>
            <DashboardStats 
              totalStock={stats.totalStock}
              averageStorageDays={stats.averageStorageDays}
              inventoryValue={stats.inventoryValue}
              grossProfit={stats.grossProfit}
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
          </>
        );

      default:
        // Default overview content
        const getFirstName = () => {
          if (userProfile?.full_name) {
            return userProfile.full_name.split(' ')[0];
          }
          return user?.email?.split('@')[0] || 'Användare';
        };

        return (
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Välkommen till Veksla, {getFirstName()}</h1>
            <p className="text-muted-foreground">Välj en sektion från menyn för att komma igång.</p>
          </div>
        );
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full flex bg-background">
        <AppSidebar 
          currentView={currentView}
          onViewChange={handleViewChange}
          expandedSections={expandedSections}
          onSectionToggle={handleSectionToggle}
        />
        
        <div className="flex-1 flex flex-col">
          {/* Header with logo in top left */}
          <header className="border-b flex flex-col">
            <div className="flex h-16">
              <div className="flex items-center px-4">
                <SidebarTrigger />
                <img src="/lovable-uploads/057dc8b8-62ce-4b36-b42f-7cda0b9a01d1.png" alt="Veksla" className="h-8 ml-4" />
              </div>
              <div className="flex-1 px-4 py-4 flex justify-end items-center">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    Välkommen {getDisplayName()}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowKundtjanst(true)} className="flex items-center gap-2 w-32">
                      <Phone className="h-4 w-4" />
                      <span className="text-foreground">Kundtjänst</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowSupportDialog(true)} className="flex items-center gap-2 w-32">
                      <MessageCircle className="h-4 w-4" />
                      Supportchatt
                    </Button>
                    <Button variant="outline" onClick={handleLogout} size="sm" className="flex items-center gap-2 w-32">
                      <LogOut className="h-4 w-4" />
                      Logga ut
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            {/* Second row with registrera inköp and search */}
            <div className="flex items-center px-4 pb-4 gap-4">
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white hover:text-white border-blue-600 font-medium"
                onClick={() => handleViewChange("purchase_form")}
              >
                Registrera inköp
              </Button>
              <div className="relative max-w-md">
                <Input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  disabled={inventoryItems.length === 0}
                  className="pl-9 w-full"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 p-6">
            <div className="max-w-7xl mx-auto">
              <Breadcrumbs items={getBreadcrumbs()} />
              

              {renderMainContent()}
            </div>
          </main>
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