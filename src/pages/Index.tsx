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
import { supabase } from "@/integrations/supabase/client";
import { Home, BarChart3, Package, Settings as SettingsIcon, Truck, Download, Phone } from "lucide-react";

const Index = () => {
  const { user, signOut, isLoading } = useAuth();
  const navigate = useNavigate();
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [showLogistics, setShowLogistics] = useState(false);
  const [showSales, setShowSales] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
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
      return <Settings onBack={handleBackToSettings} />;
    }

    // Default dashboard content
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
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b flex">
        <div className="w-64 p-4 border-r flex items-center justify-center">
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
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <div className="flex flex-col">
                    <span>Kundtjänst</span>
                    <span>070 112 112</span>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Supportchatt
                </Button>
                <Button variant="outline" onClick={() => setShowSettings(true)} size="sm">
                  Inställningar
                </Button>
                <Button variant="outline" onClick={signOut}>
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
                size="sm" 
                className="flex-1"
                onClick={() => setShowPurchaseForm(true)}
              >
                Köp
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => setShowSales(true)}
              >
                Sälj
              </Button>
            </div>
          </div>
          
          <nav className="flex-1 p-4">
            <ul className="space-y-2">
              <li>
                <Button 
                  variant={!showPurchaseForm && !showLogistics && !showSales && !showSettings ? "default" : "ghost"} 
                  className={`w-full justify-start ${!showPurchaseForm && !showLogistics && !showSales && !showSettings ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  onClick={() => {
                    setShowPurchaseForm(false);
                    setShowLogistics(false);
                    setShowSales(false);
                    setShowSettings(false);
                    setSelectedVehicleId(null);
                    setSelectedSaleVehicleId(null);
                  }}
                >
                  <Home className="mr-2 h-4 w-4" />
                  Hem
                </Button>
              </li>
              <li>
                <Button variant="ghost" className="w-full justify-start text-muted-foreground">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Statistik
                </Button>
              </li>
              <li>
                <Button variant="ghost" className="w-full justify-start text-muted-foreground">
                  <Package className="mr-2 h-4 w-4" />
                  Lager
                </Button>
              </li>
              <li>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setShowLogistics(true)}
                >
                  <Truck className="mr-2 h-4 w-4" />
                  Transport
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
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setShowSettings(true)}
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
            <DialogTitle className="text-center">Premium Feature</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-6 py-4">
            <div className="flex items-center justify-center w-20 h-20 bg-blue-100 rounded-lg">
              <svg viewBox="0 0 100 100" className="w-12 h-12">
                <text x="50" y="35" textAnchor="middle" className="text-lg font-bold fill-blue-600">F</text>
                <text x="50" y="70" textAnchor="middle" className="text-xs fill-blue-600">ORTNOX</text>
              </svg>
            </div>
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                Dataexport till Fortnox är en betalfunktion
              </p>
              <p className="text-sm text-muted-foreground">
                Uppgradera ditt medlemskap för att få tillgång till alla premiumfunktioner
              </p>
            </div>
            <Button className="w-full" onClick={() => setShowExportDialog(false)}>
              Uppgradera mitt medlemskap
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
