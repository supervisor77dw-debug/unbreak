import { requireAuth } from '../../../../lib/auth-helpers';
import prisma from '../../../../lib/prisma';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { format = 'csv' } = req.query;

    // Fetch all orders with customer and items
    const orders = await prisma.adminOrder.findMany({
      include: {
        customer: true,
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'Bestellnr.',
        'Datum',
        'Kunde E-Mail',
        'Kunde Name',
        'Zahlungsstatus',
        'Versandstatus',
        'Artikel',
        'Zwischensumme (€)',
        'Versand (€)',
        'MwSt. (€)',
        'Gesamt (€)',
        'Bezahlt am',
        'Versandt am',
      ];

      const rows = orders.map((order) => {
        const itemsCount = order.items.length;
        const subtotal = (order.amountTotal - order.amountShipping - order.amountTax) / 100;
        const shipping = order.amountShipping / 100;
        const tax = order.amountTax / 100;
        const total = order.amountTotal / 100;

        const paymentStatus = {
          PENDING: 'Ausstehend',
          PAID: 'Bezahlt',
          FAILED: 'Fehlgeschlagen',
          REFUNDED: 'Erstattet',
        }[order.statusPayment] || order.statusPayment;

        const fulfillmentStatus = {
          NEW: 'Neu',
          PROCESSING: 'In Bearbeitung',
          SHIPPED: 'Versandt',
          DONE: 'Abgeschlossen',
          CANCELED: 'Storniert',
        }[order.statusFulfillment] || order.statusFulfillment;

        return [
          order.id.substring(0, 8),
          new Date(order.createdAt).toLocaleDateString('de-DE'),
          order.customer.email,
          order.customer.name || '',
          paymentStatus,
          fulfillmentStatus,
          itemsCount,
          subtotal.toFixed(2),
          shipping.toFixed(2),
          tax.toFixed(2),
          total.toFixed(2),
          order.paidAt ? new Date(order.paidAt).toLocaleDateString('de-DE') : '',
          order.shippedAt ? new Date(order.shippedAt).toLocaleDateString('de-DE') : '',
        ];
      });

      // Build CSV string
      const csvContent = [
        headers.join(','),
        ...rows.map((row) => 
          row.map((cell) => {
            // Escape cells containing commas or quotes
            const cellStr = String(cell);
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          }).join(',')
        ),
      ].join('\n');

      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="bestellungen-${new Date().toISOString().split('T')[0]}.csv"`);
      
      // Add BOM for Excel UTF-8 support
      res.status(200).send('\uFEFF' + csvContent);
    } else if (format === 'json') {
      res.status(200).json({ orders });
    } else {
      res.status(400).json({ error: 'Invalid format. Use csv or json' });
    }
  } catch (error) {
    console.error('❌ [ADMIN EXPORT] Error:', error);
    res.status(500).json({ error: 'Failed to export orders' });
  }
}
