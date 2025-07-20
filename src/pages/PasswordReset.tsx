
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

const PasswordReset = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidatingSession, setIsValidatingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    console.log("PasswordReset: Component mounted");
    console.log("URL parameters:", Object.fromEntries(searchParams.entries()));

    const validateSession = async () => {
      try {
        // Get URL parameters
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type');
        const accessToken = searchParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token');

        console.log("URL tokens:", { 
          tokenHash: !!tokenHash, 
          type, 
          accessToken: !!accessToken, 
          refreshToken: !!refreshToken 
        });

        // Set up auth state change listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log("Auth state change:", event, !!session);
          
          if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session && type === 'recovery')) {
            console.log("Valid auth state for password reset");
            setHasValidSession(true);
            setIsValidatingSession(false);
          } else if (event === 'SIGNED_OUT') {
            console.log("User signed out during password reset");
            setHasValidSession(false);
            toast.error("Sessionen har upphört. Begär en ny återställningslänk.");
            navigate("/login-or-signup");
          }
        });

        // Handle different token scenarios
        if (tokenHash && type === 'recovery') {
          console.log("Processing recovery token from URL");
          
          // Try to exchange the token for a session
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery'
          });
          
          if (error) {
            console.error("Token verification error:", error);
            toast.error("Ogiltig eller utgången återställningslänk");
            navigate("/login-or-signup");
            return;
          }
          
          if (data.session) {
            console.log("Session established from recovery token");
            setHasValidSession(true);
            setIsValidatingSession(false);
          }
        } else if (accessToken && refreshToken && type === 'recovery') {
          console.log("Setting session from URL tokens");
          
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (error) {
            console.error("Session error:", error);
            toast.error("Ogiltig eller utgången återställningslänk");
            navigate("/login-or-signup");
            return;
          }
          
          if (data.session) {
            console.log("Session set successfully from URL tokens");
            setHasValidSession(true);
            setIsValidatingSession(false);
          }
        } else {
          // Check if there's already a valid session
          const { data: { session } } = await supabase.auth.getSession();
          console.log("Checking existing session:", !!session);
          
          if (session) {
            console.log("Found existing valid session");
            setHasValidSession(true);
            setIsValidatingSession(false);
          } else {
            // No session and no recovery tokens - redirect to login
            console.log("No session or recovery tokens found");
            toast.error("Du måste använda en giltig återställningslänk");
            navigate("/login-or-signup");
          }
        }

        // Cleanup subscription after 30 seconds to prevent memory leaks
        setTimeout(() => {
          subscription.unsubscribe();
        }, 30000);

      } catch (error) {
        console.error("Session validation error:", error);
        toast.error("Ett fel uppstod vid validering av återställningslänk");
        navigate("/login-or-signup");
      }
    };

    validateSession();
  }, [searchParams, navigate]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error("Lösenorden matchar inte");
      return;
    }

    if (password.length < 6) {
      toast.error("Lösenordet måste vara minst 6 tecken");
      return;
    }

    if (!hasValidSession) {
      toast.error("Sessionen har upphört. Begär en ny återställningslänk.");
      navigate("/login-or-signup");
      return;
    }

    setIsLoading(true);
    
    try {
      console.log("Attempting to update password");
      
      // Verify we still have a valid session before updating
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error("No active session found");
        toast.error("Sessionen har upphört. Begär en ny återställningslänk.");
        navigate("/login-or-signup");
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        console.error("Password reset error:", error);
        if (error.message.includes('session_not_found')) {
          toast.error("Sessionen har upphört. Begär en ny återställningslänk.");
          navigate("/login-or-signup");
        } else {
          toast.error("Ett fel uppstod: " + error.message);
        }
        return;
      }

      console.log("Password updated successfully");
      toast.success("Lösenordet har uppdaterats!");
      
      // Navigate to dashboard after successful password update
      setTimeout(() => {
        navigate("/dashboard");
      }, 1000);
      
    } catch (error: any) {
      console.error("Password reset error:", error);
      toast.error("Ett fel uppstod vid uppdatering av lösenord");
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while validating session
  if (isValidatingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <img src="/lovable-uploads/057dc8b8-62ce-4b36-b42f-7cda0b9a01d1.png" alt="Veksla" className="h-16 mx-auto mb-4" />
          <p className="text-gray-600">Validerar återställningslänk...</p>
          <div className="mt-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        </div>
      </div>
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
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Återställ lösenord</h2>
               <p className="text-gray-600 text-sm">
                 Ange ditt nya lösenord nedan. Minst 6 tecken.
               </p>
            </div>
            
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Nytt lösenord"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-center pr-10"
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Bekräfta nytt lösenord"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-center pr-10"
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <Button 
                type="submit" 
                disabled={isLoading || !hasValidSession}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                {isLoading ? "Uppdaterar..." : "Uppdatera lösenord"}
              </Button>
            </form>
            
            {/* Back to login */}
            <div className="text-center mt-6">
              <button
                type="button"
                onClick={() => navigate("/login-or-signup")}
                className="text-blue-600 text-sm hover:underline"
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

export default PasswordReset;
