import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

const PasswordReset = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error("Lösenorden matchar inte");
      return;
    }

    if (password.length < 6) {
      toast.error("Lösenordet måste vara minst 6 tecken");
      return;
    }

    setIsLoading(true);
    
    try {
      // First, verify the session from URL params if available
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');
      
      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          toast.error("Ogiltiga återställningsuppgifter");
          return;
        }
      }

      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        console.error("Password reset error:", error);
        toast.error(error.message);
        return;
      }

      // Get the current session after password update
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error("No session after password update");
        toast.error("Session saknas efter lösenordsuppdatering");
        return;
      }

      toast.success("Lösenordet har uppdaterats!");
      
      // Force a page refresh to ensure clean auth state
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
      
    } catch (error: any) {
      console.error("Password reset error:", error);
      toast.error("Ett fel uppstod vid uppdatering av lösenord");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        {/* Brand Logo */}
        <div className="text-center mb-8">
          <img src="/lovable-uploads/057dc8b8-62ce-4b36-b42f-7cda0b9a01d1.png" alt="Veksla" className="h-16 mx-auto mb-8" />
        </div>
        
        <Card className="shadow-lg border-0">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Återställ lösenord</h2>
              <p className="text-gray-600 text-sm">
                Ange ditt nya lösenord nedan
              </p>
            </div>
            
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <Input
                type="password"
                placeholder="Nytt lösenord"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-center"
                required
                minLength={6}
              />
              <Input
                type="password"
                placeholder="Bekräfta nytt lösenord"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-center"
                required
                minLength={6}
              />
              <Button 
                type="submit" 
                disabled={isLoading}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                {isLoading ? "Uppdaterar..." : "Uppdatera lösenord"}
              </Button>
            </form>
            
            {/* Back to login */}
            <div className="text-center mt-6">
              <button
                type="button"
                onClick={() => navigate("/auth")}
                className="text-blue-600 text-sm hover:underline"
              >
                Tillbaka till inloggning
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PasswordReset;