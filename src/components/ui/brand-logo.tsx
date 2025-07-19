import { Car } from 'lucide-react';
import { useBrandLogo } from '@/hooks/useBrandLogo';
import { Skeleton } from '@/components/ui/skeleton';

interface BrandLogoProps {
  brandName: string;
  className?: string;
  fallbackClassName?: string;
}

export const BrandLogo = ({ brandName, className = "h-12 w-12", fallbackClassName }: BrandLogoProps) => {
  const { logoUrl, isLoading, error } = useBrandLogo(brandName);

  if (isLoading) {
    return <Skeleton className={className} />;
  }

  if (error || !logoUrl) {
    return <Car className={`${fallbackClassName || className} text-muted-foreground`} />;
  }

  return (
    <img 
      src={logoUrl} 
      alt={`${brandName} logo`} 
      className={`${className} object-contain`}
      onError={(e) => {
        // Fallback to car icon if image fails to load
        const target = e.target as HTMLImageElement;
        target.style.display = 'none';
        target.parentElement?.appendChild(
          Object.assign(document.createElement('div'), {
            innerHTML: `<svg class="${fallbackClassName || className} text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l-7-7 7-7m5 14l-7-7 7-7"></path></svg>`
          })
        );
      }}
    />
  );
};