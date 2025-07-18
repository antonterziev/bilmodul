import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { supabase } from "@/integrations/supabase/client";
import { Home, BarChart3, Car, Settings as SettingsIcon, Truck, Download, Phone, MessageCircle, LogOut, CreditCard, Zap, FileCheck, FileText, File, Receipt, CreditCard as DirectPayments, Users, BookOpen, CheckSquare, Paperclip } from "lucide-react";

const Index = () => {
  const { user, signOut, isLoading } = useAuth();
  const navigate = useNavigate();
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [showLogistics, setShowLogistics] = useState(false);
  const [showSales, setShowSales] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [showLager, setShowLager] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showSupportDialog, setShowSupportDialog] = useState(false);
  const [showFinansiering, setShowFinansiering] = useState(false);
  const [showDirektatkomst, setShowDirektatkomst] = useState(false);
  const [showDirektanmalan, setShowDirektanmalan] = useState(false);
  const [showAvtal, setShowAvtal] = useState(false);
  const [showDokument, setShowDokument] = useState(false);
  const [showFakturor, setShowFakturor] = useState(false);
  const [showDirektbetalningar, setShowDirektbetalningar] = useState(false);
  const [showKundregister, setShowKundregister] = useState(false);
  const [showBokforingsunderlag, setShowBokforingsunderlag] = useState(false);
  const [showVerifikation, setShowVerifikation] = useState(false);
  const [showBilagor, setShowBilagor] = useState(false);
  const [showKundtjanst, setShowKundtjanst] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedSaleVehicleId, setSelectedSaleVehicleId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    totalStock: 0,
    inventoryValue: 0,
    lastSale: "-"
  });

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadStats();
      loadUserProfile();
    }
  }, [user]);

  const handleViewVehicle = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
  };

  const handleBackToLogistics = () => {
    setSelectedVehicleId(null);
  };

  const handleSellVehicle = (vehicleId: string) => {
    setSelectedSaleVehicleId(vehicleId);
  };

  const handleBackToSales = () => {
    setSelectedSaleVehicleId(null);
  };

  const handleSalesSuccess = () => {
    setSelectedSaleVehicleId(null);
    setShowSales(false);
    loadStats(); // Refresh stats after successful sale
  };

  const handleBackToSettings = () => {
    setShowSettings(false);
  };

  const handleBackToStatistics = () => {
    setShowStatistics(false);
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
        .select('status, registration_number, created_at, purchase_price')
        .eq('user_id', user.id);

      if (error) throw error;

      const totalStock = inventoryData?.filter(item => item.status === 'på_lager').length || 0;
      
      // Calculate inventory value (sum of purchase prices for vehicles with status "på_lager")
      const inventoryValue = inventoryData
        ?.filter(item => item.status === 'på_lager')
        .reduce((sum, item) => sum + (item.purchase_price || 0), 0) || 0;
      
      // Get last sold item
      const soldItems = inventoryData?.filter(item => item.status === 'såld').sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const lastSale = soldItems?.[0]?.registration_number || "-";

      setStats({ totalStock, inventoryValue, lastSale });
    } catch (error) {
      console.error('Error loading stats:', error);
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
    if (showPurchaseForm) {
      return <PurchaseForm onSuccess={() => {
        loadStats();
        setShowPurchaseForm(false);
      }} />;
    }

    if (showLogistics) {
      if (selectedVehicleId) {
        return <LogisticsDetail 
          vehicleId={selectedVehicleId} 
          onBack={handleBackToLogistics} 
        />;
      }
      return <LogisticsList onViewVehicle={handleViewVehicle} />;
    }

    if (showSales) {
      if (selectedSaleVehicleId) {
        return <SalesForm 
          vehicleId={selectedSaleVehicleId} 
          onBack={handleBackToSales}
          onSuccess={handleSalesSuccess}
        />;
      }
      return <SalesList onSellVehicle={handleSellVehicle} />;
    }

    if (showSettings) {
      return <Settings />;
    }

    if (showStatistics) {
      return <Statistics 
        onBack={handleBackToStatistics}
        totalStock={stats.totalStock}
        inventoryValue={stats.inventoryValue}
        lastSale={stats.lastSale}
      />;
    }

    if (showLager) {
      return (
        <>
          <DashboardStats 
            totalStock={stats.totalStock}
            inventoryValue={stats.inventoryValue}
            lastSale={stats.lastSale}
          />
          <VehicleList />
        </>
      );
    }

    // Default content for Hem
    const getFirstName = () => {
      if (userProfile?.full_name) {
        return userProfile.full_name.split(' ')[0];
      }
      return user?.email?.split('@')[0] || 'Användare';
    };

    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4">Välkommen till Lagermodulen, {getFirstName()}</h1>
        <p className="text-muted-foreground">Välj en sektion från menyn för att komma igång.</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b flex">
        <div className="w-64 p-4 flex items-center justify-center">
          <h2 className="text-2xl font-bold">Lagermodulen</h2>
        </div>
        <div className="flex-1 px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Välkommen {getDisplayName()}
            </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowKundtjanst(true)} className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span className="text-foreground">Kundtjänst</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowSupportDialog(true)} className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Supportchatt
                </Button>
                <Button variant="outline" onClick={handleLogout} size="sm" className="flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  Logga ut
                </Button>
              </div>
          </div>
        </div>
      </header>
      
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-border flex flex-col">
          <div className="p-4">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white border-blue-500"
                onClick={() => {
                  setShowPurchaseForm(true);
                  setShowLogistics(false);
                  setShowSales(false);
                  setShowSettings(false);
                  setShowStatistics(false);
                  setShowLager(false);
                  setSelectedVehicleId(null);
                  setSelectedSaleVehicleId(null);
                }}
              >
                Köp
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 bg-green-500 hover:bg-green-600 text-white border-green-500"
                onClick={() => {
                  setShowPurchaseForm(false);
                  setShowLogistics(false);
                  setShowSales(true);
                  setShowSettings(false);
                  setShowStatistics(false);
                  setShowLager(false);
                  setSelectedVehicleId(null);
                  setSelectedSaleVehicleId(null);
                }}
              >
                Sälj
              </Button>
            </div>
          </div>
          
          <nav className="flex-1 p-4">
            <ul className="space-y-2">
              <li>
                <Button 
                  variant={!showPurchaseForm && !showLogistics && !showSales && !showSettings && !showStatistics && !showLager ? "default" : "ghost"} 
                  className={`w-full justify-start ${!showPurchaseForm && !showLogistics && !showSales && !showSettings && !showStatistics && !showLager ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  onClick={() => {
                    setShowPurchaseForm(false);
                    setShowLogistics(false);
                    setShowSales(false);
                    setShowSettings(false);
                    setShowStatistics(false);
                    setShowLager(false);
                    setSelectedVehicleId(null);
                    setSelectedSaleVehicleId(null);
                  }}
                >
                  <Home className="mr-2 h-4 w-4" />
                  Hem
                </Button>
              </li>
              <li>
                <Button 
                  variant={showStatistics ? "default" : "ghost"} 
                  className={`w-full justify-start ${showStatistics ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  onClick={() => {
                    setShowPurchaseForm(false);
                    setShowLogistics(false);
                    setShowSales(false);
                    setShowSettings(false);
                    setShowStatistics(true);
                    setShowLager(false);
                    setSelectedVehicleId(null);
                    setSelectedSaleVehicleId(null);
                  }}
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Statistik
                </Button>
              </li>
              <li>
                <Button 
                  variant={showLager ? "default" : "ghost"} 
                  className={`w-full justify-start ${showLager ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  onClick={() => {
                    setShowPurchaseForm(false);
                    setShowLogistics(false);
                    setShowSales(false);
                    setShowSettings(false);
                    setShowStatistics(false);
                    setShowLager(true);
                    setSelectedVehicleId(null);
                    setSelectedSaleVehicleId(null);
                  }}
                >
                  <Car className="mr-2 h-4 w-4" />
                  Lager
                </Button>
              </li>
              <li>
                <Button 
                  variant={showLogistics ? "default" : "ghost"} 
                  className={`w-full justify-start ${showLogistics ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  onClick={() => {
                    setShowPurchaseForm(false);
                    setShowLogistics(true);
                    setShowSales(false);
                    setShowSettings(false);
                    setShowStatistics(false);
                    setShowLager(false);
                    setSelectedVehicleId(null);
                    setSelectedSaleVehicleId(null);
                  }}
                >
                  <Truck className="mr-2 h-4 w-4" />
                  Transport
                </Button>
              </li>
              <li>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setShowFinansiering(true)}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Finansiering
                </Button>
              </li>
              <li>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setShowDirektatkomst(true)}
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Direktåtkomst
                </Button>
              </li>
              <li>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setShowDirektanmalan(true)}
                >
                  <FileCheck className="mr-2 h-4 w-4" />
                  Direktanmälan
                </Button>
              </li>
              <li>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setShowAvtal(true)}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Avtal
                </Button>
              </li>
              <li>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setShowDokument(true)}
                >
                  <File className="mr-2 h-4 w-4" />
                  Dokument
                </Button>
              </li>
              <li>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setShowFakturor(true)}
                >
                  <Receipt className="mr-2 h-4 w-4" />
                  Fakturor
                </Button>
              </li>
              <li>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setShowDirektbetalningar(true)}
                >
                  <DirectPayments className="mr-2 h-4 w-4" />
                  Direktbetalningar
                </Button>
              </li>
              <li>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setShowKundregister(true)}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Kundregister
                </Button>
              </li>
              <li>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setShowBokforingsunderlag(true)}
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  Bokföringsunderlag
                </Button>
              </li>
              <li>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setShowVerifikation(true)}
                >
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Verifikation
                </Button>
              </li>
              <li>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setShowBilagor(true)}
                >
                  <Paperclip className="mr-2 h-4 w-4" />
                  Bilagor
                </Button>
              </li>
              <li>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setShowExportDialog(true)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Exportera
                </Button>
              </li>
              <li>
                <Button 
                  variant={showSettings ? "default" : "ghost"} 
                  className={`w-full justify-start ${showSettings ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  onClick={() => {
                    setShowPurchaseForm(false);
                    setShowLogistics(false);
                    setShowSales(false);
                    setShowSettings(true);
                    setShowStatistics(false);
                    setShowLager(false);
                    setSelectedVehicleId(null);
                    setSelectedSaleVehicleId(null);
                  }}
                >
                  <SettingsIcon className="mr-2 h-4 w-4" />
                  Inställningar
                </Button>
              </li>
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1">
          <main className="container mx-auto px-4 py-8">
            {renderMainContent()}
          </main>
        </div>
      </div>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Premiumfunktion</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-6 py-4">
             <div className="flex items-center justify-center w-32 h-20 bg-white rounded-lg border">
               <img 
                 src="/lovable-uploads/ff47e205-8367-4921-a257-530eb5597fdd.png" 
                 alt="Fortnox logo" 
                 className="h-12 object-contain"
               />
             </div>
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                Dataexport till Fortnox och Visma är en betalfunktion
              </p>
              <p className="text-sm text-muted-foreground">
                Uppgradera ditt medlemskap för att få tillgång till alla premiumfunktioner
              </p>
            </div>
            <Button className="w-full" onClick={() => setShowExportDialog(false)}>
              Uppgradera medlemskap
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Support Dialog */}
      <Dialog open={showSupportDialog} onOpenChange={setShowSupportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Premiumfunktion</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-6 py-4">
            <div className="flex items-center justify-center w-20 h-20 bg-green-100 rounded-lg">
              <svg viewBox="0 0 100 100" className="w-12 h-12">
                <text x="50" y="35" textAnchor="middle" className="text-lg font-bold fill-green-600">💬</text>
                <text x="50" y="70" textAnchor="middle" className="text-xs fill-green-600">SUPPORT</text>
              </svg>
            </div>
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                Supportchatt är en betalfunktion
              </p>
              <p className="text-sm text-muted-foreground">
                Uppgradera ditt medlemskap för att få tillgång till alla premiumfunktioner
              </p>
            </div>
            <Button className="w-full" onClick={() => setShowSupportDialog(false)}>
              Uppgradera medlemskap
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Finansiering Dialog */}
      <Dialog open={showFinansiering} onOpenChange={setShowFinansiering}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Premiumfunktion</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-6 py-4">
            <div className="flex items-center justify-center w-20 h-20 bg-blue-100 rounded-lg">
              <CreditCard className="w-12 h-12 text-blue-600" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                Finansiering är en betalfunktion
              </p>
              <p className="text-sm text-muted-foreground">
                Uppgradera ditt medlemskap för att få tillgång till alla premiumfunktioner
              </p>
            </div>
            <Button className="w-full" onClick={() => setShowFinansiering(false)}>
              Uppgradera medlemskap
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Direktåtkomst Dialog */}
      <Dialog open={showDirektatkomst} onOpenChange={setShowDirektatkomst}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Premiumfunktion</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-6 py-4">
            <div className="flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-lg">
              <Zap className="w-12 h-12 text-yellow-600" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                Direktåtkomst är en betalfunktion
              </p>
              <p className="text-sm text-muted-foreground">
                Uppgradera ditt medlemskap för att få tillgång till alla premiumfunktioner
              </p>
            </div>
            <Button className="w-full" onClick={() => setShowDirektatkomst(false)}>
              Uppgradera medlemskap
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Direktanmälan Dialog */}
      <Dialog open={showDirektanmalan} onOpenChange={setShowDirektanmalan}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Premiumfunktion</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-6 py-4">
            <div className="flex items-center justify-center w-20 h-20 bg-purple-100 rounded-lg">
              <FileCheck className="w-12 h-12 text-purple-600" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                Direktanmälan är en betalfunktion
              </p>
              <p className="text-sm text-muted-foreground">
                Uppgradera ditt medlemskap för att få tillgång till alla premiumfunktioner
              </p>
            </div>
            <Button className="w-full" onClick={() => setShowDirektanmalan(false)}>
              Uppgradera medlemskap
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Avtal Dialog */}
      <Dialog open={showAvtal} onOpenChange={setShowAvtal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Premiumfunktion</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-6 py-4">
            <div className="flex items-center justify-center w-20 h-20 bg-gray-100 rounded-lg">
              <FileText className="w-12 h-12 text-gray-600" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                Avtal är en betalfunktion
              </p>
              <p className="text-sm text-muted-foreground">
                Uppgradera ditt medlemskap för att få tillgång till alla premiumfunktioner
              </p>
            </div>
            <Button className="w-full" onClick={() => setShowAvtal(false)}>
              Uppgradera medlemskap
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dokument Dialog */}
      <Dialog open={showDokument} onOpenChange={setShowDokument}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Premiumfunktion</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-6 py-4">
            <div className="flex items-center justify-center w-20 h-20 bg-indigo-100 rounded-lg">
              <File className="w-12 h-12 text-indigo-600" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                Dokument är en betalfunktion
              </p>
              <p className="text-sm text-muted-foreground">
                Uppgradera ditt medlemskap för att få tillgång till alla premiumfunktioner
              </p>
            </div>
            <Button className="w-full" onClick={() => setShowDokument(false)}>
              Uppgradera medlemskap
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fakturor Dialog */}
      <Dialog open={showFakturor} onOpenChange={setShowFakturor}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Premiumfunktion</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-6 py-4">
            <div className="flex items-center justify-center w-20 h-20 bg-orange-100 rounded-lg">
              <Receipt className="w-12 h-12 text-orange-600" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                Fakturor är en betalfunktion
              </p>
              <p className="text-sm text-muted-foreground">
                Uppgradera ditt medlemskap för att få tillgång till alla premiumfunktioner
              </p>
            </div>
            <Button className="w-full" onClick={() => setShowFakturor(false)}>
              Uppgradera medlemskap
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Direktbetalningar Dialog */}
      <Dialog open={showDirektbetalningar} onOpenChange={setShowDirektbetalningar}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Premiumfunktion</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-6 py-4">
            <div className="flex items-center justify-center w-20 h-20 bg-green-100 rounded-lg">
              <DirectPayments className="w-12 h-12 text-green-600" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                Direktbetalningar är en betalfunktion
              </p>
              <p className="text-sm text-muted-foreground">
                Uppgradera ditt medlemskap för att få tillgång till alla premiumfunktioner
              </p>
            </div>
            <Button className="w-full" onClick={() => setShowDirektbetalningar(false)}>
              Uppgradera medlemskap
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Kundregister Dialog */}
      <Dialog open={showKundregister} onOpenChange={setShowKundregister}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Premiumfunktion</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-6 py-4">
            <div className="flex items-center justify-center w-20 h-20 bg-teal-100 rounded-lg">
              <Users className="w-12 h-12 text-teal-600" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                Kundregister är en betalfunktion
              </p>
              <p className="text-sm text-muted-foreground">
                Uppgradera ditt medlemskap för att få tillgång till alla premiumfunktioner
              </p>
            </div>
            <Button className="w-full" onClick={() => setShowKundregister(false)}>
              Uppgradera medlemskap
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bokföringsunderlag Dialog */}
      <Dialog open={showBokforingsunderlag} onOpenChange={setShowBokforingsunderlag}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Premiumfunktion</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-6 py-4">
            <div className="flex items-center justify-center w-20 h-20 bg-red-100 rounded-lg">
              <BookOpen className="w-12 h-12 text-red-600" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                Bokföringsunderlag är en betalfunktion
              </p>
              <p className="text-sm text-muted-foreground">
                Uppgradera ditt medlemskap för att få tillgång till alla premiumfunktioner
              </p>
            </div>
            <Button className="w-full" onClick={() => setShowBokforingsunderlag(false)}>
              Uppgradera medlemskap
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Verifikation Dialog */}
      <Dialog open={showVerifikation} onOpenChange={setShowVerifikation}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Premiumfunktion</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-6 py-4">
            <div className="flex items-center justify-center w-20 h-20 bg-cyan-100 rounded-lg">
              <CheckSquare className="w-12 h-12 text-cyan-600" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                Verifikation är en betalfunktion
              </p>
              <p className="text-sm text-muted-foreground">
                Uppgradera ditt medlemskap för att få tillgång till alla premiumfunktioner
              </p>
            </div>
            <Button className="w-full" onClick={() => setShowVerifikation(false)}>
              Uppgradera medlemskap
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bilagor Dialog */}
      <Dialog open={showBilagor} onOpenChange={setShowBilagor}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Premiumfunktion</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-6 py-4">
            <div className="flex items-center justify-center w-20 h-20 bg-pink-100 rounded-lg">
              <Paperclip className="w-12 h-12 text-pink-600" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                Bilagor är en betalfunktion
              </p>
              <p className="text-sm text-muted-foreground">
                Uppgradera ditt medlemskap för att få tillgång till alla premiumfunktioner
              </p>
            </div>
            <Button className="w-full" onClick={() => setShowBilagor(false)}>
              Uppgradera medlemskap
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Kundtjänst Dialog */}
      <Dialog open={showKundtjanst} onOpenChange={setShowKundtjanst}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Premiumfunktion</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-6 py-4">
            <div className="flex items-center justify-center w-20 h-20 bg-blue-100 rounded-lg">
              <Phone className="w-12 h-12 text-blue-600" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                Kundtjänst är en betalfunktion
              </p>
              <p className="text-sm text-muted-foreground">
                Uppgradera ditt medlemskap för att få tillgång till alla premiumfunktioner
              </p>
            </div>
            <Button className="w-full" onClick={() => setShowKundtjanst(false)}>
              Uppgradera medlemskap
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
