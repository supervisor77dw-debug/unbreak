const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

// Use existing Prisma client singleton from lib/prisma.js
const prisma = require('../lib/prisma.js').default;

async function main() {
  console.log('🌱 Seeding admin user...');

  const adminEmail = process.env.ADMIN_SEED_EMAIL || 'admin@unbreak-one.com';
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;
  if (!adminPassword || adminPassword.length < 16) {
    throw new Error('ADMIN_SEED_PASSWORD (min. 16 chars) required - no default password');
  }

  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (existingAdmin) {
    console.log('⚠️  Admin user already exists:', adminEmail);
    return;
  }

  // Hash password
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      name: 'Admin',
      passwordHash,
      role: 'ADMIN',
      isActive: true
    }
  });

  console.log('✅ Admin user created successfully!');
  console.log('📧 Email:', admin.email);
  console.log('🔒 Password:', adminPassword);
  console.log('⚠️  IMPORTANT: Change this password immediately after first login!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
