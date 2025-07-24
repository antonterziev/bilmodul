import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Car } from 'lucide-react';

interface BrandLogoResult {
  logoUrl: string | null;
  isLoading: boolean;
  error: string | null;
  fromCache: boolean;
  fallbackIcon: React.ComponentType<any> | null;
}

export const useBrandLogo = (brandName: string): BrandLogoResult => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    if (!brandName || brandName === 'Annat') {
      setLogoUrl(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const fetchLogo = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // First check if we have the logo in our database
        const { data: existingLogo, error: dbError } = await supabase
          .from('brand_logos')
          .select('logo_url')
          .eq('brand_name', brandName.toLowerCase())
          .single();

        if (existingLogo && !dbError) {
          setLogoUrl(existingLogo.logo_url);
          setFromCache(true);
          setIsLoading(false);
          return;
        }

        // If not in database, call the edge function to fetch it
        
        const { data, error: functionError } = await supabase.functions.invoke('fetch-brand-logo', {
          body: { brandName }
        });

        if (functionError) {
          console.error('Error fetching brand logo:', functionError);
          setError('Failed to fetch logo');
          setLogoUrl(null);
        } else if (data && data.logoUrl) {
          setLogoUrl(data.logoUrl);
          setFromCache(data.fromCache || false);
        } else {
          setLogoUrl(null);
          setFromCache(false);
        }
      } catch (err) {
        console.error('Error in useBrandLogo:', err);
        setError('Failed to fetch logo');
        setLogoUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogo();
  }, [brandName]);

  return { 
    logoUrl, 
    isLoading, 
    error, 
    fromCache, 
    fallbackIcon: !logoUrl && !isLoading ? Car : null 
  };
};