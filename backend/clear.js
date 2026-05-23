import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.message.deleteMany({});
  await prisma.session.deleteMany({});
  console.log('Chats cleared successfully!');
}
main().catch(console.error).finally(() => prisma.$disconnect());
