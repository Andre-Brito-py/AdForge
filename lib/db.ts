import { PrismaClient } from '@prisma/client'
import { directDatabaseUrl, prismaDatabaseUrl } from './db-url'

// O schema declara directUrl = env("DIRECT_URL"): sem ela definida, usa a URL sem pooler da integração Neon.
process.env.DIRECT_URL ||= directDatabaseUrl() || process.env.DATABASE_URL

const prismaClientSingleton = () => {
  const url = prismaDatabaseUrl(process.env.DATABASE_URL)
  return url ? new PrismaClient({ datasources: { db: { url } } }) : new PrismaClient()
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

export const db = globalThis.prismaGlobal ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = db
