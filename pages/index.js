import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    // Redirect to index.html (served from public/)
    window.location.href = '/index.html';
  }, []);

  return null;
}
