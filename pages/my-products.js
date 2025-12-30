import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function MyProducts() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to unified backend
    router.replace('/backend/products');
  }, []);

  return null;
}
