import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SetPassword from "./SetPassword";

interface EmailVerificationProps {
  email: string;
  firstName: string;
  lastName: string;
  onBack: () => void;
}

const EmailVerification = ({ email, firstName, lastName, onBack }: EmailVerificationProps) => {
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!verificationCode.trim()) {
      toast.error("Ange verifieringskoden");
      return;
    }

    setIsVerifying(true);
    
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: verificationCode,
        type: 'signup'
      });

      if (error) {
        toast.error("Felaktig kod. Försök igen.");
        return;
      }

      // Instead of auto-redirecting, show password setup
      setShowSetPassword(true);
    } catch (error: any) {
      toast.error("Ett fel uppstod vid verifiering");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendEmail = async () => {
    setIsResending(true);
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (error) {
        toast.error("Kunde inte skicka om e-posten");
        return;
      }

      toast.success("E-post skickad igen!");
    } catch (error: any) {
      toast.error("Ett fel uppstod");
    } finally {
      setIsResending(false);
    }
  };

  const handleBackFromSetPassword = () => {
    setShowSetPassword(false);
  };

  // Show password setup after successful verification
  if (showSetPassword) {
    return (
      <SetPassword 
        email={email}
        firstName={firstName}
        lastName={lastName}
        onBack={handleBackFromSetPassword}
      />
    );
  }

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
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Kolla din mejl!</h2>
              <p className="text-gray-600 text-sm mb-6">
                Vi har skickat ett mail till <strong>{email}</strong>. Öppna det och 
                klicka på länken för att bekräfta din e-post.
              </p>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-600 text-sm text-center mb-4">
                Alternativt ange den sexsiffriga koden i samma mail:
              </p>
              
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div className="flex space-x-2">
                  <Input
                    type="text"
                    placeholder="Kod"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-center"
                    maxLength={6}
                    autoComplete="one-time-code"
                    data-1p-ignore="true"
                    data-dashlane-rid=""
                  />
                  <Button 
                    type="submit" 
                    disabled={isVerifying}
                    className="h-12 bg-blue-600 hover:bg-blue-700 text-white px-6"
                  >
                    {isVerifying ? "Verifierar..." : "Fortsätt"}
                  </Button>
                </div>
              </form>
            </div>
            
            <div className="text-center space-y-4">
              <div>
                <p className="text-gray-600 text-sm mb-2">Har du inte fått något mail?</p>
                <button
                  type="button"
                  onClick={handleResendEmail}
                  disabled={isResending}
                  className="text-blue-600 text-sm hover:underline"
                >
                  {isResending ? "Skickar..." : "Skicka igen"}
                </button>
              </div>
              
              <button
                type="button"
                onClick={onBack}
                className="text-gray-600 text-sm hover:underline"
              >
                Tillbaka till registrering
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmailVerification;