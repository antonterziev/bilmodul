import React, { useState, useEffect } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, Check, ChevronLeft, ChevronRight, ChevronsUpDown, Upload, X, Truck } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn, determineVatType } from "@/lib/utils";
import { InfoPopup } from "@/components/ui/info-popup";
import { sv } from "date-fns/locale";
const carBrands = ["Annat", "Alfa Romeo", "Alpine", "Aston Martin", "Audi", "Bentley", "BMW", "BYD", "Cadillac", "Chevrolet", "Chrysler", "Citroën", "Dacia", "Daihatsu", "Dodge", "Ferrari", "Fiat", "Fisker, Karma", "Ford", "GMC", "Honda", "Hummer", "Hyundai", "Infiniti", "Isuzu", "Iveco", "Jaguar", "Jeep", "Kia", "Koenigsegg", "KTM", "Lada", "Lamborghini", "Lancia", "Land Rover", "Lexus", "Ligier", "Lincoln", "Lotus", "Maserati", "Mazda", "McLaren", "Mercedes-Benz", "Maybach", "Mini", "Mitsubishi", "Nissan", "Opel", "Peugeot", "Piaggio", "Pininfarina", "Polestar", "Pontiac, Asüna", "Porsche", "Renault", "Rivian", "Rolls-Royce", "Saab", "Santana", "Seat", "Shelby SuperCars", "Skoda", "smart", "SsangYong", "Subaru", "Suzuki", "Tesla", "Toyota", "Volkswagen", "Volvo"];
const purchaseChannels = ["Privatperson", "Företag (utan moms)", "Företag (med moms)", "Utländskt företag (med moms)", "Utländskt företag (utan moms)", "Leasingbolag (privat)", "Leasingbolag (tjänstebil)"];
// No longer needed as marketplace options have been removed
const purchaseSchema = z.object({
  // Vehicle data
  registration_number: z.string().min(1, "Registreringsnummer krävs"),
  chassis_number: z.string().optional(),
  mileage: z.number().min(0, "Miltal kan inte vara negativt").max(500000, "Miltal kan inte vara över 500,000"),
  brand: z.string().optional(),
  brand_other: z.string().optional(),
  model: z.string().optional(),
  comment: z.string().optional(),
  year_model: z.preprocess(val => val === "" || val === null || val === undefined ? undefined : Number(val), z.number().min(1981, "Modellår måste vara minst 1981").max(new Date().getFullYear() + 2, "Modellår kan inte vara mer än två år i framtiden").optional()),
  first_registration_date: z.date().max(new Date(), "Första datum i trafik kan inte vara i framtiden"),
  vat_type: z.string().min(1, "Momsregel krävs"),
  // Purchase information
  purchaser: z.string().min(1, "Inköpare krävs"),
  purchase_price: z.number().min(0.01, "Inköpspris måste vara positivt och större än 0"),
  purchase_date: z.date().max(new Date(new Date().setHours(23, 59, 59, 999)), "Inköpsdatum kan inte vara i framtiden"),
  down_payment: z.number().min(0, "Handpenning kan inte vara negativ").optional(),
  down_payment_document: z.any().optional(),
  purchase_documentation: z.string().optional(),
  purchase_channel: z.string().optional(),
  purchase_channel_other: z.string().optional()
  // Marketplace fields removed as they're no longer used
});
type PurchaseFormData = z.infer<typeof purchaseSchema>;
interface PurchaseFormProps {
  onSuccess: () => void;
}
export const PurchaseForm = ({
  onSuccess
}: PurchaseFormProps) => {
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    full_name?: string;
  } | null>(null);

  // Organization users state
  const [organizationUsers, setOrganizationUsers] = useState<Array<{
    user_id: string;
    full_name: string;
    email: string;
  }>>([]);
  const [open, setOpen] = useState(false);
  const [firstRegOpen, setFirstRegOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [mileageDisplay, setMileageDisplay] = useState("");
  const [priceDisplay, setPriceDisplay] = useState("");
  const [downPaymentDisplay, setDownPaymentDisplay] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedPurchaseDoc, setUploadedPurchaseDoc] = useState<File | null>(null);
  const [isUploadingPurchaseDoc, setIsUploadingPurchaseDoc] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeTab, setActiveTab] = useState("fordonsdata");
  const [isDuplicateRegNumber, setIsDuplicateRegNumber] = useState(false);
  const [duplicateVehicleId, setDuplicateVehicleId] = useState<string | null>(null);
  const [isCheckingRegNumber, setIsCheckingRegNumber] = useState(false);
  const [isLoadingCarInfo, setIsLoadingCarInfo] = useState(false);
  const [showFullForm, setShowFullForm] = useState(false);
  const [carDataFetched, setCarDataFetched] = useState(false);
  const [purchasePriceCurrency, setPurchasePriceCurrency] = useState("SEK");
  const [downPaymentCurrency, setDownPaymentCurrency] = useState("SEK");

  // Generate year options (last 50 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({
    length: 50
  }, (_, i) => currentYear - i);

  // Month names in Swedish
  const monthNames = ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"];
  const form = useForm<PurchaseFormData>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      purchase_date: new Date(),
      down_payment: 0,
      purchase_channel: "Privatperson",
      vat_type: "Vinstmarginalbeskattning (VMB)"
    }
  });

  // Function to reset form to initial state
  const resetForm = () => {
    setShowFullForm(false);
    setCarDataFetched(false);
    setActiveTab("fordonsdata");
    setIsDuplicateRegNumber(false);
    setDuplicateVehicleId(null);
    setIsCheckingRegNumber(false);
    setIsLoadingCarInfo(false);
    setMileageDisplay("");
    setPriceDisplay("");
    setDownPaymentDisplay("");
    setUploadedFile(null);
    setUploadedPurchaseDoc(null);
    setSelectedYear(null);
    setSelectedMonth(null);
    form.reset({
      purchase_date: new Date(),
      down_payment: 0,
      purchase_channel: "Privatperson",
      vat_type: "Vinstmarginalbeskattning (VMB)"
    });
  };

  // Reset form when component mounts to ensure fresh start
  useEffect(() => {
    resetForm();
  }, []);

  // Fetch user profile and organization users
  useEffect(() => {
    const fetchUserProfileAndOrgUsers = async () => {
      if (!user) return;
      try {
        // First get user's profile and organization
        const {
          data: profileData,
          error: profileError
        } = await supabase.from('profiles').select('full_name, organization_id').eq('user_id', user.id).single();
        if (profileError) throw profileError;
        if (profileData?.full_name) {
          setUserProfile(profileData);
          // Set current user as default purchaser
          form.setValue('purchaser', profileData.full_name);
        }

        // Fetch all users in the same organization
        if (profileData?.organization_id) {
          const {
            data: orgUsersData,
            error: orgUsersError
          } = await supabase.from('profiles').select('user_id, full_name, email, first_name, last_name').eq('organization_id', profileData.organization_id).not('full_name', 'is', null);
          if (orgUsersError) throw orgUsersError;

          // Format the users data
          const formattedUsers = (orgUsersData || []).map(user => ({
            user_id: user.user_id,
            full_name: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
            email: user.email
          })).filter(user => user.full_name);
          setOrganizationUsers(formattedUsers);
        }
      } catch (error) {
        console.error('Error fetching user profile and organization users:', error);
      }
    };
    fetchUserProfileAndOrgUsers();
  }, [user, form]);

  // Fetch vehicle data from car info APIs via Edge Function
  const fetchCarInfo = async (regNumber: string) => {
    if (!regNumber.trim()) return;
    setIsLoadingCarInfo(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('fetch-car-info', {
        body: {
          registrationNumber: regNumber.trim()
        }
      });
      if (error) {
        console.error('Edge function error:', error);
        return;
      }
      if (data && !data.error) {
        // Auto-populate form fields with data from car info APIs
        if (data.brand) {
          const brandMatch = carBrands.find(brand => brand.toLowerCase() === data.brand.toLowerCase());
          form.setValue('brand', brandMatch || 'Annat');
          if (!brandMatch && data.brand) {
            form.setValue('brand_other', data.brand);
          }
        }
        if (data.model) {
          form.setValue('model', data.model);
        }
        if (data.modelYear) {
          form.setValue('year_model', parseInt(data.modelYear));
        }
        if (data.mileage) {
          form.setValue('mileage', parseInt(data.mileage));
          setMileageDisplay(formatWithThousands(data.mileage.toString()));
        }
        if (data.registrationDate) {
          // Validate registration date - reject future dates
          const regDate = new Date(data.registrationDate);
          if (regDate <= new Date()) {
            form.setValue('first_registration_date', regDate);
          } else {}
        }
        if (data.vin) {
          form.setValue('chassis_number', data.vin);
        }
        setCarDataFetched(true);
        // Only show full form if there's no duplicate
        if (!isDuplicateRegNumber) {
          setShowFullForm(true);
        }
        toast({
          title: "Fordonsdata hämtad",
          description: data.fromCache ? "Fordonsinformation hämtad från cachad data (inga tokens användes)" : "Fordonsinformation har hämtats automatiskt"
        });
      } else {}
    } catch (error) {
      console.error('Error fetching car info:', error);
      toast({
        title: "Fel",
        description: "Kunde inte hämta fordonsdata: " + error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoadingCarInfo(false);
    }
  };

  // Check for duplicate registration numbers
  const checkForDuplicateRegNumber = async (regNumber: string) => {
    if (!user || !regNumber.trim()) {
      setIsDuplicateRegNumber(false);
      setDuplicateVehicleId(null);
      return false;
    }
    setIsCheckingRegNumber(true);
    try {
      const {
        data,
        error
      } = await supabase.from('inventory_items').select('id').eq('user_id', user.id).eq('registration_number', regNumber.trim()).limit(1);
      if (error) throw error;
      const isDuplicate = data && data.length > 0;
      setIsDuplicateRegNumber(isDuplicate);
      setDuplicateVehicleId(isDuplicate && data.length > 0 ? data[0].id : null);
      return isDuplicate;
    } catch (error) {
      console.error('Error checking for duplicate registration number:', error);
      setIsDuplicateRegNumber(false);
      setDuplicateVehicleId(null);
      return false;
    } finally {
      setIsCheckingRegNumber(false);
    }
  };

  // Watch for changes in registration number and check for duplicates only (no auto-fetch)
  useEffect(() => {
    const subscription = form.watch((value, {
      name
    }) => {
      // Only check for duplicates when registration_number field changes and has at least 4 characters
      // NO LONGER auto-fetch car info - wait for user to press Enter or click "Hämta"
      if (name === 'registration_number' && value.registration_number && value.registration_number.length >= 4) {
        const timeoutId = setTimeout(async () => {
          // Only check for duplicates (not fetch car info automatically)
          await checkForDuplicateRegNumber(value.registration_number as string);
        }, 1000); // Debounce for 1 second to allow user to finish typing

        return () => clearTimeout(timeoutId);
      } else if (name === 'registration_number' && (!value.registration_number || value.registration_number.length < 4)) {
        // Clear states when input is cleared or less than 4 characters
        setIsDuplicateRegNumber(false);
        setDuplicateVehicleId(null);
        setIsCheckingRegNumber(false);
        setIsLoadingCarInfo(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, user]);

  // Handle manual fetch trigger (Enter key or button click)
  const handleManualFetch = async () => {
    const regNumber = form.getValues("registration_number");
    if (!regNumber?.trim() || regNumber.length < 4) return;

    // Check for duplicates first
    const isDuplicate = await checkForDuplicateRegNumber(regNumber);

    // Only fetch car info if no duplicate was found
    if (!isDuplicate) {
      fetchCarInfo(regNumber);
    }
  };

  // Handle Enter key press in registration number input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleManualFetch();
    }
  };

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
    if (value === '' || /^\d+$/.test(value)) {
      const numValue = value === '' ? undefined : parseInt(value);
      form.setValue('mileage', numValue);
      setMileageDisplay(value === '' ? '' : formatWithThousands(value));
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
        form.trigger('purchase_price'); // Trigger validation
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

  // Auto-determine VAT type when relevant fields change
  useEffect(() => {
    const mileage = form.watch('mileage');
    const firstRegistrationDate = form.watch('first_registration_date');
    const purchaseChannel = form.watch('purchase_channel');
    const purchaseDate = form.watch('purchase_date');
    const currentVatType = form.watch('vat_type');

    // Only auto-determine if all required fields are filled AND no vat_type is currently set
    if (mileage && firstRegistrationDate && purchaseChannel && purchaseDate && !currentVatType) {
      try {
        const vatType = determineVatType({
          mileage,
          firstRegistrationDate,
          purchaseChannel,
          purchaseDate
        });
        form.setValue('vat_type', vatType);
      } catch (error) {
        console.error('Error determining VAT type:', error);
      }
    }
  }, [form.watch('mileage'), form.watch('first_registration_date'), form.watch('purchase_channel'), form.watch('purchase_date')]);

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!user) return;
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const filePath = `down-payment-docs/${fileName}`;
      const {
        error: uploadError
      } = await supabase.storage.from('down-payment-docs').upload(fileName, file);
      if (uploadError) throw uploadError;
      setUploadedFile(file);
      form.setValue('down_payment_document', filePath);
      toast({
        title: "Fil uppladdad",
        description: "Handpenningsdokument har laddats upp"
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Fel",
        description: "Det gick inte att ladda upp filen",
        variant: "destructive"
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
      const filePath = fileName; // Store just the file path without bucket prefix
      const {
        error: uploadError
      } = await supabase.storage.from('purchase-docs').upload(fileName, file);
      clearInterval(progressInterval);
      setUploadProgress(100);
      if (uploadError) throw uploadError;

      // Small delay to show 100% completion
      setTimeout(() => {
        setUploadedPurchaseDoc(file);
        form.setValue('purchase_documentation', filePath);
        form.trigger('purchase_documentation'); // Trigger validation
        setUploadProgress(0);
        toast({
          title: "Fil uppladdad",
          description: "Inköpsunderlag har laddats upp"
        });
      }, 500);
    } catch (error) {
      console.error('Error uploading purchase documentation:', error);
      setUploadProgress(0);
      toast({
        title: "Fel",
        description: "Det gick inte att ladda upp filen",
        variant: "destructive"
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

  // Check if all required fields are filled to enable submit button
  const isFormValid = () => {
    const registrationNumber = form.watch("registration_number");
    const purchaser = form.watch("purchaser");
    const purchasePrice = form.watch("purchase_price");
    const purchaseDate = form.watch("purchase_date");
    const vatType = form.watch("vat_type");
    return registrationNumber && registrationNumber.trim().length > 0 && purchaser && purchaser.trim().length > 0 && purchasePrice && purchasePrice > 0 && purchaseDate && vatType && vatType.trim().length > 0;
  };
  const onSubmit = async (data: PurchaseFormData) => {
    if (!user) return;

    // Double-check for duplicates right before submission
    const finalDuplicateCheck = await checkForDuplicateRegNumber(data.registration_number);

    // Prevent submission if there's a duplicate registration number
    if (isDuplicateRegNumber || finalDuplicateCheck) {
      toast({
        title: "Kan inte registrera",
        description: "Detta registreringsnummer finns redan. Du kan inte ha fler än ett fordon med samma registreringsnummer.",
        variant: "destructive"
      });
      return;
    }
    setIsSubmitting(true);
    try {
      // Get the user's organization_id from profiles table
      const {
        data: profileData,
        error: profileError
      } = await supabase.from('profiles').select('organization_id').eq('user_id', user.id).single();
      if (profileError || !profileData?.organization_id) {
        console.error('Organization lookup error:', profileError);
        throw new Error('Kunde inte hitta din organisation');
      }
      const insertData = {
        user_id: user.id,
        organization_id: profileData.organization_id,
        status: 'på_lager' as const,
        registration_number: data.registration_number,
        chassis_number: data.chassis_number || null,
        mileage: data.mileage || null,
        brand: data.brand?.trim() || "Saknas",
        // Properly handle empty strings and whitespace
        brand_other: data.brand_other || null,
        model: data.model || null,
        comment: data.comment || null,
        year_model: data.year_model || null,
        // Convert undefined/empty to null
        first_registration_date: data.first_registration_date?.toISOString().split('T')[0] || null,
        vat_type: data.vat_type || null,
        purchaser: data.purchaser,
        purchase_price: data.purchase_price,
        purchase_date: data.purchase_date.toISOString().split('T')[0],
        down_payment: data.down_payment || 0,
        down_payment_document_path: data.down_payment_document || null,
        purchase_documentation: data.purchase_documentation || null,
        purchase_channel: data.purchase_channel || null,
        purchase_channel_other: data.purchase_channel_other || null
      };
      const {
        data: insertedItem,
        error
      } = await supabase.from('inventory_items').insert(insertData).select('id').single();
      if (error) throw error;
      toast({
        title: "Framgång",
        description: "Fordon har lagts till i lagret"
      });

      // Auto-sync removed - user must manually sync via sync button

      form.reset();
      onSuccess();
    } catch (error) {
      console.error('Error creating purchase:', error);
      toast({
        title: "Fel",
        description: "Det gick inte att lägga till fordonet",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  return <Card className="bg-card border rounded-lg">
      <CardHeader>
      </CardHeader>
      <CardContent>
        {!showFullForm ? <div className="space-y-4">
            <div className="text-center">
              <p className="text-foreground mb-6">Ange fordonets registreringsnummer för att hämta fordonsinformation</p>
            </div>
            
            <div className="max-w-md mx-auto">
              <Label htmlFor="registration_number"></Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input id="registration_number" placeholder="t.ex. JSK15L" {...form.register("registration_number")} onKeyPress={handleKeyPress} className={cn(form.formState.errors.registration_number && "border-destructive", isDuplicateRegNumber && "border-destructive", (isCheckingRegNumber || isLoadingCarInfo) && "pr-10" // Add padding for spinner
              )} />
                  {(isCheckingRegNumber || isLoadingCarInfo) && <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                    </div>}
                </div>
                <Button type="button" onClick={handleManualFetch} disabled={isCheckingRegNumber || isLoadingCarInfo} className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
                  Hämta
                </Button>
              </div>
              
              <div className="text-center mt-4">
                <p className="text-sm text-muted-foreground">
                  Har du endast VIN-kod? Inga problem,<br />
                  du kan{" "}
                  <button type="button" onClick={() => setShowFullForm(true)} className="text-blue-600 hover:text-blue-700 underline">
                    fortsätta utan automatisk hämtning
                  </button>
                </p>
              </div>
              {isDuplicateRegNumber && <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-md">
                  <p className="text-sm text-orange-800 mb-2">
                    Detta registreringsnummer finns redan registrerat i systemet.
                  </p>
                  {duplicateVehicleId && <Button type="button" variant="outline" size="sm" onClick={() => {
              // Just show a message since logistics view is removed
              toast({
                title: "Fordon finns redan",
                description: "Detta registreringsnummer är redan registrerat i systemet."
              });
            }} className="flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Fordon redan registrerat
                    </Button>}
                </div>}
                  {form.formState.errors.registration_number && <p className="text-sm text-destructive mt-1 absolute">
                      {form.formState.errors.registration_number.message}
                    </p>}
            </div>
          </div> : <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="fordonsdata">Fordonsinformation</TabsTrigger>
              <TabsTrigger value="inkopsinformation" disabled={!isVehicleDataValid()} className={!isVehicleDataValid() ? "cursor-not-allowed opacity-50" : ""}>
                Inköpsinformation
              </TabsTrigger>
            </TabsList>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <TabsContent value="fordonsdata" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="registration_number">Registreringsnummer*</Label>
                    <div className="relative">
                      <Input id="registration_number" placeholder="t.ex. JSK15L eller 1234567890ABCDEFG" {...form.register("registration_number")} className={cn(form.formState.errors.registration_number && "border-destructive", isDuplicateRegNumber && "border-destructive", "pr-20" // Add padding for radio buttons
                  )} readOnly={carDataFetched} />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <span className="text-sm text-muted-foreground">
                          {form.watch("registration_number")?.length === 17 ? "VIN" : "REG"}
                        </span>
                      </div>
                    </div>
                     {form.formState.errors.registration_number && <p className="text-sm text-destructive mt-1 absolute">
                         {form.formState.errors.registration_number.message}
                       </p>}
                  </div>

                <div>
                  <Label htmlFor="brand">Märke</Label>
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" aria-expanded={open} className={cn("w-full justify-between font-normal", !form.watch("brand") && "text-muted-foreground")}>
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
                            {carBrands.map(brand => <CommandItem key={brand} value={brand} onSelect={currentValue => {
                            form.setValue("brand", currentValue === form.watch("brand") ? "" : currentValue);
                            if (currentValue !== "Annat") {
                              form.setValue("brand_other", undefined);
                            }
                            setOpen(false);
                          }}>
                                <Check className={cn("mr-2 h-4 w-4", form.watch("brand") === brand ? "opacity-100" : "opacity-0")} />
                                {brand}
                              </CommandItem>)}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {form.formState.errors.brand && <p className="text-sm text-destructive mt-1 absolute">
                      {form.formState.errors.brand.message}
                    </p>}
                </div>

                {form.watch("brand") === "Annat" && <div>
                    <Label htmlFor="brand_other">Ange märke</Label>
                    <Input id="brand_other" {...form.register("brand_other")} placeholder="t.ex. Batmobile" />
                  </div>}

                <div>
                  <Label htmlFor="model">Modell</Label>
                  <Input id="model" {...form.register("model")} placeholder="t.ex. XC60" />
                </div>

                <div>
                  <Label htmlFor="year_model">Modellår</Label>
                  <Input id="year_model" type="number" min="1981" max={new Date().getFullYear() + 2} placeholder="t.ex. 2020" {...form.register("year_model", {
                  setValueAs: value => value === "" ? undefined : Number(value)
                })} />
                  {form.formState.errors.year_model && <p className="text-sm text-destructive mt-1 absolute">
                      {form.formState.errors.year_model.message}
                    </p>}
                </div>

                <div>
                  <Label htmlFor="mileage">Miltal (mil) *</Label>
                  <Input id="mileage" type="text" min="0" value={mileageDisplay} onChange={handleMileageChange} placeholder="t.ex. 4,500" />
                  {form.formState.errors.mileage && <p className="text-sm text-destructive mt-1 absolute">
                      {form.formState.errors.mileage.message}
                    </p>}
                </div>

                <div>
                  <Label>Första datum i trafik *</Label>
                  <Popover open={firstRegOpen} onOpenChange={setFirstRegOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.watch("first_registration_date") && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.watch("first_registration_date") ? format(form.watch("first_registration_date")!, "PPP", {
                        locale: sv
                      }) : <span>Välj datum</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-4" align="start">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-sm">År</Label>
                            <Select value={selectedYear?.toString() || ""} onValueChange={value => setSelectedYear(parseInt(value))}>
                              <SelectTrigger>
                                <SelectValue placeholder="Välj år" />
                              </SelectTrigger>
                              <SelectContent className="max-h-48">
                                {yearOptions.map(year => <SelectItem key={year} value={year.toString()}>
                                    {year}
                                  </SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <Label className="text-sm">Månad</Label>
                            <Select value={selectedMonth?.toString() || ""} onValueChange={value => setSelectedMonth(parseInt(value))}>
                              <SelectTrigger>
                                <SelectValue placeholder="Välj månad" />
                              </SelectTrigger>
                              <SelectContent>
                                {monthNames.map((month, index) => <SelectItem key={index} value={index.toString()}>
                                    {month}
                                  </SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        {selectedYear && selectedMonth !== null && <Calendar mode="single" selected={form.watch("first_registration_date")} onSelect={date => {
                        if (date) {
                          form.setValue("first_registration_date", date);
                          setFirstRegOpen(false);
                        }
                      }} month={new Date(selectedYear, selectedMonth)} onMonthChange={date => {
                        setSelectedYear(date.getFullYear());
                        setSelectedMonth(date.getMonth());
                      }} className="rounded-md border pointer-events-auto" disabled={date => date > new Date() || date.getFullYear() !== selectedYear || date.getMonth() !== selectedMonth} />}
                        
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => {
                          form.setValue("first_registration_date", undefined);
                          setSelectedYear(null);
                          setSelectedMonth(null);
                          setFirstRegOpen(false);
                        }} className="flex-1">
                            Rensa
                          </Button>
                          <Button onClick={() => setFirstRegOpen(false)} className="flex-1">
                            Klar
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  {form.formState.errors.first_registration_date && <p className="text-sm text-destructive mt-1 absolute">
                      {form.formState.errors.first_registration_date.message}
                    </p>}
                </div>

              </div>


              <div className="flex justify-end">
                <Button type="button" onClick={() => setActiveTab("inkopsinformation")} disabled={!isVehicleDataValid()} className="bg-blue-600 hover:bg-blue-700 text-white">
                  Fortsätt
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="inkopsinformation" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Inköpare */}
                <div>
                  <Label htmlFor="purchaser">Inköpare*</Label>
                  <Select value={form.watch("purchaser") || ""} onValueChange={value => form.setValue("purchaser", value)}>
                    <SelectTrigger className={cn("w-full bg-background", form.formState.errors.purchaser ? "border-destructive" : "")}>
                      <SelectValue placeholder="Välj inköpare" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      {organizationUsers.map(user => <SelectItem key={user.user_id} value={user.full_name} className="cursor-pointer hover:bg-accent">
                          {user.full_name}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.purchaser && <p className="text-sm text-destructive mt-1 absolute">
                      {form.formState.errors.purchaser.message}
                    </p>}
                </div>

                {/* 2. Inköpsdatum */}
                <div>
                  <Label htmlFor="purchase_date">Inköpsdatum*</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.watch("purchase_date") ? format(form.watch("purchase_date"), "yyyy-MM-dd") : "Välj datum"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={form.watch("purchase_date")} onSelect={date => form.setValue("purchase_date", date || new Date())} className="pointer-events-auto" disabled={date => date > new Date()} />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* 3. Inköpskanal */}
                <div>
                  <Label htmlFor="purchase_channel">Säljare</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                       <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal", !form.watch("purchase_channel") && "text-muted-foreground")}>
                         {form.watch("purchase_channel") || "Välj säljarkategori"}
                         <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandList>
                          <CommandGroup>
                            {purchaseChannels.map(channel => <CommandItem key={channel} value={channel} onSelect={() => {
                            if (channel === "Privatperson") {
                              form.setValue("purchase_channel", channel);
                              // No need to check against "Annan" since we're only allowing "Privatperson"
                              form.setValue("purchase_channel_other", undefined);
                            }
                          }} disabled={channel !== "Privatperson"} className={channel !== "Privatperson" ? "opacity-50 cursor-not-allowed" : ""}>
                                <Check className={cn("mr-2 h-4 w-4", form.watch("purchase_channel") === channel ? "opacity-100" : "opacity-0")} />
                                {channel}
                                {channel !== "Privatperson" && <span className="ml-2 text-xs text-muted-foreground">(kommer snart)</span>}
                              </CommandItem>)}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {form.watch("purchase_channel") === "Annan" && <div>
                    <Label htmlFor="purchase_channel_other">Ange inköpskanal</Label>
                    <Input id="purchase_channel_other" {...form.register("purchase_channel_other")} placeholder="Ange vilken inköpskanal" />
                  </div>}

                {/* Marketplace section removed as it's no longer in the dropdown */}

                {/* 4. Inköpspris */}
                <div>
                  <Label htmlFor="purchase_price">Inköpspris (inkl. moms) *</Label>
                  <div className="relative">
                    <Input id="purchase_price" type="text" value={priceDisplay} onChange={handlePriceChange} placeholder="t.ex. 150,000" className={cn("pr-20", form.formState.errors.purchase_price ? "border-destructive" : "")} />
                    <div className="absolute inset-y-0 right-0 flex items-center">
                      <Select value={purchasePriceCurrency} onValueChange={setPurchasePriceCurrency}>
                        <SelectTrigger className="w-16 h-8 border-0 bg-transparent text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SEK">SEK</SelectItem>
                          <SelectItem value="NOK" disabled className="text-muted-foreground">NOK</SelectItem>
                          <SelectItem value="DKK" disabled className="text-muted-foreground">DKK</SelectItem>
                          <SelectItem value="EUR" disabled className="text-muted-foreground">EUR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {form.formState.errors.purchase_price && <p className="text-sm text-destructive mt-1 absolute">
                      {form.formState.errors.purchase_price.message}
                    </p>}
                </div>

                {/* 5. Momsmetod - Auto-determined */}
                <div>
                  <div className="flex items-center gap-2">
                    <Label>Momsmetod*</Label>
                    <InfoPopup title="Momsmetod för köp från privatperson">
                      <div className="space-y-2">
                        <p><strong>Momspliktig bil</strong> tillämpas när BÅDA följande villkor är uppfyllda:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>Fordonet har färdats högst 6000 km</li>
                          <li>Fordonet har varit i trafik i högst 6 månader efter första registrering</li>
                        </ul>
                        <p className="mt-2"><strong>Vinstmarginalbeskattning (VMB)</strong> tillämpas i alla andra fall.</p>
                        <p className="mt-2 text-muted-foreground text-sm">Du kan ändra detta manuellt om det behövs.</p>
                      </div>
                    </InfoPopup>
                  </div>
                  <RadioGroup value={form.watch("vat_type")} onValueChange={value => form.setValue("vat_type", value)} className="flex flex-row gap-6 mt-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="VMB" id="vmb" />
                      <Label htmlFor="vmb" className="font-normal cursor-pointer">Vinstmarginalbeskattning (VMB)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="MOMS" id="moms" />
                      <Label htmlFor="moms" className="font-normal cursor-pointer">Moms (25%)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="VMBI" id="import-vmb" />
                      <Label htmlFor="import-vmb" className="font-normal cursor-pointer">Import (VMB)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="MOMSI" id="import-moms" />
                      <Label htmlFor="import-moms" className="font-normal cursor-pointer">Import (MOMS)</Label>
                    </div>
                  </RadioGroup>
                  {form.formState.errors.vat_type && <p className="text-sm text-destructive mt-1 absolute">
                      {form.formState.errors.vat_type.message}
                    </p>}
                </div>

                {/* 6. Handpenning */}
                <div>
                  <Label htmlFor="down_payment">Handpenning</Label>
                  <div className="relative">
                    <Input id="down_payment" type="text" value={downPaymentDisplay} onChange={handleDownPaymentChange} placeholder="t.ex. 25,000" className="pr-20" />
                    <div className="absolute inset-y-0 right-0 flex items-center">
                      <Select value={downPaymentCurrency}>
                        <SelectTrigger className="w-16 h-8 border-0 bg-transparent text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SEK">SEK</SelectItem>
                          <SelectItem value="NOK" disabled className="text-muted-foreground">NOK</SelectItem>
                          <SelectItem value="DKK" disabled className="text-muted-foreground">DKK</SelectItem>
                          <SelectItem value="EUR" disabled className="text-muted-foreground">EUR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {form.formState.errors.down_payment && <p className="text-sm text-destructive mt-1 absolute">
                      {form.formState.errors.down_payment.message}
                    </p>}
                </div>

                {/* File upload for down payment documentation */}
                {form.watch("down_payment") > 0 && <div>
                    <Label htmlFor="down_payment_document">Handpenningsunderlag</Label>
                    <div className="space-y-2">
                      {!uploadedFile ? <div>
                          <div className="relative">
                            <Input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileUpload(file);
                        }
                      }} disabled={isUploading} className="hidden" id="file-upload" />
                            <Button type="button" variant="outline" className="w-full justify-start text-left font-normal" onClick={() => document.getElementById('file-upload')?.click()} disabled={isUploading}>
                              <Upload className="mr-2 h-4 w-4" />
                              Välj fil
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground">Ingen fil vald</p>
                          {isUploading && <p className="text-sm text-muted-foreground">Laddar upp fil...</p>}
                        </div> : <div className="flex items-center justify-between p-2 border rounded-md bg-muted/50">
                          <div className="flex items-center space-x-2">
                            <Upload className="h-4 w-4" />
                            <span className="text-sm">{uploadedFile.name}</span>
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={handleFileRemove}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>}
                     </div>
                     {form.formState.errors.down_payment_document && <p className="text-sm text-destructive mt-1 absolute">
                         {typeof form.formState.errors.down_payment_document.message === 'string' ? form.formState.errors.down_payment_document.message : "Handpenningsunderlag krävs när handpenning anges"}
                       </p>}
                   </div>}

                {/* 7. Anteckning - moved below handpenning and greyed out */}
                <div>
                  <Label htmlFor="comment">Anteckning</Label>
                  <Input id="comment" {...form.register("comment")} placeholder="Lägg till en anteckning om fordonet..." />
                </div>

                {/* 8. Inköpsunderlag - moved to same row as Anteckning */}
                <div>
                  <Label htmlFor="purchase_documentation">Inköpsunderlag</Label>
                  {!uploadedPurchaseDoc ? <div>
                        <div className="relative">
                          <Input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handlePurchaseDocUpload(file);
                      }
                    }} disabled={isUploadingPurchaseDoc} className="hidden" id="purchase-doc-upload" />
                          <Button type="button" variant="outline" className="w-full justify-start text-left font-normal h-9" onClick={() => document.getElementById('purchase-doc-upload')?.click()} disabled={isUploadingPurchaseDoc}>
                            <Upload className="mr-2 h-4 w-4" />
                            Välj fil (max 5mb)
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">Ingen fil vald</p>
                        {isUploadingPurchaseDoc && <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Progress value={uploadProgress} className="flex-1 h-2" />
                              <span className="text-sm text-muted-foreground min-w-[3rem]">
                                {Math.round(uploadProgress)}%
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground animate-pulse">
                              Laddar upp fil...
                            </p>
                          </div>}
                      </div> : <div className="flex items-center justify-between p-2 border rounded-md bg-muted/50">
                        <div className="flex items-center space-x-2">
                          <Upload className="h-4 w-4" />
                          <span className="text-sm truncate max-w-48">{uploadedPurchaseDoc.name}</span>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={handlePurchaseDocRemove}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>}
                    {form.formState.errors.purchase_documentation && <p className="text-sm text-destructive mt-1 absolute">
                        {form.formState.errors.purchase_documentation.message}
                      </p>}
                  </div>

                {/* Additional Marknadsplats section removed as it's no longer needed */}
              </div>


              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setActiveTab("fordonsdata")} className="flex items-center gap-1">
                  <ChevronLeft className="h-4 w-4" /> Tillbaka
                </Button>
                <Button type="submit" disabled={isSubmitting || !isFormValid()} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? "Registrerar..." : "Registrera"} <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>
          </form>
        </Tabs>}
      </CardContent>
    </Card>;
};