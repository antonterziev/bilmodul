import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { DashboardStats } from "@/components/Dashboard/DashboardStats";
import { PurchaseForm } from "@/components/Dashboard/PurchaseForm";
import { LogisticsList } from "@/components/Logistics/LogisticsList";
import { LogisticsDetail } from "@/components/Logistics/LogisticsDetail";
import { SalesList } from "@/components/Sales/SalesList";
import { SalesForm } from "@/components/Sales/SalesForm";
import { Settings } from "@/components/Settings/Settings";
import { supabase } from "@/integrations/supabase/client";

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
    inTransit: 0,
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
        .select('status, registration_number, created_at')
        .eq('user_id', user.id);

      if (error) throw error;

      const totalStock = inventoryData?.filter(item => item.status === 'på_lager').length || 0;
      const inTransit = inventoryData?.filter(item => item.status === 'på_väg').length || 0;
      
      // Get last sold item
      const soldItems = inventoryData?.filter(item => item.status === 'såld').sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const lastSale = soldItems?.[0]?.registration_number || "-";

      setStats({ totalStock, inTransit, lastSale });
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

  if (showPurchaseForm) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
                  <path d="M5 17h2c0 1.1.9 2 2 2s2-.9 2-2h6c0 1.1.9 2 2 2s2-.9 2-2h2v-2l-1-5H4l-1 5v2h2zm2.5-7h9l.5 2H7l.5-2zM9 13.5c-.8 0-1.5.7-1.5 1.5s.7 1.5 1.5 1.5 1.5-.7 1.5-1.5-.7-1.5-1.5-1.5zm10 0c-.8 0-1.5.7-1.5 1.5s.7 1.5 1.5 1.5 1.5-.7 1.5-1.5-.7-1.5-1.5-1.5z"/>
                  <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8h2c0-1.1.9-2 2-2s2 .9 2 2h6c0-1.1.9-2 2-2s2 .9 2 2h2v-8l-2.08-5.99z"/>
                </svg>
              </div>
              <h1 className="text-2xl font-bold">Lagermodulen</h1>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => setShowPurchaseForm(false)}>
                Tillbaka till dashboard
              </Button>
              <span className="text-sm text-muted-foreground">
                Välkommen {getDisplayName()}
              </span>
              <Button variant="outline" onClick={signOut}>
                Logga ut
              </Button>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <PurchaseForm onSuccess={() => {
            loadStats();
            setShowPurchaseForm(false);
          }} />
        </main>
      </div>
    );
  }

  if (showLogistics) {
    if (selectedVehicleId) {
      return (
        <div className="min-h-screen bg-background">
          <header className="border-b">
            <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
                  <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L4 10v8c0 .55.45 1 1 1h1c0-1.1.9-2 2-2s2 .9 2 2h4c0-1.1.9-2 2-2s2 .9 2 2h1c.55 0 1-.45 1-1v-8l-1.08-3.99z"/>
                  <circle cx="8" cy="17" r="1.5"/>
                  <circle cx="16" cy="17" r="1.5"/>
                </svg>
              </div>
              <h1 className="text-2xl font-bold">Lagermodulen</h1>
            </div>
              <div className="flex items-center gap-4">
                <Button variant="outline" onClick={() => setShowLogistics(false)}>
                  Tillbaka till dashboard
                </Button>
                <span className="text-sm text-muted-foreground">
                  Välkommen {getDisplayName()}
                </span>
                <Button variant="outline" onClick={signOut}>
                  Logga ut
                </Button>
              </div>
            </div>
          </header>
          <main className="container mx-auto px-4 py-8">
            <LogisticsDetail 
              vehicleId={selectedVehicleId} 
              onBack={handleBackToLogistics} 
            />
          </main>
        </div>
      );
    }
    
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
                  <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L4 10v8c0 .55.45 1 1 1h1c0-1.1.9-2 2-2s2 .9 2 2h4c0-1.1.9-2 2-2s2 .9 2 2h1c.55 0 1-.45 1-1v-8l-1.08-3.99z"/>
                  <circle cx="8" cy="17" r="1.5"/>
                  <circle cx="16" cy="17" r="1.5"/>
                </svg>
              </div>
              <h1 className="text-2xl font-bold">Lagermodulen</h1>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => setShowLogistics(false)}>
                Tillbaka till dashboard
              </Button>
              <span className="text-sm text-muted-foreground">
                Välkommen {getDisplayName()}
              </span>
              <Button variant="outline" onClick={signOut}>
                Logga ut
              </Button>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <LogisticsList onViewVehicle={handleViewVehicle} />
        </main>
      </div>
    );
  }

  if (showSales) {
    if (selectedSaleVehicleId) {
      return (
        <div className="min-h-screen bg-background">
          <header className="border-b">
            <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
                  <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L4 10v8c0 .55.45 1 1 1h1c0-1.1.9-2 2-2s2 .9 2 2h4c0-1.1.9-2 2-2s2 .9 2 2h1c.55 0 1-.45 1-1v-8l-1.08-3.99z"/>
                  <circle cx="8" cy="17" r="1.5"/>
                  <circle cx="16" cy="17" r="1.5"/>
                </svg>
              </div>
              <h1 className="text-2xl font-bold">Lagermodulen</h1>
            </div>
              <div className="flex items-center gap-4">
                <Button variant="outline" onClick={() => setShowSales(false)}>
                  Tillbaka till dashboard
                </Button>
                <span className="text-sm text-muted-foreground">
                  Välkommen {getDisplayName()}
                </span>
                <Button variant="outline" onClick={signOut}>
                  Logga ut
                </Button>
              </div>
            </div>
          </header>
          <main className="container mx-auto px-4 py-8">
            <SalesForm 
              vehicleId={selectedSaleVehicleId} 
              onBack={handleBackToSales}
              onSuccess={handleSalesSuccess}
            />
          </main>
        </div>
      );
    }
    
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
                  <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L4 10v8c0 .55.45 1 1 1h1c0-1.1.9-2 2-2s2 .9 2 2h4c0-1.1.9-2 2-2s2 .9 2 2h1c.55 0 1-.45 1-1v-8l-1.08-3.99z"/>
                  <circle cx="8" cy="17" r="1.5"/>
                  <circle cx="16" cy="17" r="1.5"/>
                </svg>
              </div>
              <h1 className="text-2xl font-bold">Lagermodulen</h1>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => setShowSales(false)}>
                Tillbaka till dashboard
              </Button>
              <span className="text-sm text-muted-foreground">
                Välkommen {getDisplayName()}
              </span>
              <Button variant="outline" onClick={signOut}>
                Logga ut
              </Button>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <SalesList onSellVehicle={handleSellVehicle} />
        </main>
      </div>
    );
  }

  if (showSettings) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
                  <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L4 10v8c0 .55.45 1 1 1h1c0-1.1.9-2 2-2s2 .9 2 2h4c0-1.1.9-2 2-2s2 .9 2 2h1c.55 0 1-.45 1-1v-8l-1.08-3.99z"/>
                  <circle cx="8" cy="17" r="1.5"/>
                  <circle cx="16" cy="17" r="1.5"/>
                </svg>
              </div>
              <h1 className="text-2xl font-bold">Lagermodulen</h1>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => setShowSettings(false)}>
                Tillbaka till dashboard
              </Button>
              <span className="text-sm text-muted-foreground">
                Välkommen {getDisplayName()}
              </span>
              <Button variant="outline" onClick={signOut}>
                Logga ut
              </Button>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Settings onBack={handleBackToSettings} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
                  <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L4 10v8c0 .55.45 1 1 1h1c0-1.1.9-2 2-2s2 .9 2 2h4c0-1.1.9-2 2-2s2 .9 2 2h1c.55 0 1-.45 1-1v-8l-1.08-3.99z"/>
                  <circle cx="8" cy="17" r="1.5"/>
                  <circle cx="16" cy="17" r="1.5"/>
                </svg>
              </div>
              <h1 className="text-2xl font-bold">Lagermodulen</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                <Button onClick={() => setShowPurchaseForm(true)} size="sm">
                  + Inköp
                </Button>
                <Button onClick={() => setShowLogistics(true)} variant="outline" size="sm">
                  Logistik
                </Button>
                <Button onClick={() => setShowSales(true)} variant="outline" size="sm">
                  + Försäljning
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)}>
                  Exportera
                </Button>
              </div>
              <div className="h-6 w-px bg-border"></div>
              <Button variant="outline" onClick={() => setShowSettings(true)} size="sm">
                Inställningar
              </Button>
              <span className="text-sm text-muted-foreground">
                Välkommen {getDisplayName()}
              </span>
              <Button variant="outline" onClick={signOut}>
                Logga ut
              </Button>
            </div>
          </div>
        </header>
      <main className="container mx-auto px-4 py-8">
        <DashboardStats 
          totalStock={stats.totalStock}
          inTransit={stats.inTransit}
          lastSale={stats.lastSale}
        />
        
        <div className="text-center text-muted-foreground">
          <p>Använd knapparna ovan för att hantera ditt fordonslager.</p>
        </div>
      </main>

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
