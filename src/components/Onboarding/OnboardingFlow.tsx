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
  const [companySearch, setCompanySearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
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
      // Check if input is an organization number (format: XXXXXX-XXXX)
      const orgNumberRegex = /^\d{6}-?\d{4}$/;
      const isOrgNumber = orgNumberRegex.test(companySearch.replace('-', ''));
      
      console.log('Searching for:', companySearch);
      
      // Call our edge function to scrape company data
      const { data, error } = await supabase.functions.invoke('scrape-company-info', {
        body: { searchTerm: companySearch }
      });
      
      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to search companies');
      }
      
      const companies = data?.companies || [];
      console.log('Companies received:', companies);
      
      setSearchResults(companies);
      
      // If exact organization number is found and there's only one result, auto-select and proceed
      if (isOrgNumber && companies.length === 1) {
        setSelectedCompany(companies[0]);
        toast.success(`Företag hittades: ${companies[0].name}`);
        setTimeout(() => setCurrentStep(3), 1000);
        return;
      }
      
      if (companies.length === 0) {
        toast.error("Inga företag hittades. Försök med ett annat sökord.");
      } else {
        // Auto-select the first (top) result
        setSelectedCompany(companies[0]);
        toast.success(`${companies.length} företag hittades. ${companies[0].name} valdes automatiskt.`);
      }
      
    } catch (error) {
      console.error('Search error:', error);
      toast.error("Kunde inte söka företag. Försök igen eller kontakta support.");
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
        userData.phone_number = phoneNumber;
        userData.company_type = companyType;
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
            placeholder="Org.nr eller företagsnamn"
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
                <h3 className="font-medium text-gray-900">{company.name.length > 40 ? `${company.name.substring(0, 40)}...` : company.name}</h3>
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
    <div>
      <h2 className="text-2xl font-semibold text-gray-900 mb-4 text-center">
        Bra, detta var vad vi hittade
      </h2>
      <p className="text-gray-600 text-sm mb-6 text-center">
        Du kan alltid ändra detta senare under inställningar.
      </p>
      
      <div className="space-y-4">
        <p className="text-red-600 text-sm">* Obligatorisk information</p>
        
        <div>
          <Label htmlFor="orgNumber" className="text-sm text-gray-700">
            Organisationsnummer *
          </Label>
          <Input
            id="orgNumber"
            type="text"
            value={selectedCompany?.orgNumber || ""}
            disabled
            className="mt-1 bg-gray-100"
          />
        </div>

        <div>
          <Label htmlFor="companyName" className="text-sm text-gray-700">
            Företagsnamn *
          </Label>
          <Input
            id="companyName"
            type="text"
            value={selectedCompany?.name || ""}
            disabled
            className="mt-1 bg-gray-100"
          />
        </div>

        <div>
          <Label htmlFor="companyType" className="text-sm text-gray-700">
            Företagstyp *
          </Label>
          <Select value={companyType} onValueChange={setCompanyType}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white border border-gray-200 shadow-lg z-50">
              <SelectItem value="Aktiebolag">Aktiebolag</SelectItem>
              <SelectItem value="Ekonomisk förening">Ekonomisk förening</SelectItem>
              <SelectItem value="Kommanditbolag">Kommanditbolag</SelectItem>
              <SelectItem value="Enskildfirma">Enskildfirma</SelectItem>
              <SelectItem value="Handelsbolag">Handelsbolag</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="phoneNumber" className="text-sm text-gray-700">
            Telefon *
          </Label>
          <Input
            id="phoneNumber"
            type="tel"
            placeholder="0701234567"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="mt-1"
            required
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button 
            variant="outline"
            onClick={() => setCurrentStep(2)}
            className="flex-1"
          >
            Gå tillbaka
          </Button>
          <Button 
            onClick={() => setCurrentStep(4)}
            disabled={!phoneNumber.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Fortsätt
          </Button>
        </div>
      </div>
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