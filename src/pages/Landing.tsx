import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Truck, 
  Package, 
  BarChart3, 
  Shield, 
  Clock, 
  Users,
  CheckCircle,
  Star,
  ArrowRight,
  Phone,
  Mail
} from "lucide-react";
import { Link } from "react-router-dom";

const Landing = () => {
  const features = [
    {
      icon: Package,
      title: "Avancerad lagerhantering",
      description: "Håll koll på ditt lager i realtid med automatisk lagersaldo och påfyllningsalarmer."
    },
    {
      icon: BarChart3,
      title: "Kraftfull rapportering",
      description: "Få djupgående insikter med automatiserade rapporter och analytics."
    },
    {
      icon: Truck,
      title: "Logistikhantering",
      description: "Effektivisera din leveransprocess med integrerad logistikhantering."
    },
    {
      icon: Shield,
      title: "Säker och tillförlitlig",
      description: "Bank-nivå säkerhet med automatiska säkerhetskopior och uppdateringar."
    },
    {
      icon: Clock,
      title: "Realtidsuppdateringar",
      description: "Se förändringar direkt när de sker, oavsett var ditt team befinner sig."
    },
    {
      icon: Users,
      title: "Teamsamarbete",
      description: "Låt hela teamet arbeta tillsammans med rollbaserade behörigheter."
    }
  ];

  const benefits = [
    "Automatiserad lagerhantering",
    "Integrerad faktureringssystem",
    "Realtidsrapporter och analytics",
    "Mobilanpassat för arbete på språng",
    "API-integrationer med populära verktyg",
    "24/7 kundsupport på svenska"
  ];

  const testimonials = [
    {
      name: "Anna Andersson",
      company: "Byggmaterial Nord AB",
      text: "Lagermodulen har revolutionerat vår lagerhantering. Vi sparar 15 timmar per vecka!",
      rating: 5
    },
    {
      name: "Erik Johansson",
      company: "Teknik Solutions",
      text: "Fantastiskt system som är både kraftfullt och användarvänligt.",
      rating: 5
    },
    {
      name: "Maria Lindberg",
      company: "Retail Plus",
      text: "Den bästa investeringen vi gjort för vårt företag. Rekommenderar varmt!",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Package className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-blue-600">Lagermodulen</span>
          </div>
          
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-600 hover:text-blue-600 transition-colors">Funktioner</a>
            <a href="#pricing" className="text-gray-600 hover:text-blue-600 transition-colors">Priser</a>
            <a href="#testimonials" className="text-gray-600 hover:text-blue-600 transition-colors">Kundberättelser</a>
            <a href="#contact" className="text-gray-600 hover:text-blue-600 transition-colors">Kontakt</a>
          </nav>
          
          <div className="flex items-center space-x-4">
            <Link to="/auth">
              <Button variant="ghost" className="text-gray-600">
                Logga in
              </Button>
            </Link>
            <Link to="/auth">
              <Button className="bg-blue-600 hover:bg-blue-700">
                Kom igång gratis
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-indigo-100 py-20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-4 bg-blue-100 text-blue-800 border-blue-200">
                Sveriges mest innovativa lagerhanteringssystem
              </Badge>
              
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Revolutionera din{" "}
                <span className="text-blue-600">lagerhantering</span>
              </h1>
              
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Med Lagermodulen får du tillgång till <strong>automatiserad lagerhantering</strong>, 
                <strong> realtidsrapporter</strong>, <strong>integrerad fakturering</strong> och 
                <strong> avancerad analytics</strong> i en enda plattform.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link to="/auth">
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3">
                    Starta gratis testperiod
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Button variant="outline" size="lg" className="text-lg px-8 py-3">
                  Se demo
                </Button>
              </div>
              
              <div className="text-center sm:text-left">
                <p className="text-sm text-gray-500 mb-2">
                  Vill du veta mer? Vi ringer upp dig inom <strong>5 minuter!</strong>
                </p>
                <Button variant="outline" className="text-blue-600 border-blue-600">
                  <Phone className="mr-2 h-4 w-4" />
                  Jag vill bli uppringd
                </Button>
              </div>
            </div>
            
            <div className="relative">
              <img 
                src="/lovable-uploads/f9ec5a89-2d14-4d32-bf67-1ce884d50c0c.png"
                alt="Lagerhanteringssystem dashboard"
                className="rounded-2xl shadow-2xl"
              />
              <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-lg shadow-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium">Realtidssynkronisering</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Fördelarna med att använda <span className="text-blue-600">Lagermodulen</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Som kund får du tillgång till en komplett verktygslåda som hjälper dig driva ditt företag framåt.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center space-x-3">
                <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                <span className="text-gray-700 font-medium">{benefit}</span>
              </div>
            ))}
          </div>
          
          <div className="flex justify-center space-x-4">
            <Link to="/auth">
              <Button size="lg" className="bg-gray-900 hover:bg-gray-800">
                Kom igång idag
              </Button>
            </Link>
            <Button variant="outline" size="lg">
              Läs mer
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Kraftfulla funktioner för moderna företag
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Lagermodulen erbjuder allt du behöver för att hantera ditt lager effektivt och professionellt.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-8">
                  <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Vad våra kunder säger
            </h2>
            <p className="text-xl text-gray-600">
              Över 1,000+ företag litar på Lagermodulen för sin lagerhantering
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-8">
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-500 fill-current" />
                    ))}
                  </div>
                  <blockquote className="text-gray-700 mb-6 italic">
                    "{testimonial.text}"
                  </blockquote>
                  <div>
                    <div className="font-semibold text-gray-900">{testimonial.name}</div>
                    <div className="text-gray-600 text-sm">{testimonial.company}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">
            Redo att revolutionera din lagerhantering?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Gå med i över 1,000+ företag som redan använder Lagermodulen
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth">
              <Button size="lg" variant="secondary" className="text-lg px-8 py-3">
                Starta gratis testperiod
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="text-lg px-8 py-3 border-white text-white hover:bg-white hover:text-blue-600">
              Kontakta försäljning
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-gray-900 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Package className="h-8 w-8 text-blue-500" />
                <span className="text-2xl font-bold">Lagermodulen</span>
              </div>
              <p className="text-gray-400 mb-4">
                Sveriges mest innovativa lagerhanteringssystem för moderna företag.
              </p>
              <div className="flex space-x-4">
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                  <Phone className="h-4 w-4 mr-2" />
                  010-123 45 67
                </Button>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Produkt</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Funktioner</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Priser</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Demo</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Företag</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Om oss</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Karriär</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blogg</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Press</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Hjälpcenter</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Kontakt</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Status</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integritetspolicy</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>&copy; 2024 Lagermodulen. Alla rättigheter förbehållna.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;