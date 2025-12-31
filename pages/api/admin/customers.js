import { requireAuth } from '../../../lib/auth-helpers';
import prisma from '../../../lib/prisma';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { search } = req.query;

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const customers = await prisma.adminCustomer.findMany({
      where,
      include: {
        _count: {
          select: { orders: true },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      take: 100,
    });

    res.status(200).json({ customers });
  } catch (error) {
    console.error('❌ [ADMIN CUSTOMERS] Error:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
}
