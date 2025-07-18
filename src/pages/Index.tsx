import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user, signOut, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
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
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Lagermodulen</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Välkommen, {user.email}
            </span>
            <Button variant="outline" onClick={signOut}>
              Logga ut
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4">Välkommen till Lagermodulen</h2>
          <p className="text-xl text-muted-foreground">
            Ditt lagerhanterings- och Fortnox-integrationssystem
          </p>
        </div>
      </main>
    </div>
  );
};

export default Index;
