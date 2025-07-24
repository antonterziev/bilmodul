import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface VatDeterminationParams {
  mileage: number;
  firstRegistrationDate: Date;
  purchaseChannel: string;
  purchaseDate: Date;
}

/**
 * Determines VAT type for vehicle purchases from private individuals
 * Returns "Moms" if BOTH conditions are met:
 * 1. Mileage ≤ 6000 km AND
 * 2. In traffic for ≤ 6 months after first registration
 * Otherwise returns "VMB"
 */
export function determineVatType({
  mileage,
  firstRegistrationDate,
  purchaseChannel,
  purchaseDate
}: VatDeterminationParams): string {
  // Only apply logic for purchases from private individuals
  if (purchaseChannel !== "Privatperson") {
    return "VMB"; // Default for non-private purchases
  }

  // Calculate months between first registration and purchase date
  const monthsDiff = (purchaseDate.getFullYear() - firstRegistrationDate.getFullYear()) * 12 + 
                     (purchaseDate.getMonth() - firstRegistrationDate.getMonth());

  // Check BOTH conditions for "Moms"
  const isLowMileage = mileage <= 6000;
  const isRecentRegistration = monthsDiff <= 6;

  // Both conditions must be true for "Moms"
  if (isLowMileage && isRecentRegistration) {
    return "Moms (25%)";
  }

  return "Vinstmarginalbeskattning (VMB)";
}
