// ULTRA-MINIMAL TEST - Absolut minimaler Next.js Page Export
export default function MyProducts() {
  return <div>TEST WORKS</div>;
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
