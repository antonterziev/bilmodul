
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BrandLogoBatchResult {
  logos: Record<string, string | null>;
  isLoading: boolean;
  error: string | null;
}

export const useBrandLogoBatch = (brandNames: string[]): BrandLogoBatchResult => {
  const [logos, setLogos] = useState<Record<string, string | null>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const batchRef = useRef<string[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (brandNames.length === 0) return;

    // Filter out brands we already have or are already fetching
    const newBrands = brandNames.filter(brand => 
      brand && brand !== 'Annat' && !logos[brand] && !batchRef.current.includes(brand)
    );

    if (newBrands.length === 0) return;

    // Add to pending batch
    batchRef.current = [...batchRef.current, ...newBrands];

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Batch requests with debouncing
    timeoutRef.current = setTimeout(async () => {
      const brandsToFetch = [...batchRef.current];
      batchRef.current = [];

      if (brandsToFetch.length === 0) return;

      setIsLoading(true);
      setError(null);

      try {
        // First check database for existing logos
        const { data: existingLogos, error: dbError } = await supabase
          .from('brand_logos')
          .select('brand_name, logo_url')
          .in('brand_name', brandsToFetch.map(b => b.toLowerCase()));

        if (dbError) throw dbError;

        const existingMap: Record<string, string> = {};
        const missingBrands: string[] = [];

        existingLogos?.forEach(logo => {
          const originalBrand = brandsToFetch.find(b => 
            b.toLowerCase() === logo.brand_name
          );
          if (originalBrand) {
            existingMap[originalBrand] = logo.logo_url;
          }
        });

        // Find brands not in database
        brandsToFetch.forEach(brand => {
          if (!existingMap[brand]) {
            missingBrands.push(brand);
          }
        });

        // Update state with existing logos
        setLogos(prev => ({ ...prev, ...existingMap }));

        // Fetch missing logos from API
        if (missingBrands.length > 0) {
          const { data, error: functionError } = await supabase.functions.invoke('fetch-brand-logo', {
            body: { brandNames: missingBrands }
          });

          if (functionError) {
            console.error('Error fetching brand logos:', functionError);
            // Set null for failed brands
            const failedMap: Record<string, string | null> = {};
            missingBrands.forEach(brand => {
              failedMap[brand] = null;
            });
            setLogos(prev => ({ ...prev, ...failedMap }));
          } else if (data && data.logos) {
            setLogos(prev => ({ ...prev, ...data.logos }));
          }
        }
      } catch (err) {
        console.error('Error in useBrandLogoBatch:', err);
        setError('Failed to fetch brand logos');
        
        // Set null for all failed brands
        const failedMap: Record<string, string | null> = {};
        brandsToFetch.forEach(brand => {
          failedMap[brand] = null;
        });
        setLogos(prev => ({ ...prev, ...failedMap }));
      } finally {
        setIsLoading(false);
      }
    }, 100); // 100ms debounce

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [brandNames, logos]);

  return { logos, isLoading, error };
};
