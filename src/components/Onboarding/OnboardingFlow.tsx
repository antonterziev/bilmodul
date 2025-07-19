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

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 8) {
      toast.error("Lösenordet måste vara minst 8 tecken");
      return;
    }

    setIsLoading(true);
    
    try {
      // Update the user's password
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

      // Move to next step or complete onboarding
      if (currentStep < 4) {
        setCurrentStep(currentStep + 1);
      } else {
        // Complete onboarding
        await supabase.auth.updateUser({
          data: { onboarding_completed: true }
        });
        
        toast.success("Välkommen! Ditt konto är nu klart.");
        window.location.href = "/dashboard";
      }
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
    <div className="text-center">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">
        Välkommen till Veksla!
      </h2>
      <p className="text-gray-600 text-sm mb-8">
        Låt oss komma igång med att konfigurera ditt konto.
      </p>
      
      <Button 
        onClick={() => setCurrentStep(3)}
        className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white"
      >
        Fortsätt
      </Button>
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
        onClick={handlePasswordSubmit}
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