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

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showPasswordStep, setShowPasswordStep] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [showEmailExists, setShowEmailExists] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      }
    };
    
    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!acceptedTerms) {
      toast({
        title: "Acceptera villkor",
        description: "Du måste acceptera villkoren för att fortsätta.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);

    try {
      // First check if email already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('email', email)
        .maybeSingle();

      if (existingProfile) {
        setShowEmailExists(true);
        setIsLoading(false);
        return;
      }

      // If email doesn't exist, proceed with signup
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      });

      if (error) throw error;

      toast({
        title: "Registrering lyckades!",
        description: "Kontrollera din e-post för att bekräfta ditt konto.",
      });
    } catch (error: any) {
      toast({
        title: "Fel vid registrering",
        description: error.message,
        variant: "destructive",
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
    // Reset form but keep email
    setFirstName("");
    setLastName("");
    setAcceptedTerms(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      navigate("/");
    } catch (error: any) {
      toast({
        title: "Fel vid inloggning",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (resetEmail?: string) => {
    const emailToUse = resetEmail || email;
    if (!emailToUse.trim()) {
      toast({
        title: "E-post krävs",
        description: "Ange din e-postadress för att återställa lösenordet.",
        variant: "destructive",
      });
      return;
    }

    setIsResettingPassword(true);

    try {
      // First check if the email exists in the database
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('email', emailToUse)
        .single();

      if (profileError || !profile) {
        toast({
          title: "Användaren kunde inte hittas",
          description: "E-postadressen finns inte registrerad i systemet.",
          variant: "destructive",
        });
        setIsResettingPassword(false);
        return;
      }

      // If user exists, send password reset email
      const { error } = await supabase.auth.resetPasswordForEmail(emailToUse, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      });

      if (error) throw error;

      toast({
        title: "E-post skickad!",
        description: "Kontrollera din e-post för instruktioner om hur du återställer ditt lösenord.",
      });
      
      setShowForgotPassword(false);
    } catch (error: any) {
      toast({
        title: "Fel vid återställning",
        description: "Något gick fel. Försök igen senare.",
        variant: "destructive",
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleEmailContinue = () => {
    if (email.trim()) {
      setShowPasswordStep(true);
    }
  };

  const handleBackToEmail = () => {
    setShowPasswordStep(false);
    setPassword("");
  };

  // Initialize resetEmail when showing forgot password form
  useEffect(() => {
    if (showForgotPassword) {
      setResetEmail(email);
    }
  }, [showForgotPassword, email]);

  // Email exists confirmation screen
  if (showEmailExists) {
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
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Försökte du logga in?</h2>
                <p className="text-gray-600 text-sm">
                  Vi märkte att du redan har ett konto hos Veksla, försökte du att komma till det?
                </p>
              </div>
              
              <div className="space-y-3">
                <Button 
                  onClick={handleLoginFromEmailExists}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  Ja, jag försökte logga in
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={handleCreateNewAccountFromEmailExists}
                  className="w-full h-12 border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
                >
                  Nej, jag vill skapa ett nytt konto
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isSignup) {
    return (
      <div className="min-h-screen flex">
        {/* Left side - Form */}
        <div className="flex-1 flex items-center justify-center bg-white p-8">
          <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img src="/lovable-uploads/057dc8b8-62ce-4b36-b42f-7cda0b9a01d1.png" alt="Veksla" className="h-16 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Skapa konto för att komma igång med Sveriges bästa lagerhanteringssystem
            </h2>
            <p className="text-gray-600 text-sm">Du binder dig inte till något.</p>
          </div>
          
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-email" className="text-sm font-medium">E-post</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-sm font-medium">Förnamn</Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-sm font-medium">Efternamn</Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="terms"
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)}
                />
                <Label htmlFor="terms" className="text-sm text-gray-700">
                  Jag har läst och godkänner de{" "}
                  <button type="button" className="text-blue-600 hover:underline">
                    Allmänna villkoren
                  </button>
                </Label>
              </div>
              
              <Button 
                type="submit"
                disabled={isLoading || !email || !firstName || !lastName || !acceptedTerms}
                className={`w-full h-12 text-white font-medium transition-colors ${
                  email && firstName && lastName && acceptedTerms 
                    ? "bg-blue-400 hover:bg-blue-500" 
                    : "bg-gray-300 cursor-not-allowed"
                }`}
              >
                {isLoading ? "Skapar konto..." : "Fortsätt"}
              </Button>
            </form>
            
            <div className="text-center mt-6">
              <span className="text-gray-600 text-sm">Har du redan ett konto? </span>
              <button
                type="button"
                onClick={() => setIsSignup(false)}
                className="text-blue-600 text-sm hover:underline"
              >
                Logga in
              </button>
            </div>
            
            <div className="text-center mt-4 text-xs text-gray-500">
              <p>Du använder Veksla för Sverige 🇸🇪 <button type="button" className="text-blue-600 hover:underline">Välj ett annat land</button></p>
              <button type="button" className="text-blue-600 hover:underline">
                Integritetspolicy
              </button>
            </div>
          </div>
        </div>
        
        {/* Right side - Car image with blue filter */}
        <div 
          className="flex-1 relative"
          style={{
            backgroundImage: `url(/lovable-uploads/f9ec5a89-2d14-4d32-bf67-1ce884d50c0c.png)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Light blue overlay */}
          <div className="absolute inset-0 bg-blue-400 opacity-70"></div>
        </div>
      </div>
    );
  }

  // Forgot password step
  if (showForgotPassword) {
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
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Glömt lösenord?</h2>
                <p className="text-gray-600 text-sm">
                  Ingen fara, det händer för alla ibland. Ange din e-post så skickar vi en länk för att återställa.
                </p>
              </div>
              
              <form onSubmit={(e) => { e.preventDefault(); handleForgotPassword(resetEmail); }} className="space-y-4">
                <Input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-center"
                  placeholder="din.email@exempel.se"
                  required
                />
                
                <Button 
                  type="submit"
                  disabled={isResettingPassword || !resetEmail.trim()}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  {isResettingPassword ? "Skickar..." : "Skicka länken"}
                </Button>
              </form>
              
              {/* Back to login */}
              <div className="text-center mt-6">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
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
  }

  // Email entry step
  if (!showPasswordStep) {
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
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Välkommen!</h2>
                <p className="text-gray-600">Logga in till Veksla genom att ange din e-postadress</p>
              </div>
              
              <form onSubmit={(e) => { e.preventDefault(); handleEmailContinue(); }} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="email" className="text-sm text-gray-700">E-post</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <Button 
                  type="submit"
                  disabled={!email.includes('@')}
                  className={`w-full h-12 text-white font-medium transition-colors ${
                    email.includes('@') 
                      ? "bg-blue-600 hover:bg-blue-700" 
                      : "bg-gray-300 cursor-not-allowed"
                  }`}
                >
                  Fortsätt
                </Button>
              </form>
              
              {/* Sign up link */}
              <div className="text-center mt-6">
                <span className="text-gray-600 text-sm">Har du inget konto? </span>
                <button
                  type="button"
                  onClick={() => setIsSignup(true)}
                  className="text-blue-600 text-sm hover:underline"
                >
                  Skapa konto
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Password entry step
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
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Välkommen!</h2>
              <p className="text-gray-600">Ange ditt lösenord för att gå vidare</p>
            </div>
            
            <div className="space-y-4">
              {/* Email field with change button */}
              <div className="flex items-center gap-2 p-3 bg-gray-100 rounded border">
                <span className="flex-1 text-gray-900">{email}</span>
                <Button 
                  variant="link" 
                  className="text-blue-600 text-sm p-0 h-auto"
                  onClick={handleBackToEmail}
                >
                  Ändra
                </Button>
              </div>
              
              {/* Password field */}
              <div className="space-y-1">
                <Label htmlFor="password" className="text-sm text-gray-700">Lösenord</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              
              {/* Forgot password link */}
              <div className="text-left">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-blue-600 text-sm hover:underline"
                >
                  Glömt lösenord?
                </button>
              </div>
              
              {/* Login button */}
              <Button 
                onClick={handleSignIn}
                disabled={isLoading}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                {isLoading ? "Loggar in..." : "Logga in"}
              </Button>
            </div>
            
            {/* Sign up link */}
            <div className="text-center mt-6">
              <span className="text-gray-600 text-sm">Har du inget konto? </span>
              <button
                type="button"
                onClick={() => setIsSignup(true)}
                className="text-blue-600 text-sm hover:underline"
              >
                Skapa konto
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;