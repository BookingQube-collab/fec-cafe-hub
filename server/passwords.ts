// Pure-JS bcrypt so Vercel Linux serverless does not need native bcrypt prebuilds.
// Hashes remain compatible with existing bcrypt $2a$ / $2b$ rows.
export { default } from 'bcryptjs';
