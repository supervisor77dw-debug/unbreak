import { useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * DEPRECATED: /admin/pricing
 * 
 * Diese Route ist überflüssig - Pricing wird jetzt in /admin/products verwaltet
 * (PricingConfigSection.jsx mit korrekter 5-Farben-Logik für Adapter)
 * 
 * Redirect zu /admin/products
 */
export default function PricingConfigPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/products');
  }, [router]);

  return null;
}
