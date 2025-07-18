import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, Check, ChevronsUpDown, Upload, X } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { sv } from "date-fns/locale";

const carBrands = [
  "Annat",
  "Alfa Romeo",
  "Alpine", 
  "Aston Martin",
  "Audi",
  "Bentley",
  "BMW",
  "BYD",
  "Cadillac",
  "Chevrolet",
  "Chrysler",
  "Citroën",
  "Dacia",
  "Daihatsu",
  "Dodge",
  "Ferrari",
  "Fiat",
  "Fisker, Karma",
  "Ford",
  "GMC",
  "Honda",
  "Hummer",
  "Hyundai",
  "Infiniti",
  "Isuzu",
  "Iveco",
  "Jaguar",
  "Jeep",
  "Kia",
  "Koenigsegg",
  "KTM",
  "Lada",
  "Lamborghini",
  "Lancia",
  "Land Rover",
  "Lexus",
  "Ligier",
  "Lincoln",
  "Lotus",
  "Maserati",
  "Mazda",
  "McLaren",
  "Mercedes-Benz",
  "Maybach",
  "Mini",
  "Mitsubishi",
  "Nissan",
  "Opel",
  "Peugeot",
  "Piaggio",
  "Pininfarina",
  "Polestar",
  "Pontiac, Asüna",
  "Porsche",
  "Renault",
  "Rivian",
  "Rolls-Royce",
  "Saab",
  "Santana",
  "Seat",
  "Shelby SuperCars",
  "Skoda",
  "smart",
  "SsangYong",
  "Subaru",
  "Suzuki",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo"
];

const purchaseChannels = [
  "Bilhandlare",
  "Privatperson",
  "Marknadsplats", 
  "Annan"
];

const marketplaces = [
  "Blocket",
  "KVD",
  "BCA",
  "Auto1",
  "Annan"
];

const purchaseSchema = z.object({
  // Vehicle data
  registration_number: z.string().min(1, "Registreringsnummer krävs"),
  chassis_number: z.string().optional(),
  mileage: z.number().min(0, "Miltal kan inte vara negativt").max(500000, "Miltal kan inte vara över 500,000").optional(),
  brand: z.string().optional(),
  brand_other: z.string().optional(),
  model: z.string().optional(),
  comment: z.string().optional(),
  year_model: z.number().min(1900, "Modellår måste vara minst 1900").max(new Date().getFullYear() + 1, "Modellår kan inte vara i framtiden").optional(),
  first_registration_date: z.date().optional(),
  vat_type: z.string().optional(),
  
  // Purchase information
  purchaser: z.string().min(1, "Inköpare krävs"),
  purchase_price: z.number().min(0.01, "Inköpspris måste vara positivt och större än 0"),
  purchase_date: z.date(),
  down_payment: z.number().min(0, "Handpenning kan inte vara negativ").optional(),
  down_payment_document: z.any().optional(),
  purchase_documentation: z.string().min(1, "Inköpsunderlag krävs"),
  purchase_channel: z.string().optional(),
  purchase_channel_other: z.string().optional(),
  marketplace_channel: z.string().optional(),
  marketplace_channel_other: z.string().optional(),
  expected_selling_price: z.number().min(0, "Förväntat försäljningspris kan inte vara negativt").optional(),
}).refine((data) => {
  // If there's a down payment, file upload is required
  if (data.down_payment && data.down_payment > 0) {
    return data.down_payment_document;
  }
  return true;
}, {
  message: "Handpenningsunderlag krävs när handpenning anges",
  path: ["down_payment_document"],
});

type PurchaseFormData = z.infer<typeof purchaseSchema>;

interface PurchaseFormProps {
  onSuccess: () => void;
}

