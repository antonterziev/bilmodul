import { useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AdminDashboard } from "@/components/Admin/AdminDashboard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Admin = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login-or-signup");
    }
  }, [user, isLoading, navigate]);

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
    return <Navigate to="/login-or-signup" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Tillbaka till dashboard
          </Button>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        <AdminDashboard onBack={() => navigate("/dashboard")} />
      </main>
    </div>
  );
};

export default Admin;
