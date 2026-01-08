import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user || session.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden - Admin access required' });
  }

  const { userId, newPassword } = req.body;

  if (!userId || !newPassword) {
    return res.status(400).json({ error: 'userId and newPassword are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in Supabase
    const { data, error } = await supabase
      .from('admin_users')
      .update({ 
        password_hash: hashedPassword,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('[API] Error updating password:', error);
      return res.status(500).json({ error: 'Failed to update password' });
    }

    if (!data) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`✅ [ADMIN] Password reset for user ${data.email} by ${session.user.email}`);

    return res.status(200).json({ 
      success: true,
      message: 'Password updated successfully' 
    });

  } catch (error) {
    console.error('[API] Error resetting password:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
