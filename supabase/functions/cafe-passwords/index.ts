import bcrypt from 'npm:bcryptjs@3.0.3';
import { createPasswordHandler } from './handler.ts';
Deno.serve(createPasswordHandler(bcrypt, Deno.env.get('PASSWORD_SERVICE_SECRET') || ''));
