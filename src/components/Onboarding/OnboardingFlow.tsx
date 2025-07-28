import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

interface OnboardingFlowProps {
  email: string;
  firstName: string;
  lastName: string;
}

const OnboardingFlow = ({ email, firstName, lastName }: OnboardingFlowProps) => {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userFirstName, setUserFirstName] = useState(firstName);
  const [userLastName, setUserLastName] = useState(lastName);
  
  // Check if this is an invitation flow (no firstName/lastName provided)
  const isInvitation = !firstName && !lastName;

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 8) {
      toast.error("Lösenordet måste vara minst 8 tecken");
      return;
    }

    if (isInvitation && (!userFirstName.trim() || !userLastName.trim())) {
      toast.error("Vänligen fyll i ditt för- och efternamn");
      return;
    }

    setIsLoading(true);
    
    try {
      // Use entered names for invitations, otherwise use provided names
      const finalFirstName = isInvitation ? userFirstName.trim() : firstName;
      const finalLastName = isInvitation ? userLastName.trim() : lastName;
      
      if (isInvitation) {
        // For invitations, create a new user account
        const { data, error } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              first_name: finalFirstName,
              last_name: finalLastName,
              full_name: `${finalFirstName} ${finalLastName}`,
              onboarding_completed: true
            }
          }
        });

        if (error) {
          console.error("Signup error:", error);
          toast.error("Kunde inte skapa konto: " + error.message);
          return;
        }

        // For invitations, we'll still need email confirmation unless admin disables it
        if (data.user && !data.user.email_confirmed_at) {
          toast.success("Konto skapat! Kontrollera din e-post för att verifiera ditt konto.");
        } else {
          toast.success("Välkommen! Ditt konto har skapats.");
          window.location.href = "/dashboard";
        }
      } else {
        // For existing users, update their password and mark onboarding as completed
        const { error } = await supabase.auth.updateUser({
          password: password,
          data: {
            first_name: finalFirstName,
            last_name: finalLastName,
            full_name: `${finalFirstName} ${finalLastName}`,
            email: email,
            onboarding_completed: true
          }
        });

        if (error) {
          toast.error("Kunde inte ställa in lösenord");
          return;
        }

        toast.success("Välkommen! Ditt konto är nu klart.");
        window.location.href = "/dashboard";
      }
    } catch (error: any) {
      toast.error("Ett fel uppstod");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {/* Brand Logo */}
          <div className="mb-8">
            <img src="/lovable-uploads/057dc8b8-62ce-4b36-b42f-7cda0b9a01d1.png" alt="Veksla" className="h-16 mx-auto" />
          </div>
        </div>
        
        <Card className="shadow-lg border-0">
          <CardContent className="p-8">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {isInvitation ? "Välkommen!" : `Tack ${firstName}, din e-post är verifierad!`}
              </h2>
              <p className="text-gray-600 text-sm mb-8">
                {isInvitation 
                  ? "Fyll i dina uppgifter och välj ett starkt lösenord för att skapa ditt konto:"
                  : "Välj nu ett starkt lösenord till ditt nya konto:"
                }
              </p>
              
              <form onSubmit={handlePasswordSubmit} className="space-y-6">
                {isInvitation && (
                  <>
                    <div className="flex gap-3">
                      <Input
                        type="text"
                        placeholder="Förnamn"
                        value={userFirstName}
                        onChange={(e) => setUserFirstName(e.target.value)}
                        className="h-12"
                        required
                      />
                      <Input
                        type="text"
                        placeholder="Efternamn"
                        value={userLastName}
                        onChange={(e) => setUserLastName(e.target.value)}
                        className="h-12"
                        required
                      />
                    </div>
                  </>
                )}
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Minst 8 tecken"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pr-10"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                
                <Button 
                  type="submit" 
                  disabled={isLoading || password.length < 8}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isLoading ? "Slutför..." : "Skapa konto"}
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OnboardingFlow;