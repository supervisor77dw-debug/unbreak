/**
 * ANALYTICS DASHBOARD – PHASE 7
 * 
 * Internal dashboard for configurator conversion analytics and business intelligence.
 * Shows conversion rates, premium attach rates, drop-off points, and pricing insights.
 * 
 * Purpose:
 * - Monitor configurator performance
 * - Identify conversion bottlenecks
 * - Track premium component adoption
 * - Optimize pricing strategy
 * - Analyze abandonment patterns
 * 
 * @module components/analytics/AnalyticsDashboard
 */

'use client';

import React, { useState, useEffect } from 'react';
import type { SessionMetrics } from '@/lib/analytics/configurator-events';
import type { AbandonmentAnalysis, AbandonmentReason } from '@/lib/analytics/abandonment-tracker';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface DashboardMetrics {
  // Conversion metrics
  totalSessions: number;
  completedCheckouts: number;
  conversionRate: number;                // Percentage
  
  // Funnel metrics
  openedConfigurator: number;
  selectedComponents: number;
  selectedPremium: number;
  savedDesign: number;
  addedToCart: number;
  startedCheckout: number;
  
  // Premium metrics
  premiumAttachRate: number;             // Percentage
  averagePremiumComponentsPerOrder: number;
  
  // Pricing metrics
  averageConfigurationValue: number;
  averageOrderValue: number;
  priceIncreaseDuringSession: number;    // Average €
  
  // Abandonment metrics
  totalAbandonments: number;
  abandonmentRate: number;               // Percentage
  topAbandonmentReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  criticalDropOffStages: Array<{
    stage: string;
    count: number;
    percentage: number;
  }>;
  
  // Time metrics
  averageTimeToConversion: number;       // Seconds
  averageTimeToAbandonment: number;      // Seconds
}

interface ProductMetrics {
  productId: string;
  productName: string;
  sessions: number;
  conversions: number;
  conversionRate: number;
  averageValue: number;
  premiumAttachRate: number;
}

// ============================================================
// DASHBOARD COMPONENT
// ============================================================

