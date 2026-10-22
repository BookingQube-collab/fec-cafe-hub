import { Express, RequestHandler } from "express";
import session from "express-session";
import { db } from "./db";
import { sessions } from "@shared/schema";
import { eq, lt } from "drizzle-orm";
import bcrypt from "./passwords";
import { storage } from "./storage";
import { loginSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { rateLimit } from './httpSecurity';
import { safeError } from './securityHeaders';

export function sessionCookieName() {
  return process.env.COOKIE_SECURE === 'true' ? '__Host-cafe.sid' : 'connect.sid';
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  class DatabaseSessionStore extends session.Store {
    get(sid: string, callback: (err: any, data?: any) => void) {
      db.select().from(sessions).where(eq(sessions.sid, sid)).then(([row]) => callback(null, row && row.expire > new Date() ? row.sess : null)).catch(callback);
    }
    set(sid: string, data: any, callback?: (err?: any) => void) {
      const expire = new Date(data.cookie.expires || Date.now() + sessionTtl);
      db.insert(sessions).values({ sid, sess: data, expire }).onConflictDoUpdate({ target: sessions.sid, set: { sess: data, expire } }).then(() => callback?.()).catch(err => callback?.(err));
    }
    destroy(sid: string, callback?: (err?: any) => void) {
      db.delete(sessions).where(eq(sessions.sid, sid)).then(() => callback?.()).catch(err => callback?.(err));
    }
  }
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 48) throw new Error('Configure a session secret of at least 48 characters');
  const sessionStore = new DatabaseSessionStore();
  db.delete(sessions).where(lt(sessions.expire, new Date())).catch(error => console.error('Session cleanup failed', safeError(error)));
  return session({
    name: sessionCookieName(),
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
      path: '/',
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.use(getSession());

  // Login endpoint
  const ipLimit = rateLimit(100, 15 * 60 * 1000, req => req.ip || 'unknown');
  // An account's failure budget applies across source IPs and Worker instances.
  const accountLimit = rateLimit(10, 15 * 60 * 1000, req => String(req.body?.email || '').trim().toLowerCase().slice(0,254), true);
  app.post("/api/login", ipLimit, accountLimit, async (req, res) => {
    try {
      // Validate request body
      const validationResult = loginSchema.safeParse(req.body);
      if (!validationResult.success) {
        const validationError = fromZodError(validationResult.error);
        return res.status(400).json({ message: validationError.message });
      }

      const { email, password } = validationResult.data;

      // Find user by email
      const user = await storage.getUserByEmail(email);
      
      if (!user || user.accountStatus !== 'active' || !['admin','super_admin'].includes(user.role)) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Set session
      await new Promise<void>((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
      (req.session as any).userId = user.id;
      await new Promise<void>((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
      
      // Sanitize password from response
      const { password: _, ...sanitizedUser } = user;
      
      res.json({ 
        success: true,
        user: sanitizedUser,
      });
    } catch (error) {
      console.error("Login error:", safeError(error));
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Logout endpoint
  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.clearCookie(sessionCookieName(), { path: '/', httpOnly: true, secure: process.env.COOKIE_SECURE === 'true', sameSite: 'lax' });
      res.json({ success: true });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const userId = (req.session as any).userId;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Access control and the route share one live lookup within this request.
    // Express creates a fresh request object; roles are reloaded next time.
    const user = (req as any).user?.id === userId ? (req as any).user : await storage.getUser(userId);
    if (!user || user.accountStatus !== 'active') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!['admin', 'super_admin'].includes(user.role)) return res.status(403).json({ message: 'This account has no management role' });
    
    (req as any).user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
  }
};

export const isSuperAdmin: RequestHandler = async (req, res, next) => {
  const userId = (req.session as any).userId;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const user = (req as any).user?.id === userId ? (req as any).user : await storage.getUser(userId);
    if (!user || user.accountStatus !== 'active' || user.role !== "super_admin") {
      return res.status(403).json({ message: "Forbidden: Super admin access required" });
    }
    
    (req as any).user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
  }
};
