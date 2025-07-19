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
  const [currentStep, setCurrentStep] = useState(1);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);

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

      // Move to next step
      setCurrentStep(2);
    } catch (error: any) {
      toast.error("Ett fel uppstod");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanySearch = async () => {
    if (!companySearch.trim()) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`https://foretagsinfo.bolagsverket.se/sok-foretagsinformation-web/foretag?sokord=${encodeURIComponent(companySearch)}`);
      const html = await response.text();
      
      // Simple parsing - in a real app you'd want more robust parsing
      const companies: any[] = [];
      const regex = /<div class="hit-item[^"]*"[^>]*>[\s\S]*?<h3[^>]*>(.*?)<\/h3>[\s\S]*?<span[^>]*>(\d{6}-\d{4})<\/span>/g;
      let match;
      
      while ((match = regex.exec(html)) !== null && companies.length < 6) {
        companies.push({
          name: match[1].replace(/<[^>]*>/g, '').trim(),
          orgNumber: match[2]
        });
      }
      
      setSearchResults(companies);
    } catch (error) {
      toast.error("Kunde inte söka företag");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    setIsLoading(true);
    
    try {
      // Mark onboarding as completed and save company info
      const userData: any = { onboarding_completed: true };
      if (selectedCompany) {
        userData.company_name = selectedCompany.name;
        userData.org_number = selectedCompany.orgNumber;
      }

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
        Lägg till ditt företag
      </h2>
      <p className="text-gray-600 text-sm mb-6 text-center">
        Vi hämtar dina företagsuppgifter från Bolagsverket.
      </p>
      
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Organisationsnummer eller företagsnamn"
            value={companySearch}
            onChange={(e) => setCompanySearch(e.target.value)}
            className="flex-1"
            onKeyPress={(e) => e.key === 'Enter' && handleCompanySearch()}
          />
          <Button 
            onClick={handleCompanySearch}
            disabled={isLoading || !companySearch.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6"
          >
            {isLoading ? "Söker..." : "Hitta företag"}
          </Button>
        </div>

        {searchResults.length > 0 && (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            <p className="text-sm text-gray-600">{searchResults.length} hittade</p>
            {searchResults.map((company, index) => (
              <div 
                key={index}
                onClick={() => setSelectedCompany(company)}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedCompany?.orgNumber === company.orgNumber 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <h3 className="font-medium text-gray-900">{company.name}</h3>
                <p className="text-sm text-gray-600">{company.orgNumber}</p>
              </div>
            ))}
          </div>
        )}

        {selectedCompany && (
          <Button 
            onClick={() => setCurrentStep(3)}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white mt-6"
          >
            Fortsätt med {selectedCompany.name}
          </Button>
        )}

        <div className="text-center mt-4">
          <button 
            onClick={() => setCurrentStep(3)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Kunde du inte hitta ditt företag? Inga problem, du kan{" "}
            <span className="text-blue-600 hover:underline">
              fortsätta utan att hämta dina uppgifter
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="text-center">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">
        Nästan klar!
      </h2>
      <p className="text-gray-600 text-sm mb-8">
        Du är nu redo att använda Veksla.
      </p>
      
      <Button 
        onClick={() => setCurrentStep(4)}
        className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white"
      >
        Fortsätt
      </Button>
    </div>
  );

  const renderStep4 = () => (
    <div className="text-center">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">
        Klart!
      </h2>
      <p className="text-gray-600 text-sm mb-8">
        Ditt konto är nu konfigurerat och redo att användas.
      </p>
      
      <Button 
        onClick={handleCompleteOnboarding}
        disabled={isLoading}
        className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white"
      >
        {isLoading ? "Slutför..." : "Gå till Dashboard"}
      </Button>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      default: return renderStep1();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        {/* Step indicator */}
        <div className="text-center mb-8">
          <p className="text-gray-500 text-sm mb-4">Steg {currentStep} av 4</p>
          
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