export const PurchaseForm = ({ onSuccess }: PurchaseFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userProfile, setUserProfile] = useState<{ full_name?: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [firstRegOpen, setFirstRegOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [mileageDisplay, setMileageDisplay] = useState("");
  const [priceDisplay, setPriceDisplay] = useState("");
  const [downPaymentDisplay, setDownPaymentDisplay] = useState("");
  const [expectedPriceDisplay, setExpectedPriceDisplay] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedPurchaseDoc, setUploadedPurchaseDoc] = useState<File | null>(null);
  const [isUploadingPurchaseDoc, setIsUploadingPurchaseDoc] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeTab, setActiveTab] = useState("fordonsdata");
  
  // Generate year options (last 50 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 50 }, (_, i) => currentYear - i);
  
  // Month names in Swedish
  const monthNames = [
    "Januari", "Februari", "Mars", "April", "Maj", "Juni",
    "Juli", "Augusti", "September", "Oktober", "November", "December"
  ];

  const form = useForm<PurchaseFormData>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      purchase_date: new Date(),
      down_payment: 0,
    },
  });

  // Fetch user profile and auto-populate purchaser field
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        
        if (data?.full_name) {
          setUserProfile(data);
          form.setValue('purchaser', data.full_name);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();
  }, [user, form]);

  // Format number with thousands separator
  const formatWithThousands = (value: string) => {
    const num = value.replace(/,/g, '');
    if (!num) return '';
    return parseInt(num).toLocaleString('sv-SE');
  };

  // Format price with thousands separator and decimals
  const formatPriceWithThousands = (value: string) => {
    // Remove existing formatting
    const cleanValue = value.replace(/\s/g, '').replace(/,/g, '.');
    if (!cleanValue) return '';
    
    const num = parseFloat(cleanValue);
    if (isNaN(num)) return value;
    
    return num.toLocaleString('sv-SE', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 2 
    });
  };

  // Handle mileage input change
  const handleMileageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[\s,]/g, ''); // Remove both spaces and commas
    console.log('Mileage input value:', value);
    if (value === '' || /^\d+$/.test(value)) {
      const numValue = value === '' ? undefined : parseInt(value);
      console.log('Parsed mileage number:', numValue);
      console.log('Setting form value with:', numValue);
      form.setValue('mileage', numValue);
      setMileageDisplay(value === '' ? '' : formatWithThousands(value));
    } else {
      console.log('Mileage value rejected by regex:', value);
    }
  };

  // Handle price input change
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow digits, comma, and decimal point
    const cleanValue = value.replace(/\s/g, '').replace(/,/g, '.');
    
    if (cleanValue === '' || /^\d+([.,]\d{0,2})?$/.test(cleanValue)) {
      const numValue = cleanValue === '' ? undefined : parseFloat(cleanValue);
      if (numValue === undefined || numValue >= 0) {
        form.setValue('purchase_price', numValue);
        setPriceDisplay(value === '' ? '' : formatPriceWithThousands(value));
      }
    }
  };

  // Handle down payment input change
  const handleDownPaymentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cleanValue = value.replace(/\s/g, '').replace(/,/g, '.');
    
    if (cleanValue === '' || /^\d+([.,]\d{0,2})?$/.test(cleanValue)) {
      const numValue = cleanValue === '' ? undefined : parseFloat(cleanValue);
      if (numValue === undefined || numValue >= 0) {
        form.setValue('down_payment', numValue);
        setDownPaymentDisplay(value === '' ? '' : formatPriceWithThousands(value));
      }
    }
  };

  // Handle expected selling price input change
  const handleExpectedPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cleanValue = value.replace(/\s/g, '').replace(/,/g, '.');
    
    if (cleanValue === '' || /^\d+([.,]\d{0,2})?$/.test(cleanValue)) {
      const numValue = cleanValue === '' ? undefined : parseFloat(cleanValue);
      if (numValue === undefined || numValue >= 0) {
        form.setValue('expected_selling_price', numValue);
        setExpectedPriceDisplay(value === '' ? '' : formatPriceWithThousands(value));
      }
    }
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!user) return;
    
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const filePath = `down-payment-docs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('down-payment-docs')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      setUploadedFile(file);
      form.setValue('down_payment_document', filePath);
      
      toast({
        title: "Fil uppladdad",
        description: "Handpenningsdokument har laddats upp",
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Fel",
        description: "Det gick inte att ladda upp filen",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Handle file removal
  const handleFileRemove = () => {
    setUploadedFile(null);
    form.setValue('down_payment_document', undefined);
  };

  // Handle purchase documentation file upload
  const handlePurchaseDocUpload = async (file: File) => {
    if (!user) return;
    
    setIsUploadingPurchaseDoc(true);
    setUploadProgress(0);
    
    try {
      // Simulate progress for visual feedback
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = prev + Math.random() * 30;
          return newProgress > 90 ? 90 : newProgress;
        });
      }, 200);

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const filePath = `purchase-docs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('down-payment-docs')
        .upload(fileName, file);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (uploadError) throw uploadError;

      // Small delay to show 100% completion
      setTimeout(() => {
        setUploadedPurchaseDoc(file);
        form.setValue('purchase_documentation', filePath);
        setUploadProgress(0);
        
        toast({
          title: "Fil uppladdad",
          description: "Inköpsdokument har laddats upp",
        });
      }, 500);
    } catch (error) {
      console.error('Error uploading purchase documentation:', error);
      setUploadProgress(0);
      toast({
        title: "Fel",
        description: "Det gick inte att ladda upp filen",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => setIsUploadingPurchaseDoc(false), 500);
    }
  };

  // Handle purchase documentation file removal
  const handlePurchaseDocRemove = () => {
    setUploadedPurchaseDoc(null);
    form.setValue('purchase_documentation', undefined);
  };

  // Check if vehicle data is properly filled to enable the second tab
  const isVehicleDataValid = () => {
    const registrationNumber = form.watch("registration_number");
    return registrationNumber && registrationNumber.trim().length > 0;
  };

  const onSubmit = async (data: PurchaseFormData) => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      const insertData = {
        user_id: user.id,
        status: 'på_lager' as const,
        registration_number: data.registration_number,
        chassis_number: data.chassis_number || null,
        mileage: data.mileage || null,
        brand: data.brand,
        brand_other: data.brand_other || null,
        model: data.model || null,
        comment: data.comment || null,
        year_model: data.year_model || null,
        first_registration_date: data.first_registration_date?.toISOString().split('T')[0] || null,
        vat_type: data.vat_type || null,
        purchaser: data.purchaser,
        purchase_price: data.purchase_price,
        purchase_date: data.purchase_date.toISOString().split('T')[0],
        down_payment: data.down_payment || 0,
        down_payment_document_path: data.down_payment_document || null,
        purchase_documentation: data.purchase_documentation || null,
        purchase_channel: data.purchase_channel || null,
        purchase_channel_other: data.purchase_channel_other || null,
        marketplace_channel: data.marketplace_channel || null,
        marketplace_channel_other: data.marketplace_channel_other || null,
        expected_selling_price: data.expected_selling_price || null,
      };

      const { error } = await supabase
        .from('inventory_items')
        .insert(insertData);

      if (error) throw error;

      toast({
        title: "Framgång",
        description: "Fordon har lagts till i lagret",
      });
      
      form.reset();
      onSuccess();
    } catch (error) {
      console.error('Error creating purchase:', error);
      toast({
        title: "Fel",
        description: "Det gick inte att lägga till fordonet",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Registrera inköp</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="fordonsdata">Fordonsdata</TabsTrigger>
            <TabsTrigger 
              value="inkopsinformation" 
              disabled={!isVehicleDataValid()}
              className={!isVehicleDataValid() ? "cursor-not-allowed opacity-50" : ""}
            >
              Inköpsinformation
            </TabsTrigger>
          </TabsList>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <TabsContent value="fordonsdata" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="registration_number">Registreringsnummer*</Label>
                  <Input
                    id="registration_number"
                    placeholder="t.ex. JSK15L"
                    {...form.register("registration_number")}
                    className={form.formState.errors.registration_number ? "border-destructive" : ""}
                  />
                  {form.formState.errors.registration_number && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.registration_number.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="chassis_number">Chassinummer</Label>
                  <Input id="chassis_number" placeholder="t.ex. 1234567890ABCDEFG" {...form.register("chassis_number")} />
                </div>

                <div>
                  <Label htmlFor="brand">Märke</Label>
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                          "w-full justify-between font-normal",
                          !form.watch("brand") && "text-muted-foreground"
                        )}
                      >
                        {form.watch("brand") || "Välj märke"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Sök märke..." />
                        <CommandEmpty>Inget märke hittades.</CommandEmpty>
                        <CommandList>
                          <CommandGroup>
                            {carBrands.map((brand) => (
                              <CommandItem
                                key={brand}
                                value={brand}
                                onSelect={(currentValue) => {
                                  form.setValue("brand", currentValue === form.watch("brand") ? "" : currentValue);
                                  if (currentValue !== "Annat") {
                                    form.setValue("brand_other", undefined);
                                  }
                                  setOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    form.watch("brand") === brand ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {brand}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {form.formState.errors.brand && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.brand.message}
                    </p>
                  )}
                </div>

                {form.watch("brand") === "Annat" && (
                  <div>
                    <Label htmlFor="brand_other">Ange märke</Label>
                    <Input
                      id="brand_other"
                      {...form.register("brand_other")}
                      placeholder="t.ex. Batmobile"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="model">Modell</Label>
                  <Input id="model" {...form.register("model")} placeholder="t.ex. XC60" />
                </div>

                <div>
                  <Label htmlFor="year_model">Modellår</Label>
                  <Input
                    id="year_model"
                    type="number"
                    min="1900"
                    max={new Date().getFullYear() + 1}
                    placeholder="t.ex. 2020"
                    {...form.register("year_model", { 
                      valueAsNumber: true
                    })}
                  />
                  {form.formState.errors.year_model && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.year_model.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="mileage">Miltal</Label>
                  <Input
                    id="mileage"
                    type="text"
                    min="0"
                    value={mileageDisplay}
                    onChange={handleMileageChange}
                    placeholder="t.ex. 4,500"
                  />
                  {form.formState.errors.mileage && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.mileage.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label>Första datum i trafik</Label>
                  <Popover open={firstRegOpen} onOpenChange={setFirstRegOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !form.watch("first_registration_date") && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.watch("first_registration_date") ? (
                          format(form.watch("first_registration_date")!, "PPP", { locale: sv })
                        ) : (
                          <span>Välj datum</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-4" align="start">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-sm">År</Label>
                            <Select 
                              value={selectedYear?.toString() || ""} 
                              onValueChange={(value) => setSelectedYear(parseInt(value))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Välj år" />
                              </SelectTrigger>
                              <SelectContent className="max-h-48">
                                {yearOptions.map((year) => (
                                  <SelectItem key={year} value={year.toString()}>
                                    {year}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <Label className="text-sm">Månad</Label>
                            <Select 
                              value={selectedMonth?.toString() || ""} 
                              onValueChange={(value) => setSelectedMonth(parseInt(value))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Välj månad" />
                              </SelectTrigger>
                              <SelectContent>
                                {monthNames.map((month, index) => (
                                  <SelectItem key={index} value={index.toString()}>
                                    {month}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        {selectedYear && selectedMonth !== null && (
                          <Calendar
                            mode="single"
                            selected={form.watch("first_registration_date")}
                            onSelect={(date) => {
                              if (date) {
                                form.setValue("first_registration_date", date);
                                setFirstRegOpen(false);
                              }
                            }}
                            month={new Date(selectedYear, selectedMonth)}
                            onMonthChange={(date) => {
                              setSelectedYear(date.getFullYear());
                              setSelectedMonth(date.getMonth());
                            }}
                            className="rounded-md border pointer-events-auto"
                            disabled={(date) => 
                              date > new Date() || 
                              date.getFullYear() !== selectedYear ||
                              date.getMonth() !== selectedMonth
                            }
                          />
                        )}
                        
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              form.setValue("first_registration_date", undefined);
                              setSelectedYear(null);
                              setSelectedMonth(null);
                              setFirstRegOpen(false);
                            }}
                            className="flex-1"
                          >
                            Rensa
                          </Button>
                          <Button 
                            onClick={() => setFirstRegOpen(false)}
                            className="flex-1"
                          >
                            Klar
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label htmlFor="vat_type">Momsregel</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between font-normal",
                          !form.watch("vat_type") && "text-muted-foreground"
                        )}
                      >
                        {form.watch("vat_type") || "Välj momsregel"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandList>
                          <CommandGroup>
                            <CommandItem
                              value="Vinstmarginalbeskattning (VMB)"
                              onSelect={() => {
                                form.setValue("vat_type", "Vinstmarginalbeskattning (VMB)");
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  form.watch("vat_type") === "Vinstmarginalbeskattning (VMB)" ? "opacity-100" : "opacity-0"
                                )}
                              />
                              Vinstmarginalbeskattning (VMB)
                            </CommandItem>
                            <CommandItem
                              value="Moms (25%)"
                              onSelect={() => {
                                form.setValue("vat_type", "Moms (25%)");
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  form.watch("vat_type") === "Moms (25%)" ? "opacity-100" : "opacity-0"
                                )}
                              />
                              Moms (25%)
                            </CommandItem>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div>
                <Label htmlFor="comment">Anteckning</Label>
                <Input id="comment" {...form.register("comment")} />
              </div>

              <div className="flex justify-end">
                <Button 
                  type="button" 
                  onClick={() => setActiveTab("inkopsinformation")}
                  disabled={!isVehicleDataValid()}
                >
                  Fortsätt till inköpsinformation
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="inkopsinformation" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Inköpare */}
                <div>
                  <Label htmlFor="purchaser">Inköpare*</Label>
                  <Input
                    id="purchaser"
                    {...form.register("purchaser")}
                    className={form.formState.errors.purchaser ? "border-destructive" : ""}
                  />
                  {form.formState.errors.purchaser && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.purchaser.message}
                    </p>
                  )}
                </div>

                {/* 2. Inköpsdatum */}
                <div>
                  <Label htmlFor="purchase_date">Inköpsdatum *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.watch("purchase_date") 
                          ? format(form.watch("purchase_date"), "yyyy-MM-dd")
                          : "Välj datum"
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={form.watch("purchase_date")}
                        onSelect={(date) => form.setValue("purchase_date", date || new Date())}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* 3. Inköpspris */}
                <div>
                  <Label htmlFor="purchase_price">Inköpspris (SEK) *</Label>
                  <Input
                    id="purchase_price"
                    type="text"
                    value={priceDisplay}
                    onChange={handlePriceChange}
                    placeholder="t.ex. 150,000"
                    className={form.formState.errors.purchase_price ? "border-destructive" : ""}
                  />
                  {form.formState.errors.purchase_price && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.purchase_price.message}
                    </p>
                  )}
                </div>

                {/* 4. Förväntat försäljningspris */}
                <div>
                  <Label htmlFor="expected_selling_price">Förväntat försäljningspris (SEK)</Label>
                  <Input
                    id="expected_selling_price"
                    type="text"
                    value={expectedPriceDisplay}
                    onChange={handleExpectedPriceChange}
                    placeholder="t.ex. 180,000"
                  />
                  {form.formState.errors.expected_selling_price && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.expected_selling_price.message}
                    </p>
                  )}
                </div>

                {/* 5. Handpenning */}
                <div>
                  <Label htmlFor="down_payment">Handpenning (SEK)</Label>
                  <Input
                    id="down_payment"
                    type="text"
                    value={downPaymentDisplay}
                    onChange={handleDownPaymentChange}
                    placeholder="t.ex. 25,000"
                  />
                  {form.formState.errors.down_payment && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.down_payment.message}
                    </p>
                  )}
                </div>

                {/* File upload for down payment documentation */}
                {form.watch("down_payment") > 0 && (
                  <div>
                    <Label htmlFor="down_payment_document">Bifoga handpenningsunderlag*</Label>
                    <div className="space-y-2">
                      {!uploadedFile ? (
                        <div>
                          <div className="relative">
                            <Input
                              type="file"
                              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleFileUpload(file);
                                }
                              }}
                              disabled={isUploading}
                              className="hidden"
                              id="file-upload"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                              onClick={() => document.getElementById('file-upload')?.click()}
                              disabled={isUploading}
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              Välj fil
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground">Ingen fil vald</p>
                          {isUploading && (
                            <p className="text-sm text-muted-foreground">Laddar upp fil...</p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-2 border rounded-md bg-muted/50">
                          <div className="flex items-center space-x-2">
                            <Upload className="h-4 w-4" />
                            <span className="text-sm">{uploadedFile.name}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleFileRemove}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                       )}
                     </div>
                     {form.formState.errors.down_payment_document && (
                       <p className="text-sm text-destructive mt-1">
                         {typeof form.formState.errors.down_payment_document.message === 'string' 
                           ? form.formState.errors.down_payment_document.message 
                           : "Handpenningsunderlag krävs när handpenning anges"}
                       </p>
                     )}
                   </div>
                 )}

                {/* 6. Inköpskanal */}
                <div>
                  <Label htmlFor="purchase_channel">Inköpskanal</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between font-normal",
                          !form.watch("purchase_channel") && "text-muted-foreground"
                        )}
                      >
                        {form.watch("purchase_channel") || "Välj inköpskanal"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandList>
                          <CommandGroup>
                            {purchaseChannels.map((channel) => (
                              <CommandItem
                                key={channel}
                                value={channel}
                                onSelect={() => {
                                  form.setValue("purchase_channel", channel);
                                  if (channel !== "Marknadsplats") {
                                    form.setValue("marketplace_channel", undefined);
                                    form.setValue("marketplace_channel_other", undefined);
                                  }
                                  if (channel !== "Annan") {
                                    form.setValue("purchase_channel_other", undefined);
                                  }
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    form.watch("purchase_channel") === channel ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {channel}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {form.watch("purchase_channel") === "Annan" && (
                  <div>
                    <Label htmlFor="purchase_channel_other">Ange inköpskanal</Label>
                    <Input
                      id="purchase_channel_other"
                      {...form.register("purchase_channel_other")}
                      placeholder="Ange vilken inköpskanal"
                    />
                  </div>
                )}

                {form.watch("purchase_channel") === "Marknadsplats" && (
                  <div>
                    <Label htmlFor="marketplace_channel">Marknadsplats</Label>
                    <Select onValueChange={(value) => {
                      form.setValue("marketplace_channel", value);
                      if (value !== "Annan") {
                        form.setValue("marketplace_channel_other", undefined);
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Välj marknadsplats" />
                      </SelectTrigger>
                      <SelectContent>
                        {marketplaces.map((marketplace) => (
                          <SelectItem key={marketplace} value={marketplace}>
                            {marketplace}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {form.watch("purchase_channel") === "Marknadsplats" && form.watch("marketplace_channel") === "Annan" && (
                  <div>
                    <Label htmlFor="marketplace_channel_other">Beskriv marknadsplats</Label>
                    <Input
                      id="marketplace_channel_other"
                      {...form.register("marketplace_channel_other")}
                      placeholder="Ange vilken marknadsplats"
                    />
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="purchase_documentation">Inköpsunderlag*</Label>
                <div className="space-y-2">
                  {!uploadedPurchaseDoc ? (
                    <div>
                      <div className="relative">
                        <Input
                          type="file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handlePurchaseDocUpload(file);
                            }
                          }}
                          disabled={isUploadingPurchaseDoc}
                          className="hidden"
                          id="purchase-doc-upload"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                          onClick={() => document.getElementById('purchase-doc-upload')?.click()}
                          disabled={isUploadingPurchaseDoc}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Välj fil
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">Ingen fil vald</p>
                      {isUploadingPurchaseDoc && (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Progress value={uploadProgress} className="flex-1 h-2" />
                            <span className="text-sm text-muted-foreground min-w-[3rem]">
                              {Math.round(uploadProgress)}%
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground animate-pulse">
                            Laddar upp fil...
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-2 border rounded-md bg-muted/50">
                      <div className="flex items-center space-x-2">
                        <Upload className="h-4 w-4" />
                        <span className="text-sm">{uploadedPurchaseDoc.name}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handlePurchaseDocRemove}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                   )}
                 </div>
                 {form.formState.errors.purchase_documentation && (
                   <p className="text-sm text-destructive mt-1">
                     {form.formState.errors.purchase_documentation.message}
                   </p>
                 )}
               </div>

              <div className="flex justify-between">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setActiveTab("fordonsdata")}
                >
                  Tillbaka till fordonsdata
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Registrerar..." : "Registrera inköp"}
                </Button>
              </div>
            </TabsContent>
          </form>
        </Tabs>
      </CardContent>
    </Card>
  );
};