export default function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [productMetrics, setProductMetrics] = useState<ProductMetrics[]>([]);
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days'>('7days');
  const [loading, setLoading] = useState(true);
  
  // Fetch metrics from API
  useEffect(() => {
    fetchMetrics();
  }, [dateRange]);
  
  async function fetchMetrics() {
    setLoading(true);
    
    try {
      const response = await fetch(`/api/analytics/dashboard?range=${dateRange}`);
      const data = await response.json();
      
      if (data.success) {
        setMetrics(data.metrics);
        setProductMetrics(data.productMetrics || []);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  }
  
  if (loading) {
    return <LoadingState />;
  }
  
  if (!metrics) {
    return <ErrorState />;
  }
  
  return (
    <div style={styles.dashboard}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Configurator Analytics</h1>
        
        <div style={styles.dateRangePicker}>
          <button
            style={{
              ...styles.dateRangeButton,
              ...(dateRange === 'today' ? styles.dateRangeButtonActive : {}),
            }}
            onClick={() => setDateRange('today')}
          >
            Today
          </button>
          <button
            style={{
              ...styles.dateRangeButton,
              ...(dateRange === '7days' ? styles.dateRangeButtonActive : {}),
            }}
            onClick={() => setDateRange('7days')}
          >
            7 Days
          </button>
          <button
            style={{
              ...styles.dateRangeButton,
              ...(dateRange === '30days' ? styles.dateRangeButtonActive : {}),
            }}
            onClick={() => setDateRange('30days')}
          >
            30 Days
          </button>
        </div>
      </div>
      
      {/* KPI Cards */}
      <div style={styles.kpiGrid}>
        <KPICard
          title="Conversion Rate"
          value={`${metrics.conversionRate.toFixed(1)}%`}
          subtitle={`${metrics.completedCheckouts} / ${metrics.totalSessions} sessions`}
          trend={metrics.conversionRate >= 15 ? 'good' : metrics.conversionRate >= 10 ? 'neutral' : 'bad'}
        />
        
        <KPICard
          title="Premium Attach Rate"
          value={`${metrics.premiumAttachRate.toFixed(1)}%`}
          subtitle={`Avg ${metrics.averagePremiumComponentsPerOrder.toFixed(1)} premium/order`}
          trend={metrics.premiumAttachRate >= 60 ? 'good' : metrics.premiumAttachRate >= 40 ? 'neutral' : 'bad'}
        />
        
        <KPICard
          title="Avg Configuration Value"
          value={`€${metrics.averageConfigurationValue.toFixed(0)}`}
          subtitle={`Avg order: €${metrics.averageOrderValue.toFixed(0)}`}
          trend="neutral"
        />
        
        <KPICard
          title="Abandonment Rate"
          value={`${metrics.abandonmentRate.toFixed(1)}%`}
          subtitle={`${metrics.totalAbandonments} abandonments`}
          trend={metrics.abandonmentRate <= 60 ? 'good' : metrics.abandonmentRate <= 80 ? 'neutral' : 'bad'}
        />
      </div>
      
      {/* Conversion Funnel */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Conversion Funnel</h2>
        <ConversionFunnel metrics={metrics} />
      </div>
      
      {/* Drop-off Analysis */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Critical Drop-off Stages</h2>
        <DropOffTable stages={metrics.criticalDropOffStages} />
      </div>
      
      {/* Abandonment Reasons */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Top Abandonment Reasons</h2>
        <AbandonmentReasons reasons={metrics.topAbandonmentReasons} />
      </div>
      
      {/* Product Performance */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Product Performance</h2>
        <ProductTable products={productMetrics} />
      </div>
      
      {/* Time Metrics */}
      <div style={styles.metricsGrid}>
        <MetricCard
          label="Avg Time to Conversion"
          value={formatDuration(metrics.averageTimeToConversion)}
        />
        <MetricCard
          label="Avg Time to Abandonment"
          value={formatDuration(metrics.averageTimeToAbandonment)}
        />
        <MetricCard
          label="Price Increase/Session"
          value={`€${metrics.priceIncreaseDuringSession.toFixed(2)}`}
        />
      </div>
    </div>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function KPICard({ title, value, subtitle, trend }: {
  title: string;
  value: string;
  subtitle: string;
  trend: 'good' | 'neutral' | 'bad';
}) {
  const trendColors = {
    good: '#4caf50',
    neutral: '#ff9800',
    bad: '#f44336',
  };
  
  return (
    <div style={styles.kpiCard}>
      <div style={styles.kpiTitle}>{title}</div>
      <div style={{ ...styles.kpiValue, color: trendColors[trend] }}>
        {value}
      </div>
      <div style={styles.kpiSubtitle}>{subtitle}</div>
    </div>
  );
}

function ConversionFunnel({ metrics }: { metrics: DashboardMetrics }) {
  const stages = [
    { label: 'Opened Configurator', value: metrics.openedConfigurator },
    { label: 'Selected Components', value: metrics.selectedComponents },
    { label: 'Selected Premium', value: metrics.selectedPremium },
    { label: 'Saved Design', value: metrics.savedDesign },
    { label: 'Added to Cart', value: metrics.addedToCart },
    { label: 'Started Checkout', value: metrics.startedCheckout },
    { label: 'Completed Checkout', value: metrics.completedCheckouts },
  ];
  
  const maxValue = stages[0].value || 1;
  
  return (
    <div style={styles.funnel}>
      {stages.map((stage, index) => {
        const percentage = (stage.value / maxValue) * 100;
        const dropOff = index > 0 
          ? ((stages[index - 1].value - stage.value) / stages[index - 1].value) * 100
          : 0;
        
        return (
          <div key={stage.label} style={styles.funnelStage}>
            <div style={styles.funnelLabel}>
              <span>{stage.label}</span>
              <span style={styles.funnelValue}>
                {stage.value} ({percentage.toFixed(0)}%)
              </span>
            </div>
            <div style={styles.funnelBar}>
              <div
                style={{
                  ...styles.funnelBarFill,
                  width: `${percentage}%`,
                }}
              />
            </div>
            {dropOff > 0 && (
              <div style={styles.dropOff}>
                ⚠️ {dropOff.toFixed(0)}% drop-off
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DropOffTable({ stages }: {
  stages: Array<{ stage: string; count: number; percentage: number }>;
}) {
  return (
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>Stage</th>
          <th style={styles.th}>Drop-offs</th>
          <th style={styles.th}>Percentage</th>
        </tr>
      </thead>
      <tbody>
        {stages.map((stage) => (
          <tr key={stage.stage} style={styles.tr}>
            <td style={styles.td}>{formatStageName(stage.stage)}</td>
            <td style={styles.td}>{stage.count}</td>
            <td style={styles.td}>
              <span style={styles.percentage}>{stage.percentage.toFixed(1)}%</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AbandonmentReasons({ reasons }: {
  reasons: Array<{ reason: string; count: number; percentage: number }>;
}) {
  return (
    <div style={styles.reasonsGrid}>
      {reasons.map((reason) => (
        <div key={reason.reason} style={styles.reasonCard}>
          <div style={styles.reasonTitle}>{formatReasonName(reason.reason)}</div>
          <div style={styles.reasonCount}>{reason.count}</div>
          <div style={styles.reasonPercentage}>{reason.percentage.toFixed(1)}%</div>
        </div>
      ))}
    </div>
  );
}

function ProductTable({ products }: { products: ProductMetrics[] }) {
  return (
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>Product</th>
          <th style={styles.th}>Sessions</th>
          <th style={styles.th}>Conversions</th>
          <th style={styles.th}>Conv. Rate</th>
          <th style={styles.th}>Avg Value</th>
          <th style={styles.th}>Premium Rate</th>
        </tr>
      </thead>
      <tbody>
        {products.map((product) => (
          <tr key={product.productId} style={styles.tr}>
            <td style={styles.td}><strong>{product.productName}</strong></td>
            <td style={styles.td}>{product.sessions}</td>
            <td style={styles.td}>{product.conversions}</td>
            <td style={styles.td}>
              <span style={styles.percentage}>{product.conversionRate.toFixed(1)}%</span>
            </td>
            <td style={styles.td}>€{product.averageValue.toFixed(0)}</td>
            <td style={styles.td}>
              <span style={styles.percentage}>{product.premiumAttachRate.toFixed(1)}%</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>{value}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={styles.loadingState}>
      <div style={styles.spinner}></div>
      <p>Loading analytics...</p>
    </div>
  );
}

function ErrorState() {
  return (
    <div style={styles.errorState}>
      <p>⚠️ Failed to load analytics data</p>
    </div>
  );
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(0)}s`;
  } else if (seconds < 3600) {
    return `${(seconds / 60).toFixed(1)}m`;
  } else {
    return `${(seconds / 3600).toFixed(1)}h`;
  }
}

function formatStageName(stage: string): string {
  const names: Record<string, string> = {
    'configurator_opened': 'Configurator Opened',
    'component_selected': 'Component Selected',
    'premium_component_selected': 'Premium Selected',
    'price_changed': 'Price Changed',
    'design_saved': 'Design Saved',
    'added_to_cart': 'Added to Cart',
    'checkout_started': 'Checkout Started',
    'checkout_completed': 'Checkout Completed',
    'checkout_abandoned': 'Checkout Abandoned',
  };
  return names[stage] || stage;
}

function formatReasonName(reason: string): string {
  const names: Record<string, string> = {
    'price_too_high': '💰 Price Too High',
    'long_decision_time': '⏱️ Long Decision Time',
    'navigation_away': '🚪 Navigated Away',
    'session_timeout': '⌛ Session Timeout',
    'checkout_friction': '🛒 Checkout Friction',
    'payment_failed': '💳 Payment Failed',
    'unknown': '❓ Unknown',
  };
  return names[reason] || reason;
}

// ============================================================
// STYLES
// ============================================================

const styles: Record<string, React.CSSProperties> = {
  dashboard: {
    padding: '30px',
    maxWidth: '1400px',
    margin: '0 auto',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#333',
  },
  dateRangePicker: {
    display: 'flex',
    gap: '10px',
  },
  dateRangeButton: {
    padding: '10px 20px',
    border: '1px solid #ddd',
    backgroundColor: 'white',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  dateRangeButtonActive: {
    backgroundColor: '#1976d2',
    color: 'white',
    borderColor: '#1976d2',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginBottom: '40px',
  },
  kpiCard: {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  kpiTitle: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '10px',
  },
  kpiValue: {
    fontSize: '36px',
    fontWeight: 'bold',
    marginBottom: '5px',
  },
  kpiSubtitle: {
    fontSize: '12px',
    color: '#999',
  },
  section: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '30px',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    marginBottom: '20px',
    color: '#333',
  },
  funnel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  funnelStage: {
    position: 'relative',
  },
  funnelLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '5px',
    fontSize: '14px',
  },
  funnelValue: {
    fontWeight: 'bold',
    color: '#1976d2',
  },
  funnelBar: {
    height: '30px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  funnelBarFill: {
    height: '100%',
    backgroundColor: '#1976d2',
    transition: 'width 0.3s ease',
  },
  dropOff: {
    fontSize: '12px',
    color: '#f44336',
    marginTop: '5px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '12px',
    borderBottom: '2px solid #e0e0e0',
    fontWeight: 'bold',
    color: '#666',
  },
  tr: {
    borderBottom: '1px solid #f0f0f0',
  },
  td: {
    padding: '12px',
  },
  percentage: {
    fontWeight: 'bold',
    color: '#1976d2',
  },
  reasonsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px',
  },
  reasonCard: {
    padding: '20px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    textAlign: 'center',
  },
  reasonTitle: {
    fontSize: '14px',
    marginBottom: '10px',
  },
  reasonCount: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: '5px',
  },
  reasonPercentage: {
    fontSize: '12px',
    color: '#999',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
  },
  metricCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  metricLabel: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '10px',
  },
  metricValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    color: '#666',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #1976d2',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  errorState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    color: '#f44336',
    fontSize: '18px',
  },
};
