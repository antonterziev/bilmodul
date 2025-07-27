import { useState, useRef } from "react";
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
  const [verificationCode, setVerificationCode] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const code = verificationCode.join("");
    if (code.length !== 6) {
      toast.error("Ange hela verifieringskoden");
      return;
    }

    setIsVerifying(true);
    
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
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
      // First try the standard resend method
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `https://lagermodulen.se/onboarding`
        }
      });

      if (resendError) {
        console.error("Standard resend failed:", resendError);
        
        // If standard resend fails, try a new signup to trigger the email
        const { error: signupError } = await supabase.auth.signUp({
          email,
          password: crypto.randomUUID(), // Temporary password
          options: {
            emailRedirectTo: `https://lagermodulen.se/onboarding`,
            data: {
              first_name: firstName,
              last_name: lastName,
              full_name: `${firstName} ${lastName}`
            }
          }
        });

        if (signupError && !signupError.message.includes('already registered')) {
          throw signupError;
        }
      }

      toast.success("E-post skickad igen!");
    } catch (error: any) {
      console.error("Resend catch error:", error);
      toast.error("Kunde inte skicka om e-posten");
    } finally {
      setIsResending(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) return; // Only allow single characters
    
    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);
    
    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    
    // Auto-submit when all 6 digits are entered
    if (value && index === 5) {
      const fullCode = [...newCode];
      if (fullCode.every(digit => digit !== "")) {
        // Small delay to allow the UI to update
        setTimeout(() => {
          handleVerifyCode({ preventDefault: () => {} } as React.FormEvent);
        }, 100);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const digits = pastedData.replace(/\D/g, '').slice(0, 6); // Remove non-digits and limit to 6
    
    if (digits.length > 0) {
      const newCode = [...verificationCode];
      
      // Fill the fields with pasted digits
      for (let i = 0; i < 6; i++) {
        newCode[i] = digits[i] || '';
      }
      
      setVerificationCode(newCode);
      
      // Focus the last filled input or the next empty one
      const lastFilledIndex = Math.min(digits.length - 1, 5);
      inputRefs.current[lastFilledIndex]?.focus();
      
      // Auto-submit if all 6 digits are filled
      if (digits.length === 6) {
        setTimeout(() => {
          handleVerifyCode({ preventDefault: () => {} } as React.FormEvent);
        }, 100);
      }
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
                <div className="flex justify-center space-x-2 mb-4">
                  {verificationCode.map((digit, index) => (
                    <Input
                      key={index}
                      ref={(el) => inputRefs.current[index] = el}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={digit}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={handlePaste}
                      className="w-12 h-12 text-center border-gray-300 focus:border-blue-500 focus:ring-blue-500 font-mono text-lg"
                      maxLength={1}
                      autoComplete="off"
                      data-1p-ignore="true"
                      data-dashlane-rid=""
                      data-form-type="other"
                      data-lpignore="true"
                      data-bitwarden-watching="false"
                    />
                  ))}
                </div>
                
                <Button 
                  type="submit" 
                  disabled={isVerifying || verificationCode.join("").length !== 6}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  {isVerifying ? "Verifierar..." : "Fortsätt"}
                </Button>
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