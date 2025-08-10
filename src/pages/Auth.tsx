import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

import RecoveryEmailSent from "@/components/RecoveryEmailSent";
import { Eye, EyeOff } from "lucide-react";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isWordVisible, setIsWordVisible] = useState(true);
  const words = ["ekonomiöversikt", "lagerhantering", "lagerfinansiering", "säljstödsystem", "avtalshantering", "rapportering"];
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showPasswordStep, setShowPasswordStep] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [showEmailExists, setShowEmailExists] = useState(false);
  const [showRecoveryEmailSent, setShowRecoveryEmailSent] = useState(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);
  const [loginError, setLoginError] = useState("");
  const navigate = useNavigate();
  
  // Force reset function for debugging
  const forceReset = () => {
    // Clear all auth-related storage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
    Object.keys(sessionStorage || {}).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        sessionStorage.removeItem(key);
      }
    });
    // Force sign out
    supabase.auth.signOut({ scope: 'global' });
    // Reload page
    window.location.reload();
  };
  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Check if onboarding is completed
        const hasCompletedOnboarding = session.user.user_metadata?.onboarding_completed;
        if (!hasCompletedOnboarding) {
          navigate("/onboarding");
        } else {
          navigate("/dashboard");
        }
      }
    };
    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        // Check if onboarding is completed
        const hasCompletedOnboarding = session.user.user_metadata?.onboarding_completed;
        if (!hasCompletedOnboarding) {
          navigate("/onboarding");
        } else {
          navigate("/dashboard");
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Word cycling animation effect
  useEffect(() => {
    const interval = setInterval(() => {
      setIsWordVisible(false);
      setTimeout(() => {
        setCurrentWordIndex(prevIndex => (prevIndex + 1) % words.length);
        setIsWordVisible(true);
      }, 300); // Fade out duration
    }, 2000); // Change word every 2 seconds

    return () => clearInterval(interval);
  }, [words.length]);
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) {
      toast({
        title: "Acceptera villkor",
        description: "Du måste acceptera villkoren för att fortsätta.",
        variant: "destructive"
      });
      return;
    }
    setIsLoading(true);
    try {
      // First check if email already exists
      const {
        data: existingProfile
      } = await supabase.from('profiles').select('email').eq('email', email).maybeSingle();
      if (existingProfile) {
        setShowEmailExists(true);
        setIsLoading(false);
        return;
      }

      // Create account directly without email verification
      const { data, error } = await supabase.auth.signUp({
        email,
        password: crypto.randomUUID(), // Temporary password
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`
          }
        }
      });
      if (error) {
        if (error.message.includes('already registered')) {
          setShowEmailExists(true);
        } else {
          throw error;
        }
        return;
      }
      
      // Navigate directly to onboarding after successful signup
      navigate("/onboarding");
    } catch (error: any) {
      toast({
        title: "Fel vid registrering",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  const handleLoginFromEmailExists = () => {
    setShowEmailExists(false);
    setIsSignup(false);
    setShowPasswordStep(true);
  };
  const handleCreateNewAccountFromEmailExists = () => {
    setShowEmailExists(false);
    // Clear entire form
    setEmail("");
    setPassword("");
    setFirstName("");
    setLastName("");
    setAcceptedTerms(false);
  };
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError(""); // Clear previous errors
    
    console.log("Attempting login with email:", email);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.error("Login error:", error);
        throw error;
      }
      
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Sign in failed:", error);
      if (error.message.includes('Invalid login credentials')) {
        setLoginError("Felaktigt e-post eller lösenord");
      } else if (error.message.includes('Email not confirmed')) {
        setLoginError("Du måste verifiera din e-post först");
      } else {
        setLoginError("Ett fel uppstod vid inloggning: " + error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };
  const handleForgotPassword = async (resetEmail?: string, isResend = false) => {
    const emailToUse = resetEmail || email;
    if (!emailToUse.trim()) {
      toast({
        title: "E-post krävs",
        description: "Ange din e-postadress för att återställa lösenordet.",
        variant: "destructive"
      });
      return;
    }
    setIsResettingPassword(true);
    try {
      console.log("Sending password reset email to:", emailToUse);
      
      // Send password reset email - Use the correct redirect URL
      const { error } = await supabase.auth.resetPasswordForEmail(emailToUse, {
        redirectTo: "https://bilmodul.se/password-reset"
      });
      
      if (error) {
        console.error("Password reset error:", error);
        throw error;
      }
      
      console.log("Password reset email sent successfully");
      
      if (isResend) {
        // Show success message for resend
        setEmailSentSuccess(true);
        setTimeout(() => {
          setEmailSentSuccess(false);
        }, 2000); // Show success for 2 seconds
      } else {
        // Show the recovery email sent screen for first time
        setShowRecoveryEmailSent(true);
        setShowForgotPassword(false);
      }
    } catch (error: any) {
      console.error("Password reset failed:", error);
      toast({
        title: "Fel vid återställning",
        description: "Något gick fel. Försök igen senare.",
        variant: "destructive"
      });
    } finally {
      setIsResettingPassword(false);
    }
  };
  const handleEmailContinue = async () => {
    if (email.trim()) {
      setIsLoading(true);
      try {
        // Try to sign in with a temporary password to check if user exists
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: 'temp-check-password-that-will-fail'
        });
        
        // If error is "Invalid login credentials", user exists but wrong password
        // If error is "Invalid login credentials" or similar, user exists
        if (error && error.message.includes('Invalid login credentials')) {
          // User exists, go to password step
          setShowPasswordStep(true);
        } else if (error && (error.message.includes('Email not confirmed') || error.message.includes('not found'))) {
          // User doesn't exist or email not confirmed
          toast({
            title: "E-postadressen finns inte",
            description: "Det finns inget konto med denna e-postadress. Skapa ett nytt konto istället.",
            variant: "destructive"
          });
        } else {
          // Any other error, assume user exists and go to password step
          setShowPasswordStep(true);
        }
      } catch (error: any) {
        // On any network error, just proceed to password step
        setShowPasswordStep(true);
      } finally {
        setIsLoading(false);
      }
    }
  };
  const handleBackToEmail = () => {
    setShowPasswordStep(false);
    setPassword("");
    setLoginError(""); // Clear error when going back
  };

  // Initialize resetEmail when showing forgot password form
  useEffect(() => {
    if (showForgotPassword) {
      setResetEmail(email);
    }
  }, [showForgotPassword, email]);

  // Recovery email sent screen
  if (showRecoveryEmailSent) {
    return <RecoveryEmailSent 
      email={resetEmail} 
      onBack={() => {
        setShowRecoveryEmailSent(false);
        setShowForgotPassword(false);
      }}
      onResend={() => handleForgotPassword(resetEmail || email, true)}
      isResending={isResettingPassword}
      emailSentSuccess={emailSentSuccess}
    />;
  }

  // Email exists confirmation screen
  if (showEmailExists) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md">
          {/* Brand Logo */}
          <div className="text-center mb-8">
            <img src="/lovable-uploads/600c4315-b18a-44c9-9a47-d558560c64a8.png" alt="Bilmodul" className="h-16 mx-auto mb-8" />
          </div>
          
          <Card className="shadow-lg border-0">
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Försökte du logga in?</h2>
                <p className="text-gray-600 text-sm">
                  Vi märkte att du redan har ett konto hos Bilmodul,<br />
                  försökte du att komma till det?
                </p>
              </div>
              
              <div className="space-y-3">
                <Button onClick={handleLoginFromEmailExists} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium">
                  Ja, jag försökte logga in
                </Button>
                
                <Button variant="outline" onClick={handleCreateNewAccountFromEmailExists} className="w-full h-12 border-gray-300 text-gray-700 hover:bg-gray-50 font-medium">
                  Nej, jag vill skapa ett nytt konto
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>;
  }
  if (isSignup) {
    return <div className="min-h-screen flex">
        {/* Left side - Form */}
        <div className="flex-1 flex items-center justify-center bg-white p-8">
          <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img src="/lovable-uploads/600c4315-b18a-44c9-9a47-d558560c64a8.png" alt="Bilmodul" className="h-16 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Kom igång med bilbranschens mest innovativa{" "}
              <span className={`inline-block w-44 text-left transition-opacity duration-300 ${isWordVisible ? 'opacity-100' : 'opacity-0'}`}>
                {words[currentWordIndex]}
              </span>
            </h2>
            <p className="text-gray-600 text-sm mx-0 my-4">Du binder dig inte till något.</p>
          </div>
          
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-email" className="text-sm font-medium">E-post</Label>
                <Input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500" required />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-sm font-medium">Förnamn</Label>
                  <Input id="firstName" type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-sm font-medium">Efternamn</Label>
                  <Input id="lastName" type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500" required />
                </div>
              </div>
              
              
              <div className="flex items-center space-x-2">
                <Checkbox id="terms" checked={acceptedTerms} onCheckedChange={checked => setAcceptedTerms(checked as boolean)} />
                <Label htmlFor="terms" className="text-sm text-gray-700">
                  Jag har läst och godkänner de{" "}
                  <button type="button" className="text-blue-600 hover:underline">
                    allmänna villkoren
                  </button>
                </Label>
              </div>
              
              <Button type="submit" disabled={isLoading || !email || !firstName || !lastName || !acceptedTerms} className={`w-full h-12 text-white font-medium transition-colors ${email && firstName && lastName && acceptedTerms ? "bg-blue-400 hover:bg-blue-500" : "bg-gray-300 cursor-not-allowed"}`}>
                {isLoading ? "Skapar konto..." : "Fortsätt"}
              </Button>
            </form>
            
            <div className="text-center mt-6">
              <span className="text-gray-600 text-sm">Har du redan ett konto? </span>
              <button type="button" onClick={() => setIsSignup(false)} className="text-blue-600 text-sm hover:underline">
                Logga in
              </button>
            </div>
            
            <div className="text-center mt-4 text-xs text-gray-500">
              <button type="button" className="text-blue-600 hover:underline">
                Integritetspolicy
              </button>
            </div>
          </div>
        </div>
        
        {/* Right side - Car image with blue filter */}
        <div className="flex-1 relative" style={{
        backgroundImage: `url(/lovable-uploads/76103496-1341-4874-a8be-8132fc35cf5e.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center right'
      }}>
          {/* Light blue overlay */}
          <div className="absolute inset-0 bg-blue-400 opacity-70"></div>
        </div>
      </div>;
  }

  // Forgot password step
  if (showForgotPassword) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md">
          {/* Brand Logo */}
          <div className="text-center mb-8">
            <img src="/lovable-uploads/600c4315-b18a-44c9-9a47-d558560c64a8.png" alt="Bilmodul" className="h-16 mx-auto mb-8" />
          </div>
          
          <Card className="shadow-lg border-0">
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Glömt lösenord?</h2>
                <p className="text-gray-600 text-sm">
                  Ingen fara, det händer för alla ibland. Ange din e-post så skickar vi en länk för att återställa.
                </p>
              </div>
              
              <form onSubmit={e => {
              e.preventDefault();
              handleForgotPassword(resetEmail);
            }} className="space-y-4">
                <Input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-center" placeholder="din.email@exempel.se" required />
                
                <Button type="submit" disabled={isResettingPassword || !resetEmail.trim()} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium">
                  {isResettingPassword ? "Skickar..." : "Skicka länken"}
                </Button>
              </form>
              
              {/* Back to login */}
              <div className="text-center mt-6">
                <button type="button" onClick={() => { setShowForgotPassword(false); setLoginError(""); }} className="text-blue-600 text-sm hover:underline">
                  Tillbaka till inloggning
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>;
  }

  // Email entry step
  if (!showPasswordStep) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md">
          {/* Brand Logo */}
          <div className="text-center mb-8">
            <img src="/lovable-uploads/600c4315-b18a-44c9-9a47-d558560c64a8.png" alt="Bilmodul" className="h-16 mx-auto mb-8" />
          </div>
          
          <Card className="shadow-lg border-0">
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Välkommen!</h2>
                <p className="text-gray-600">Logga in till Bilmodul genom att ange din e-postadress</p>
              </div>
              
              <form onSubmit={e => {
              e.preventDefault();
              handleEmailContinue();
            }} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="email" className="text-sm text-gray-700">E-post</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && email.includes('@') && handleEmailContinue()}
                    className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500" 
                    required 
                  />
                </div>
                
                <Button type="submit" disabled={!email.includes('@')} className={`w-full h-12 text-white font-medium transition-colors ${email.includes('@') ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-300 cursor-not-allowed"}`}>
                  Fortsätt
                </Button>
              </form>
              
              {/* Sign up link */}
            </CardContent>
          </Card>
        </div>
      </div>;
  }

  // Password entry step
  return <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        {/* Brand Logo */}
        <div className="text-center mb-8">
          <img src="/lovable-uploads/600c4315-b18a-44c9-9a47-d558560c64a8.png" alt="Bilmodul" className="h-16 mx-auto mb-8" />
        </div>
        
        <Card className="shadow-lg border-0">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Välkommen!</h2>
              <p className="text-gray-600">Ange ditt lösenord för att gå vidare</p>
            </div>
            
            <div className="space-y-4">
              {/* Email field with change button */}
              <div className="flex items-center gap-2 p-3 bg-gray-100 rounded border">
                <span className="flex-1 text-gray-900">{email}</span>
                <Button variant="link" className="text-blue-600 text-sm p-0 h-auto" onClick={handleBackToEmail}>
                  Ändra
                </Button>
              </div>
              
              {/* Password field */}
              <div className="space-y-1">
                <Label htmlFor="password" className="text-sm text-gray-700">Lösenord</Label>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"}
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && !isLoading && handleSignIn(e)}
                    className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 pr-10" 
                    required 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              
              {/* Forgot password link */}
              <div className="text-left">
                <button type="button" onClick={() => setShowForgotPassword(true)} className="text-blue-600 text-sm hover:underline">
                  Glömt lösenord?
                </button>
              </div>
              
              {/* Login button */}
              <Button onClick={handleSignIn} disabled={isLoading} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium">
                {isLoading ? "Loggar in..." : "Logga in"}
              </Button>
              
              {/* Error message space - fixed height to prevent layout shift */}
              <div className="h-12 flex items-center">
                {loginError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md w-full">
                    <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-red-600 text-sm font-bold">!</span>
                    </div>
                    <span className="text-red-700 text-sm">{loginError}</span>
                  </div>
                )}
              </div>
            </div>
            
            
          </CardContent>
        </Card>
      </div>
    </div>;
};

export default Auth;
