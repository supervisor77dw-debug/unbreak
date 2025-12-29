// MINIMAL TEST - Kein Supabase, nur reines React
export default function MyProducts() {
  return (
    <div style={{ padding: '100px 20px', textAlign: 'center' }}>
      <h1>🧪 ISOLATED TEST</h1>
      <p>If you see this, routing works. Problem is Supabase/ENV init.</p>
      <p>ENV Check:</p>
      <pre style={{ background: '#1a1a1a', padding: '20px', borderRadius: '8px', textAlign: 'left', maxWidth: '600px', margin: '20px auto' }}>
        {JSON.stringify({
          hasPublicUrl: typeof process.env.NEXT_PUBLIC_SUPABASE_URL !== 'undefined',
          hasPublicKey: typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'undefined',
          publicUrlValue: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
        }, null, 2)}
      </pre>
    </div>
  );
}

/* ORIGINAL CODE - COMMENTED OUT FOR TEST
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { getSupabasePublic } from '../lib/supabase';
import Layout from '../components/Layout';

export default function MyProducts() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

... REST COMMENTED OUT FOR MINIMAL TEST ...
*/
