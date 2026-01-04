#!/usr/bin/env node
/**
 * E2E AUTOMATED TEST SUITE
 * Tests complete checkout flow with trace verification
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test configuration
const TEST_CONFIG = {
  trace_id: null,  // Will be generated
  test_email: `test-${Date.now()}@unbreak.test`,
  colors: {
    base: 'graphite',
    top: 'anthracite',
    middle: 'steel'
  },
  finish: 'matte',
  product: 'glass_holder'
};

// Log storage
const logs = [];
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const entry = { timestamp, level, message, data };
  logs.push(entry);
  
  const icon = {
    'INFO': 'ℹ️',
    'SUCCESS': '✅',
    'ERROR': '❌',
    'WARN': '⚠️',
    'DEBUG': '🔍'
  }[level] || '📝';
  
  console.log(`${icon} [${level}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

// Generate trace ID
function generateTraceId() {
  return `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// SQL Verification Queries
const QUERIES = {
  findOrderByTraceId: (trace_id) => `
    SELECT 
      id,
      trace_id,
      status,
      customer_email,
      customer_name,
      customer_id,
      stripe_customer_id,
      stripe_checkout_session_id,
      config_json,
      created_at
    FROM public.simple_orders
    WHERE trace_id = '${trace_id}'
    ORDER BY created_at DESC
    LIMIT 1;
  `,
  
  findCustomerByEmail: (email) => `
    SELECT 
      id,
      email,
      name,
      stripe_customer_id,
      created_at,
      updated_at
    FROM public.customers
    WHERE email = '${email}'
    ORDER BY created_at DESC
    LIMIT 5;
  `,
  
  findOrdersByEmail: (email) => `
    SELECT 
      id,
      trace_id,
      customer_email,
      customer_id,
      status,
      config_json->'colors' as colors,
      created_at
    FROM public.simple_orders
    WHERE customer_email = '${email}'
    ORDER BY created_at DESC
    LIMIT 10;
  `,
  
  checkCustomerOrderLink: (trace_id) => `
    SELECT 
      o.id as order_id,
      o.trace_id,
      o.customer_email,
      o.customer_id,
      c.email as customer_table_email,
      c.stripe_customer_id,
      c.name as customer_name,
      o.config_json
    FROM public.simple_orders o
    LEFT JOIN public.customers c ON o.customer_id = c.id
    WHERE o.trace_id = '${trace_id}'
    ORDER BY o.created_at DESC;
  `
};

// Test Steps
async function test1_VerifySchemaExists() {
  log('INFO', 'TEST 1: Verify Database Schema');
  
  try {
    // Check if trace_id column exists
    const { data: columns, error } = await supabase
      .from('simple_orders')
      .select('*')
      .limit(1);
    
    if (error) throw error;
    
    const requiredColumns = [
      'trace_id',
      'customer_id',
      'customer_email',
      'config_json',
      'stripe_customer_id'
    ];
    
    if (columns && columns.length > 0) {
      const row = columns[0];
      const missingColumns = requiredColumns.filter(col => !(col in row));
      
      if (missingColumns.length > 0) {
        log('ERROR', 'Missing required columns', { missingColumns });
        return false;
      }
    }
    
    log('SUCCESS', 'All required columns exist');
    return true;
  } catch (error) {
    log('ERROR', 'Schema verification failed', { error: error.message });
    return false;
  }
}

async function test2_CreateTestOrder() {
  log('INFO', 'TEST 2: Create Test Order with Trace ID');
  
  TEST_CONFIG.trace_id = generateTraceId();
  log('INFO', `Generated trace_id: ${TEST_CONFIG.trace_id}`);
  
  try {
    const { data, error } = await supabase
      .from('simple_orders')
      .insert({
        trace_id: TEST_CONFIG.trace_id,
        customer_email: TEST_CONFIG.test_email,
        product_sku: 'UNBREAK-GLAS-01',
        quantity: 1,
        total_amount_cents: 9900,
        currency: 'EUR',
        status: 'pending',
        order_type: 'configured',
        config_json: {
          colors: TEST_CONFIG.colors,
          finish: TEST_CONFIG.finish,
          product: TEST_CONFIG.product
        }
      })
      .select()
      .single();
    
    if (error) throw error;
    
    log('SUCCESS', 'Test order created', {
      order_id: data.id,
      trace_id: data.trace_id,
      has_config_json: !!data.config_json
    });
    
    return data;
  } catch (error) {
    log('ERROR', 'Failed to create test order', { error: error.message });
    return null;
  }
}

async function test3_VerifyOrderPersistence() {
  log('INFO', 'TEST 3: Verify Order Persistence');
  
  try {
    const { data, error } = await supabase
      .from('simple_orders')
      .select('*')
      .eq('trace_id', TEST_CONFIG.trace_id)
      .single();
    
    if (error) throw error;
    if (!data) {
      log('ERROR', 'Order not found by trace_id');
      return false;
    }
    
    // Verify config_json
    const hasColors = data.config_json && data.config_json.colors;
    const colorsMatch = hasColors && 
      data.config_json.colors.base === TEST_CONFIG.colors.base &&
      data.config_json.colors.top === TEST_CONFIG.colors.top;
    
    log(colorsMatch ? 'SUCCESS' : 'ERROR', 'Config verification', {
      expected_colors: TEST_CONFIG.colors,
      actual_colors: data.config_json?.colors,
      match: colorsMatch
    });
    
    return colorsMatch;
  } catch (error) {
    log('ERROR', 'Order verification failed', { error: error.message });
    return false;
  }
}

async function test4_CreateCustomer() {
  log('INFO', 'TEST 4: Create Customer Record');
  
  try {
    const { data, error } = await supabase
      .from('customers')
      .upsert({
        email: TEST_CONFIG.test_email,
        name: 'Test User',
        stripe_customer_id: `cus_test_${Date.now()}`
      }, {
        onConflict: 'email',
        ignoreDuplicates: false
      })
      .select()
      .single();
    
    if (error) throw error;
    
    log('SUCCESS', 'Customer created/updated', {
      customer_id: data.id,
      email: data.email
    });
    
    return data;
  } catch (error) {
    log('ERROR', 'Customer creation failed', { error: error.message });
    return null;
  }
}

async function test5_LinkOrderToCustomer() {
  log('INFO', 'TEST 5: Link Order to Customer');
  
  try {
    // Get customer
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', TEST_CONFIG.test_email)
      .single();
    
    if (!customer) {
      log('ERROR', 'Customer not found');
      return false;
    }
    
    // Update order
    const { data, error } = await supabase
      .from('simple_orders')
      .update({
        customer_id: customer.id,
        customer_name: 'Test User'
      })
      .eq('trace_id', TEST_CONFIG.trace_id)
      .select()
      .single();
    
    if (error) throw error;
    
    log('SUCCESS', 'Order linked to customer', {
      order_id: data.id,
      customer_id: data.customer_id
    });
    
    return true;
  } catch (error) {
    log('ERROR', 'Link failed', { error: error.message });
    return false;
  }
}

async function test6_VerifyCompleteFlow() {
  log('INFO', 'TEST 6: Verify Complete E2E Flow');
  
  try {
    const { data, error } = await supabase
      .rpc('execute_sql', {
        query: QUERIES.checkCustomerOrderLink(TEST_CONFIG.trace_id)
      });
    
    // Manual query since RPC might not exist
    const { data: result, error: err } = await supabase
      .from('simple_orders')
      .select(`
        id,
        trace_id,
        customer_email,
        customer_id,
        config_json,
        customers!customer_id(email, stripe_customer_id, name)
      `)
      .eq('trace_id', TEST_CONFIG.trace_id)
      .single();
    
    if (err) throw err;
    
    const checks = {
      has_trace_id: !!result.trace_id,
      has_customer_email: !!result.customer_email,
      has_customer_id: !!result.customer_id,
      has_config_json: !!result.config_json,
      colors_correct: result.config_json?.colors?.base === TEST_CONFIG.colors.base,
      customer_linked: !!result.customers
    };
    
    const allPassed = Object.values(checks).every(v => v === true);
    
    log(allPassed ? 'SUCCESS' : 'ERROR', 'E2E Flow Verification', checks);
    
    return allPassed;
  } catch (error) {
    log('ERROR', 'E2E verification failed', { error: error.message });
    return false;
  }
}

async function test7_Cleanup() {
  log('INFO', 'TEST 7: Cleanup Test Data');
  
  try {
    // Delete test order
    await supabase
      .from('simple_orders')
      .delete()
      .eq('trace_id', TEST_CONFIG.trace_id);
    
    // Delete test customer
    await supabase
      .from('customers')
      .delete()
      .eq('email', TEST_CONFIG.test_email);
    
    log('SUCCESS', 'Test data cleaned up');
    return true;
  } catch (error) {
    log('WARN', 'Cleanup failed (non-critical)', { error: error.message });
    return false;
  }
}

// Main Test Runner
async function runTests() {
  console.log('\n================================================');
  console.log('🧪 E2E AUTOMATED TEST SUITE');
  console.log('================================================\n');
  
  const results = {
    schema: await test1_VerifySchemaExists(),
    create_order: await test2_CreateTestOrder(),
    verify_persistence: await test3_VerifyOrderPersistence(),
    create_customer: await test4_CreateCustomer(),
    link_order: await test5_LinkOrderToCustomer(),
    e2e_flow: await test6_VerifyCompleteFlow(),
    cleanup: await test7_Cleanup()
  };
  
  console.log('\n================================================');
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('================================================\n');
  
  Object.entries(results).forEach(([test, passed]) => {
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(v => v).length;
  const failedTests = totalTests - passedTests;
  
  console.log(`\nTotal: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
  
  // Save logs
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  const logFile = path.join(logsDir, `e2e-test-${TEST_CONFIG.trace_id || Date.now()}.json`);
  fs.writeFileSync(logFile, JSON.stringify({
    test_config: TEST_CONFIG,
    results,
    logs,
    summary: {
      total: totalTests,
      passed: passedTests,
      failed: failedTests
    }
  }, null, 2));
  
  console.log(`\n📄 Detailed logs saved to: ${logFile}`);
  
  // Generate SQL verification script
  const sqlFile = path.join(logsDir, `verify-${TEST_CONFIG.trace_id || Date.now()}.sql`);
  const sqlContent = Object.entries(QUERIES).map(([name, fn]) => {
    const params = name.includes('TraceId') ? TEST_CONFIG.trace_id :
                   name.includes('Email') ? TEST_CONFIG.test_email : null;
    return `-- ${name}\n${params ? fn(params) : fn}\n`;
  }).join('\n');
  
  fs.writeFileSync(sqlFile, sqlContent);
  console.log(`📄 SQL verification script: ${sqlFile}\n`);
  
  process.exit(failedTests > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('💥 Test suite crashed:', error);
  process.exit(1);
});
