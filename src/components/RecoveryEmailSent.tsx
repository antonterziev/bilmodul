import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mail } from "lucide-react";

interface RecoveryEmailSentProps {
  email: string;
  onBack: () => void;
  onResend: () => void;
  isResending?: boolean;
}

const RecoveryEmailSent = ({ email, onBack, onResend, isResending = false }: RecoveryEmailSentProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        {/* Brand Logo */}
        <div className="text-center mb-8">
          <img src="/lovable-uploads/057dc8b8-62ce-4b36-b42f-7cda0b9a01d1.png" alt="Veksla" className="h-16 mx-auto mb-8" />
        </div>
        
        <Card className="shadow-lg border-0 bg-white">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              {/* Mail icon */}
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Mail className="h-8 w-8 text-blue-600" />
              </div>
              
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Kolla din mejl!</h2>
              <p className="text-gray-600 text-sm mb-4">
                Vi har skickat ett mejl till <strong className="text-gray-900">{email}</strong>. Öppna 
                det och klicka på länken i mejlet för att återställa ditt lösenord för att bekräfta din 
                e-post och gå vidare.
              </p>
            </div>
            
            <div className="text-center space-y-4">
              <div>
                <p className="text-gray-600 text-sm mb-2">Har du inte fått något mejl?</p>
                <button
                  type="button"
                  onClick={onResend}
                  disabled={isResending}
                  className="text-blue-600 text-sm hover:underline font-medium"
                >
                  {isResending ? "Skickar igen..." : "Skicka igen"}
                </button>
              </div>
              
              <button
                type="button"
                onClick={onBack}
                className="text-gray-600 text-sm hover:underline"
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

export default RecoveryEmailSent;