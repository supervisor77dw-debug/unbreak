/**
 * Reset Admin Password Script
 * 
 * Usage: node scripts/reset-admin-password.js [new-password]
 * Example: node scripts/reset-admin-password.js MyNewPassword123!
 * 
 * If no password provided, uses ADMIN_SEED_PASSWORD from .env.local
 */

const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

// Use existing Prisma client singleton
const prisma = require('../lib/prisma.js').default;

async function resetAdminPassword() {
  try {
    const adminEmail = process.env.ADMIN_SEED_EMAIL || 'admin@unbreak-one.com';
    const newPassword = process.argv[2] || process.env.ADMIN_SEED_PASSWORD;
    if (!newPassword || newPassword.length < 16) {
      throw new Error('ADMIN_SEED_PASSWORD (min. 16 chars) required - no default password');
    }

    console.log('🔐 Resetting admin password...');
    console.log('📧 Email:', adminEmail);

    // Check if admin exists
    const admin = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (!admin) {
      console.error('❌ Admin user not found:', adminEmail);
      console.log('');
      console.log('Creating new admin user...');
      
      // Create admin if doesn't exist
      const passwordHash = await bcrypt.hash(newPassword, 10);
      const newAdmin = await prisma.user.create({
        data: {
          email: adminEmail,
          name: 'Admin',
          passwordHash,
          role: 'ADMIN',
          isActive: true
        }
      });

      console.log('✅ Admin user created!');
      console.log('📧 Email:', newAdmin.email);
      console.log('🔒 Password:', newPassword);
      console.log('👤 Role:', newAdmin.role);
      return;
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { email: adminEmail },
      data: { 
        passwordHash,
        isActive: true // Ensure account is active
      }
    });

    console.log('✅ Password reset successful!');
    console.log('📧 Email:', adminEmail);
    console.log('🔒 New Password:', newPassword);
    console.log('👤 Role:', admin.role);
    console.log('');
    console.log('🔗 Login at: /admin/login');

  } catch (error) {
    console.error('❌ Error resetting password:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

resetAdminPassword()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
