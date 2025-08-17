import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff } from "lucide-react";

interface SetPasswordProps {
  email: string;
  firstName: string;
  lastName: string;
  onBack: () => void;
}

const SetPassword = ({ email, firstName, lastName, onBack }: SetPasswordProps) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isPasswordValid = password.length >= 8;
  const doPasswordsMatch = password === confirmPassword;
  const canSubmit = isPasswordValid && doPasswordsMatch && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canSubmit) return;
    
    setIsLoading(true);

    try {
      // Create the user account with the provided password
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      });

      if (error) throw error;

      toast({
        title: "Konto skapat!",
        description: "Ditt konto har skapats framgångsrikt. Du loggas in automatiskt.",
      });

      // The auth state change will handle the redirect
    } catch (error: any) {
      toast({
        title: "Fel vid kontoskapande",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        {/* Brand Logo */}
        <div className="text-center mb-8">
          <img src="/lovable-uploads/057dc8b8-62ce-4b36-b42f-7cda0b9a01d1.png" alt="Bilmodul" className="h-16 mx-auto mb-8" />
        </div>
        
        <Card className="shadow-lg border-0">
          <CardContent className="p-8">
            {/* Step indicator */}
            <div className="text-center mb-6">
              <p className="text-sm text-gray-500 mb-4">Steg 3 av 4</p>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Tack {firstName}, din e-post är verifierad!
              </h2>
              <p className="text-gray-600 text-sm">
                Välj nu ett starkt lösenord till ditt nya konto:
              </p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4" onKeyDown={(e) => {
              if (e.key === 'Enter' && canSubmit && !isLoading) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Lösenord</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 pr-10"
                    placeholder="Minst 8 tecken"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {password.length > 0 && !isPasswordValid && (
                  <p className="text-red-500 text-xs">Lösenordet måste vara minst 8 tecken långt</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">Bekräfta lösenord</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 pr-10"
                    placeholder="Ange lösenordet igen"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {confirmPassword.length > 0 && !doPasswordsMatch && (
                  <p className="text-red-500 text-xs">Lösenorden matchar inte</p>
                )}
              </div>
              
              <Button 
                type="submit"
                disabled={isLoading || !canSubmit}
                className={`w-full h-12 text-white font-medium transition-colors ${
                  canSubmit 
                    ? "bg-blue-600 hover:bg-blue-700" 
                    : "bg-gray-300 cursor-not-allowed"
                }`}
              >
                {isLoading ? "Skapar konto..." : "Fortsätt"}
              </Button>
            </form>
            
            {/* Back to verification */}
            <div className="text-center mt-6">
              <button
                type="button"
                onClick={onBack}
                className="text-blue-600 text-sm hover:underline"
              >
                Tillbaka till verifiering
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SetPassword;