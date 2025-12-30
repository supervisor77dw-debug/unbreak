import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AdminProducts() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to unified backend with pending filter
    router.replace('/backend/products?filter=pending');
  }, []);

  return null;
}
