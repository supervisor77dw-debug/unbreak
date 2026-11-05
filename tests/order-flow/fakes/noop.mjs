// Replaces Prisma and pg, which the order flow imports but does not call.
export class PrismaClient {}
export class PrismaPg {}
export class Pool {}
export default { Pool };
