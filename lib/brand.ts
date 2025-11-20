import { useSettings } from "./useSettings";

export interface BrandConfig {
  name: string;
  logo?: string;
  colors: {
    primary: string;
    primaryDark: string;
    accentBlue: string;
    accentGrey: string;
    background: string;
  };
  font: {
    heading: string;
    body: string;
  };
}

// Default Peters & May brand configuration
export const defaultBrand: BrandConfig = {
  name: "Peters & May",
  logo: undefined, // Logo will be uploaded via Settings
  colors: {
    primary: "#e10600",
    primaryDark: "#b00000",
    accentBlue: "#003756",
    accentGrey: "#4a4f54",
    background: "#f5f7fa",
  },
  font: {
    heading: "League Spartan, sans-serif",
    body: "Inter, sans-serif",
  },
};

/**
 * Get brand configuration, optionally merged with settings
 */
export function getBrand(): BrandConfig {
  // In the future, this can merge with settings.branding_colors
  // For now, return default brand
  return defaultBrand;
}

