import { workerContext } from './workerContext';

async function callPasswordService(body: { operation: 'hash' | 'compare'; password: string; rounds?: number; hash?: string }) {
  const { env } = workerContext();
  const response = await fetch(`${env.SUPABASE_URL}/functions/v1/cafe-passwords`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.PASSWORD_SERVICE_SECRET}` },
    body: JSON.stringify(body), signal: AbortSignal.timeout(15000), redirect: 'manual',
  });
  if (!response.ok) throw new Error('Password service unavailable');
  return response.json() as Promise<{ hash?: string; valid?: boolean }>;
}
export default {
  async hash(password: string, rounds: number): Promise<string> {
    const result = await callPasswordService({ operation: 'hash', password, rounds });
    if (!result.hash || !/^\$2[aby]\$(10|12)\$[./A-Za-z0-9]{53}$/.test(result.hash)) throw new Error('Invalid password service response');
    return result.hash;
  },
  async compare(password: string, hash: string): Promise<boolean> {
    const result = await callPasswordService({ operation: 'compare', password, hash });
    if (typeof result.valid !== 'boolean') throw new Error('Invalid password service response');
    return result.valid;
  },
};
