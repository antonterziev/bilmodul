import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      }
    };
    
    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName,
            company_name: companyName,
          },
        },
      });

      if (error) throw error;

      toast({
        title: "Registrering lyckades!",
        description: "Kontrollera din e-post för att bekräfta ditt konto.",
      });
    } catch (error: any) {
      toast({
        title: "Fel vid registrering",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      navigate("/");
    } catch (error: any) {
      toast({
        title: "Fel vid inloggning",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast({
        title: "E-post krävs",
        description: "Ange din e-postadress för att återställa lösenordet.",
        variant: "destructive",
      });
      return;
    }

    setIsResettingPassword(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      });

      if (error) throw error;

      toast({
        title: "E-post skickad!",
        description: "Kontrollera din e-post för instruktioner om hur du återställer ditt lösenord.",
      });
    } catch (error: any) {
      toast({
        title: "Fel vid återställning",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        {/* Brand Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-600 mb-8">Lagermodulen</h1>
        </div>
        
        <Card className="shadow-lg border-0">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Välkommen!</h2>
              <p className="text-gray-600">Ange ditt lösenord för att gå vidare</p>
            </div>
            
            <div className="space-y-4">
              {/* Email field with change button */}
              <div className="flex items-center gap-2 p-3 bg-gray-100 rounded border">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-transparent border-0 outline-none text-gray-900"
                  placeholder="din.email@example.com"
                />
                <Button variant="link" className="text-blue-600 text-sm p-0 h-auto">
                  Ändra
                </Button>
              </div>
              
              {/* Password field */}
              <div className="space-y-1">
                <Label htmlFor="password" className="text-sm text-gray-700">Lösenord</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              
              {/* Forgot password link */}
              <div className="text-left">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isResettingPassword}
                  className="text-blue-600 text-sm hover:underline disabled:opacity-50"
                >
                  {isResettingPassword ? "Skickar e-post..." : "Glömt lösenord?"}
                </button>
              </div>
              
              {/* Login button */}
              <Button 
                onClick={handleSignIn}
                disabled={isLoading}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                {isLoading ? "Loggar in..." : "Logga in"}
              </Button>
            </div>
            
            {/* Sign up link */}
            <div className="text-center mt-6">
              <span className="text-gray-600 text-sm">Har du inget konto? </span>
              <button
                type="button"
                onClick={() => {
                  // Toggle to signup mode - we'll implement this as a simple toggle
                  toast({
                    title: "Registrering",
                    description: "Kontakta administratören för att skapa ett konto.",
                  });
                }}
                className="text-blue-600 text-sm hover:underline"
              >
                Skapa konto
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;