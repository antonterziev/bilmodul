import { useEffect, useState } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import OnboardingFlow from "@/components/Onboarding/OnboardingFlow";
import { toast } from "sonner";

const Onboarding = () => {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<{
    email: string;
    firstName: string;
    lastName: string;
  } | null>(null);

  useEffect(() => {
    const handleEmailVerification = async () => {
      try {
        // Get the current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          toast.error("Ett fel uppstod vid verifiering");
          return;
        }

        if (!session?.user) {
          // Try to get user from URL params if available
          const email = searchParams.get('email');
          const firstName = searchParams.get('firstName');
          const lastName = searchParams.get('lastName');

          if (!email || !firstName || !lastName) {
            toast.error("Saknade användaruppgifter");
            return;
          }

          setUserInfo({ email, firstName, lastName });
        } else {
          // User is already authenticated, get their info
          const user = session.user;
          const email = user.email || '';
          const firstName = user.user_metadata?.first_name || '';
          const lastName = user.user_metadata?.last_name || '';

          // Check if user has already completed onboarding
          if (user.user_metadata?.onboarding_completed) {
            // Redirect to dashboard if onboarding is already completed
            window.location.href = "/dashboard";
            return;
          }

          setUserInfo({ email, firstName, lastName });
        }
      } catch (error) {
        console.error("Error handling email verification:", error);
        toast.error("Ett fel uppstod vid verifiering");
      } finally {
        setIsLoading(false);
      }
    };

    handleEmailVerification();
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifierar...</p>
        </div>
      </div>
    );
  }

  if (!userInfo) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <OnboardingFlow 
      email={userInfo.email}
      firstName={userInfo.firstName}
      lastName={userInfo.lastName}
    />
  );
};

export default Onboarding;