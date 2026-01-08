import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import prisma from '../../../lib/prisma';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user || session.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.method === 'GET') {
    try {
      const rates = await prisma.shippingRate.findMany({
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'asc' },
        ],
      });
      return res.status(200).json(rates);
    } catch (error) {
      console.error('[API] Error fetching shipping rates:', error);
      return res.status(500).json({ error: 'Failed to fetch shipping rates' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { countryCode, labelDe, labelEn, priceNet, active, sortOrder } = req.body;

      const rate = await prisma.shippingRate.create({
        data: {
          countryCode,
          labelDe,
          labelEn,
          priceNet: parseInt(priceNet) || 0,
          active: active !== false,
          sortOrder: parseInt(sortOrder) || 0,
        },
      });

      return res.status(201).json(rate);
    } catch (error) {
      console.error('[API] Error creating shipping rate:', error);
      return res.status(500).json({ error: 'Failed to create shipping rate' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id, countryCode, labelDe, labelEn, priceNet, active, sortOrder } = req.body;

      const rate = await prisma.shippingRate.update({
        where: { id },
        data: {
          countryCode,
          labelDe,
          labelEn,
          priceNet: parseInt(priceNet) || 0,
          active: active !== false,
          sortOrder: parseInt(sortOrder) || 0,
        },
      });

      return res.status(200).json(rate);
    } catch (error) {
      console.error('[API] Error updating shipping rate:', error);
      return res.status(500).json({ error: 'Failed to update shipping rate' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;

      await prisma.shippingRate.delete({
        where: { id },
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('[API] Error deleting shipping rate:', error);
      return res.status(500).json({ error: 'Failed to delete shipping rate' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
