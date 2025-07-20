import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      {/* Header with Logo and Login Button */}
      <div className="flex items-center justify-between w-full max-w-4xl px-8 mb-8">
        <div className="flex items-center">
          <img src="/lovable-uploads/057dc8b8-62ce-4b36-b42f-7cda0b9a01d1.png" alt="Veksla" className="h-12" />
        </div>
        
        <Link to="/login-or-signup">
          <Button className="bg-blue-600 hover:bg-blue-700">
            Logga in
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default Landing;