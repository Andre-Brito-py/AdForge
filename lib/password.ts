import bcrypt from "bcryptjs";

const ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

// Hash fixo usado quando o usuário não existe, para o tempo de resposta não revelar
// quais e-mails estão cadastrados (proteção contra enumeração de contas).
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO5mQ5n5q8Gm7qVQm1qK1v7l9xS8yYzW2";

export async function verifyPasswordConstantTime(password: string, hash: string | null | undefined) {
  if (!hash) {
    await bcrypt.compare(password, DUMMY_HASH);
    return false;
  }
  return bcrypt.compare(password, hash);
}
