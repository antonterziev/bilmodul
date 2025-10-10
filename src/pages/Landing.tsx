import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-8">
      {/* Centered Logo */}
      <div className="flex items-center justify-center">
        <img src="/lovable-uploads/600c4315-b18a-44c9-9a47-d558560c64a8-optimized.png" alt="Bilmodul logotyp" className="h-16 max-w-[90vw] w-auto object-contain" loading="eager" fetchPriority="high" />
      </div>
      
      {/* Kom igång Button */}
      <Link to="/login-or-signup">
        <Button className="bg-blue-600 hover:bg-blue-700 px-8 py-3 text-lg">
          Kom igång
        </Button>
      </Link>
    </div>
  );
};

export default Landing;