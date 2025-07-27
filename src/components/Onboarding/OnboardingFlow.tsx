import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

interface OnboardingFlowProps {
  email: string;
  firstName: string;
  lastName: string;
}

const OnboardingFlow = ({ email, firstName, lastName }: OnboardingFlowProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [orgNumber, setOrgNumber] = useState("");
  const [companyType, setCompanyType] = useState("Aktiebolag");

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 8) {
      toast.error("Lösenordet måste vara minst 8 tecken");
      return;
    }

    setIsLoading(true);
    
    try {
      // Update the user's password and user metadata
      const { error } = await supabase.auth.updateUser({
        password: password,
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`,
          email: email,
          onboarding_completed: false
        }
      });

      if (error) {
        toast.error("Kunde inte ställa in lösenord");
        return;
      }

      // Move to next step (step 2, which is now company info)
      setCurrentStep(2);
    } catch (error: any) {
      toast.error("Ett fel uppstod");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    setIsLoading(true);
    
    try {
      // Mark onboarding as completed and save company info
      const userData: any = { 
        onboarding_completed: true,
        company_name: companyName,
        org_number: orgNumber,
        company_type: companyType
      };

      const { error } = await supabase.auth.updateUser({
        data: userData
      });
      
      if (error) {
        toast.error("Kunde inte slutföra registrering");
        return;
      }
      
      toast.success("Välkommen! Ditt konto är nu klart.");
      window.location.href = "/dashboard";
    } catch (error: any) {
      toast.error("Ett fel uppstod");
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="text-center">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">
        Tack {firstName}, din e-post är verifierad!
      </h2>
      <p className="text-gray-600 text-sm mb-8">
        Välj nu ett starkt lösenord till ditt nya konto:
      </p>
      
      <form onSubmit={handlePasswordSubmit} className="space-y-6">
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
          {isLoading ? "Fortsätter..." : "Fortsätt"}
        </Button>
      </form>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <h2 className="text-2xl font-semibold text-gray-900 mb-4 text-center">
        Företagsinformation
      </h2>
      <p className="text-gray-600 text-sm mb-6 text-center">
        Fyll i din företagsinformation. Du kan alltid ändra detta senare under inställningar.
      </p>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="companyName" className="text-sm text-gray-700">
            Företagsnamn
          </Label>
          <Input
            id="companyName"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Ange företagsnamn"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="orgNumber" className="text-sm text-gray-700">
            Organisationsnummer
          </Label>
          <Input
            id="orgNumber"
            type="text"
            value={orgNumber}
            onChange={(e) => setOrgNumber(e.target.value)}
            placeholder="XXXXXX-XXXX"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="companyType" className="text-sm text-gray-700">
            Företagstyp
          </Label>
          <Select value={companyType} onValueChange={setCompanyType}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white border border-gray-200 shadow-lg z-50">
              <SelectItem value="Aktiebolag">Aktiebolag</SelectItem>
              <SelectItem value="Ekonomisk förening">Ekonomisk förening</SelectItem>
              <SelectItem value="Kommanditbolag">Kommanditbolag</SelectItem>
              <SelectItem value="Enskild firma">Enskild firma</SelectItem>
              <SelectItem value="Handelsbolag">Handelsbolag</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-3 pt-4">
          <Button 
            variant="outline"
            onClick={() => setCurrentStep(1)}
            className="flex-1"
          >
            Gå tillbaka
          </Button>
          <Button 
            onClick={handleCompleteOnboarding}
            disabled={isLoading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? "Slutför..." : "Klar"}
          </Button>
        </div>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      default: return renderStep1();
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
            {renderCurrentStep()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OnboardingFlow;