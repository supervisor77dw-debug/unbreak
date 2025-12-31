// Debug endpoint - Check environment and database
import { createClient } from '@supabase/supabase-js';
import prisma from '../../../lib/prisma';

export default async function handler(req, res) {
  const checks = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    checks: {},
  };

  // 1. Check Supabase URL
  checks.checks.supabaseUrl = {
    set: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    value: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing',
  };

  // 2. Check Supabase Anon Key
  checks.checks.supabaseAnonKey = {
    set: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set (length: ' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length + ')' : 'Missing',
  };

  // 3. Check Supabase Service Role Key (CRITICAL for uploads)
  checks.checks.supabaseServiceRoleKey = {
    set: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    value: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set (length: ' + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ')' : 'MISSING - Required for uploads!',
  };

  // 4. Check Database URL
  checks.checks.databaseUrl = {
    set: !!process.env.DATABASE_URL,
    value: process.env.DATABASE_URL ? 'Set' : 'Missing',
  };

  // 5. Check Prisma
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.checks.prismaConnection = {
      status: 'OK',
      message: 'Connected to database',
    };
  } catch (err) {
    checks.checks.prismaConnection = {
      status: 'FAILED',
      error: err.message,
    };
  }

  // 6. Check Supabase Storage
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      const { data, error } = await supabase.storage.listBuckets();
      
      if (error) {
        checks.checks.supabaseStorage = {
          status: 'FAILED',
          error: error.message,
        };
      } else {
        checks.checks.supabaseStorage = {
          status: 'OK',
          buckets: data.map(b => b.name),
          hasProductImages: data.some(b => b.name === 'product-images'),
        };
      }
    } catch (err) {
      checks.checks.supabaseStorage = {
        status: 'FAILED',
        error: err.message,
      };
    }
  } else {
    checks.checks.supabaseStorage = {
      status: 'SKIPPED',
      message: 'Missing Supabase credentials',
    };
  }

  // 7. Check Products table structure
  try {
    const product = await prisma.product.findFirst({
      select: {
        id: true,
        sku: true,
        imagePath: true,
        imageUrl: true,
        badgeLabel: true,
        shippingText: true,
        highlights: true,
      },
    });
    
    checks.checks.productsTable = {
      status: 'OK',
      hasNewFields: true,
      sampleProduct: product ? {
        id: product.id,
        sku: product.sku,
        hasImagePath: !!product.imagePath,
        hasImageUrl: !!product.imageUrl,
      } : 'No products found',
    };
  } catch (err) {
    checks.checks.productsTable = {
      status: 'FAILED',
      error: err.message,
      hint: err.message.includes('imagePath') || err.message.includes('image_path') 
        ? 'Migration not run - missing new fields'
        : 'Unknown error',
    };
  }

  // Summary
  const allOk = Object.values(checks.checks).every(check => 
    check.status === 'OK' || check.set === true
  );

  res.status(allOk ? 200 : 500).json({
    ...checks,
    summary: allOk ? 'All checks passed' : 'Some checks failed - see details above',
  });
}
