import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-8">
      {/* Centered Logo */}
      <div className="flex items-center justify-center">
        <img src="/lovable-uploads/057dc8b8-62ce-4b36-b42f-7cda0b9a01d1.png" alt="Veksla" className="h-16" />
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