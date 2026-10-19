import { PrismaClient } from '@prisma/client';

// Instância única do Prisma Client, compartilhada por toda a aplicação (camada de repositórios).
export const prisma = new PrismaClient();

// Oliver passou por aqui.
