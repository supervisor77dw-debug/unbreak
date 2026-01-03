import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Success() {
  const router = useRouter();
  const { session_id, order_id } = router.query;
  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session_id) {
      // Optional: Fetch order details from backend
      console.log('✅ Payment successful!');
      console.log('Session ID:', session_id);
      console.log('Order ID:', order_id);
      setLoading(false);
    }
  }, [session_id, order_id]);

  return (
    <>
      <Head>
        <title>Bestellung erfolgreich – UNBREAK ONE</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.icon}>
            <svg viewBox="0 0 24 24" style={styles.checkmark}>
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h1 style={styles.title}>Bestellung erfolgreich!</h1>
          
          <p style={styles.message}>
            Vielen Dank für Ihre Bestellung. Wir haben eine Bestätigungs-E-Mail an Ihre angegebene Adresse gesendet.
          </p>

          {order_id && (
            <div style={styles.orderInfo}>
              <p style={styles.orderLabel}>Bestellnummer:</p>
              <p style={styles.orderId}>{order_id}</p>
            </div>
          )}

          <div style={styles.nextSteps}>
            <h3 style={styles.nextStepsTitle}>Wie geht es weiter?</h3>
            <ul style={styles.stepsList}>
              <li>Sie erhalten eine Bestätigungs-E-Mail mit allen Details</li>
              <li>Ihr UNBREAK ONE wird individuell für Sie gefertigt</li>
              <li>Versand erfolgt innerhalb von 3-5 Werktagen</li>
              <li>Sie erhalten eine Tracking-Nummer per E-Mail</li>
            </ul>
          </div>

          <div style={styles.actions}>
            <button 
              onClick={() => router.push('/')}
              style={styles.primaryButton}
            >
              Zur Startseite
            </button>
            <button 
              onClick={() => router.push('/shop')}
              style={styles.secondaryButton}
            >
              Weiter einkaufen
            </button>
          </div>

          <div style={styles.support}>
            <p>
              Fragen zu Ihrer Bestellung?<br />
              <a href="/kontakt" style={styles.supportLink}>Kontaktieren Sie uns</a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0A6C74 0%, #1A1A1A 100%)',
    padding: '40px 20px',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(16px)',
    borderRadius: '12px',
    padding: '60px 40px',
    maxWidth: '600px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    textAlign: 'center',
  },
  icon: {
    width: '80px',
    height: '80px',
    background: 'linear-gradient(135deg, #0A6C74, #084F55)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 30px',
  },
  checkmark: {
    width: '40px',
    height: '40px',
    stroke: 'white',
    strokeWidth: '3',
    fill: 'none',
  },
  title: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: '20px',
  },
  message: {
    fontSize: '16px',
    lineHeight: '1.6',
    color: '#4A5568',
    marginBottom: '30px',
  },
  orderInfo: {
    background: '#F7FAFC',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '30px',
  },
  orderLabel: {
    fontSize: '14px',
    color: '#718096',
    marginBottom: '5px',
  },
  orderId: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#2D3748',
    fontFamily: 'monospace',
  },
  nextSteps: {
    textAlign: 'left',
    background: '#F7FAFC',
    padding: '25px',
    borderRadius: '8px',
    marginBottom: '30px',
  },
  nextStepsTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: '15px',
  },
  stepsList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  actions: {
    display: 'flex',
    gap: '15px',
    marginBottom: '30px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  primaryButton: {
    padding: '12px 30px',
    background: 'linear-gradient(135deg, #0A6C74, #084F55)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  secondaryButton: {
    padding: '12px 30px',
    background: 'white',
    color: '#0A6C74',
    border: '2px solid #0A6C74',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  support: {
    paddingTop: '20px',
    borderTop: '1px solid #E2E8F0',
    fontSize: '14px',
    color: '#718096',
  },
  supportLink: {
    color: '#0A6C74',
    fontWeight: '600',
    textDecoration: 'none',
  },
};
