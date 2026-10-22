import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isSuperAdmin } from "./localAuth";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./localObjects";
import { mountLocalUploads } from "./localObjects";
import { mountCafeControls } from "./cafeControls";
import { mountMenuLibrary } from "./menuLibrary";
import { mountAccessControl, getManagedCafe, mediaOwner, authUser } from './accessControl';
import { mountPlatformControls } from './platformControls';
import { insertCategorySchema, registrationSchema, users, restaurants } from "@shared/schema";
import { db } from './db';
import { rateLimit } from './httpSecurity';
import { fromZodError } from "zod-validation-error";
import { z } from "zod";
import bcrypt from "./passwords";
import { safeError } from './securityHeaders';

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);
  // Internal restaurant management: public self-registration is retired.
  app.post('/api/register-restaurant', (_req, res) => res.status(410).json({ message: 'Restaurant accounts are created by the super admin.' }));
  mountAccessControl(app);
  mountLocalUploads(app);
  mountCafeControls(app);
  mountMenuLibrary(app);
  mountPlatformControls(app);

  // Only the platform owner can provision a restaurant and its manager.
  app.post('/api/super-admin/restaurants', isSuperAdmin, rateLimit(10, 60 * 60 * 1000, req => req.ip || 'unknown'), async (req, res) => {
    try {
      const validationResult = registrationSchema.safeParse(req.body);
      if (!validationResult.success) {
        const validationError = fromZodError(validationResult.error);
        return res.status(400).json({ message: validationError.message });
      }

      const { email, password, firstName, lastName, restaurantName } = validationResult.data;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "Email already registered" });
      }

      // Create restaurant admin user
      const hashedPassword = await bcrypt.hash(password, 12);
      const created = await db.transaction(async tx => {
        const [user] = await tx.insert(users).values({ email, password: hashedPassword, firstName, lastName, role: 'admin' }).returning();
        const [cafe] = await tx.insert(restaurants).values({ userId: user.id, name: restaurantName }).returning();
        return { user, cafe };
      });

      (req as any).platformCafe = created.cafe;
      res.status(201).json({ message: 'Restaurant and manager created.', id: created.cafe.id, email: created.user.email });
    } catch (error: any) {
      if (error.code === '23505' || error.cause?.code === '23505') return res.status(409).json({ message: 'Email already registered' });
      console.error("Error registering restaurant:", { type: error.name, code: error.code || error.cause?.code });
      res.status(500).json({ message: "Failed to register restaurant" });
    }
  });

  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      // User is already attached by isAuthenticated middleware
      // Sanitize password from response
      res.json(await authUser(req));
    } catch (error) {
      console.error("Error fetching user:", safeError(error));
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ===== SUPER ADMIN ROUTES =====
  
  // Get all restaurants (Super Admin only)
  app.get("/api/super-admin/restaurants", isSuperAdmin, async (_req, res) => {
    try {
      const restaurants = await storage.getAllRestaurants();
      const users = await storage.getAllUsers();
      
      // Combine restaurant data with user data
      const restaurantsWithUsers = restaurants.map(restaurant => {
        const user = users.find(u => u.id === restaurant.userId);
        return {
          ...restaurant,
          owner: user ? {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          } : null,
        };
      });
      
      res.json(restaurantsWithUsers);
    } catch (error) {
      console.error("Error fetching all restaurants:", safeError(error));
      res.status(500).json({ message: "Failed to fetch restaurants" });
    }
  });

  // Get all users (Super Admin only)
  app.get("/api/super-admin/users", isSuperAdmin, async (_req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Sanitize passwords
      const sanitizedUsers = users.map(({ password, ...user }) => user);
      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching users:", safeError(error));
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // ===== SUPER ADMIN CATEGORY ROUTES =====
  
  // Get categories for any restaurant (Super Admin only)
  app.get("/api/super-admin/restaurants/:restaurantId/categories", isSuperAdmin, async (req, res) => {
    try {
      const categories = await storage.getCategoriesByRestaurantId(req.params.restaurantId);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", safeError(error));
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // Create category for any restaurant (Super Admin only)
  

  // Update category for any restaurant (Super Admin only)
  

  // Delete category for any restaurant (Super Admin only)
  app.delete("/api/super-admin/categories/:id", isSuperAdmin, async (req, res) => {
    try {
      await storage.deleteCategory(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting category:", safeError(error));
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // ===== SUPER ADMIN MENU ITEM ROUTES =====
  
  // Get menu items for any restaurant (Super Admin only)
  app.get("/api/super-admin/restaurants/:restaurantId/menu-items", isSuperAdmin, async (req, res) => {
    try {
      const items = await storage.getMenuItemsByRestaurantId(req.params.restaurantId);
      res.json(req.path.includes("/public/") ? items.filter(item => item.isAvailable) : items);
    } catch (error) {
      console.error("Error fetching menu items:", safeError(error));
      res.status(500).json({ message: "Failed to fetch menu items" });
    }
  });

  // Create menu item for any restaurant (Super Admin only)
  

  // Update menu item for any restaurant (Super Admin only)
  

  // Delete menu item for any restaurant (Super Admin only)
  app.delete("/api/super-admin/menu-items/:id", isSuperAdmin, async (req, res) => {
    try {
      await storage.deleteMenuItem(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting menu item:", safeError(error));
      res.status(500).json({ message: "Failed to delete menu item" });
    }
  });

  // Super Admin: Suspend restaurant
  app.put("/api/super-admin/restaurants/:id/suspend", isSuperAdmin, async (req, res) => {
    try {
      const suspendSchema = z.object({
        reason: z.string().min(5, "Suspension reason must be at least 5 characters"),
      });

      const validatedData = suspendSchema.parse(req.body);
      const restaurant = await storage.updateRestaurant(req.params.id, {
        status: "suspended",
        suspensionReason: validatedData.reason,
      });
      res.json(restaurant);
    } catch (error) {
      console.error("Error suspending restaurant:", safeError(error));
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid suspension data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to suspend restaurant" });
    }
  });

  // Super Admin: Activate restaurant
  app.put("/api/super-admin/restaurants/:id/activate", isSuperAdmin, async (req, res) => {
    try {
      const restaurant = await storage.updateRestaurant(req.params.id, {
        status: "active",
        suspensionReason: null,
      });
      res.json(restaurant);
    } catch (error) {
      console.error("Error activating restaurant:", safeError(error));
      res.status(500).json({ message: "Failed to activate restaurant" });
    }
  });

  // Legacy subscription endpoint cannot mutate billing in the internal application.
  app.all('/api/super-admin/restaurants/:id/subscription', isSuperAdmin, (_req, res) => {
    res.status(410).json({ message: 'Subscriptions are disabled for internal restaurant management.' });
  });

  // Super Admin: Get single restaurant with owner
  app.get("/api/super-admin/restaurants/:id", isSuperAdmin, async (req, res) => {
    try {
      const restaurant = await storage.getRestaurantById(req.params.id);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      
      // Get owner information
      const owner = await storage.getUserById(restaurant.userId);
      const restaurantWithOwner = { ...restaurant, owner: owner ? { id: owner.id, email: owner.email, firstName: owner.firstName, lastName: owner.lastName } : null };
      
      res.json(restaurantWithOwner);
    } catch (error) {
      console.error("Error fetching restaurant:", safeError(error));
      res.status(500).json({ message: "Failed to fetch restaurant" });
    }
  });

  // Super Admin: Toggle restaurant visibility
  app.put("/api/super-admin/restaurants/:id/visibility", isSuperAdmin, async (req, res) => {
    try {
      const visibilitySchema = z.object({
        hidden: z.boolean(),
      });

      const validatedData = visibilitySchema.parse(req.body);
      const restaurant = await storage.updateRestaurant(req.params.id, validatedData);
      res.json(restaurant);
    } catch (error) {
      console.error("Error updating visibility:", safeError(error));
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid visibility data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update visibility" });
    }
  });

  // Super Admin: Update restaurant cover media
  

  // Super Admin: Reset restaurant owner password
  

  // Super Admin: Get categories for a restaurant
  app.get("/api/super-admin/categories/:restaurantId", isSuperAdmin, async (req, res) => {
    try {
      const categories = await storage.getCategoriesByRestaurantId(req.params.restaurantId);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", safeError(error));
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // Super Admin: Get menu items for a restaurant
  app.get("/api/super-admin/menu-items/:restaurantId", isSuperAdmin, async (req, res) => {
    try {
      const menuItems = await storage.getMenuItemsByRestaurantId(req.params.restaurantId);
      res.json(menuItems);
    } catch (error) {
      console.error("Error fetching menu items:", safeError(error));
      res.status(500).json({ message: "Failed to fetch menu items" });
    }
  });

  app.get("/api/restaurant", isAuthenticated, async (req: any, res) => {
    try {
      const restaurant = await getManagedCafe(req);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      res.json(restaurant);
    } catch (error) {
      console.error("Error fetching restaurant:", safeError(error));
      res.status(500).json({ message: "Failed to fetch restaurant" });
    }
  });

  app.get("/api/restaurant/public/:id", async (req, res) => {
    try {
      const restaurant = await storage.getRestaurantById(req.params.id);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const { id, name, theme, currency, timezone, logoUrl, coverMediaUrl, coverMediaType, cuisineType, address, phone, openingHours } = restaurant;
      res.json({ id, name, theme, currency, timezone, logoUrl, coverMediaUrl, coverMediaType, cuisineType, address, phone, openingHours });
    } catch (error) {
      console.error("Error fetching restaurant:", safeError(error));
      res.status(500).json({ message: "Failed to fetch restaurant" });
    }
  });

  app.put("/api/restaurant/logo", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await mediaOwner(req);
      const objectStorageService = new ObjectStorageService();
      await objectStorageService.mediaType(req.body.logoUrl, true);
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.logoUrl,
        {
          owner: userId,
          visibility: "public",
        },
      );

      res.status(200).json({ objectPath });
    } catch (error) {
      console.error("Error setting logo:", safeError(error));
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.all('/api/restaurant/upi-qr', isAuthenticated, (_req, res) => {
    res.status(410).json({ message: 'Payment QR codes are disabled. Use the permanent menu QR.' });
  });

  app.put("/api/restaurant/cover-media", isAuthenticated, async (req: any, res) => {
    try {
      const coverMediaSchema = z.object({
        coverMediaUrl: z.string(),
        coverMediaType: z.enum(["image", "video", "gif"]).nullable(),
      });

      const validatedData = coverMediaSchema.parse(req.body);
      const userId = await mediaOwner(req);
      const userRestaurant = await getManagedCafe(req);
      
      if (!userRestaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      let objectPath: string | null = null;
      let coverMediaType = validatedData.coverMediaType;

      if (validatedData.coverMediaUrl && validatedData.coverMediaUrl !== "") {
        const objectStorageService = new ObjectStorageService();
        objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
          validatedData.coverMediaUrl,
          {
            owner: userId,
            visibility: "public",
          },
        );
        coverMediaType = await objectStorageService.mediaType(objectPath);
      } else {
        objectPath = null;
        coverMediaType = null;
      }

      await storage.updateRestaurant(userRestaurant.id, {
        coverMediaUrl: objectPath,
        coverMediaType: coverMediaType as "image" | "video" | "gif" | null,
      });

      res.status(200).json({ objectPath, coverMediaType });
    } catch (error) {
      console.error("Error setting cover media:", safeError(error));
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid cover media data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/categories", isAuthenticated, async (req: any, res) => {
    try {
      const restaurant = await getManagedCafe(req);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const categories = await storage.getCategoriesByRestaurantId(restaurant.id);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", safeError(error));
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.get("/api/categories/public/:restaurantId", async (req, res) => {
    try {
      const categories = await storage.getCategoriesByRestaurantId(req.params.restaurantId);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", safeError(error));
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", isAuthenticated, async (req, res) => {
    try {
      const validationResult = insertCategorySchema.safeParse(req.body);
      if (!validationResult.success) {
        const validationError = fromZodError(validationResult.error);
        return res.status(400).json({ message: validationError.message });
      }
      const category = await storage.createCategory(validationResult.data);
      res.json(category);
    } catch (error) {
      console.error("Error creating category:", safeError(error));
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.delete("/api/categories/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteCategory(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting category:", safeError(error));
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  app.get("/api/menu-items", isAuthenticated, async (req: any, res) => {
    try {
      const restaurant = await getManagedCafe(req);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      const items = await storage.getMenuItemsByRestaurantId(restaurant.id);
      res.json(items);
    } catch (error) {
      console.error("Error fetching menu items:", safeError(error));
      res.status(500).json({ message: "Failed to fetch menu items" });
    }
  });

  app.get("/api/menu-items/public/:restaurantId", async (req, res) => {
    try {
      const items = await storage.getMenuItemsByRestaurantId(req.params.restaurantId);
      res.json(items.filter(item => item.isAvailable));
    } catch (error) {
      console.error("Error fetching menu items:", safeError(error));
      res.status(500).json({ message: "Failed to fetch menu items" });
    }
  });

  // IMPORTANT: This route must come BEFORE /api/menu-items/:id to avoid matching "image" as an ID
  app.put("/api/menu-items/image", isAuthenticated, async (req: any, res) => {
    const schema = z.object({
      imageUrl: z.string(),
      menuItemId: z.string().optional(),
    });
    
    const validationResult = schema.safeParse(req.body);
    if (!validationResult.success) {
      const validationError = fromZodError(validationResult.error);
      console.error("[menu-items/image] Validation failed:", validationError.message);
      return res.status(400).json({ message: validationError.message });
    }

    const { imageUrl, menuItemId } = validationResult.data;
    
    const userId = await mediaOwner(req);
    const objectStorageService = new ObjectStorageService();
    
    try {
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        imageUrl,
        {
          owner: userId,
          visibility: "public",
        },
      );

      if (menuItemId) {
        await storage.updateMenuItem(menuItemId, { imageUrl: objectPath });
      }

      const responseData = { objectPath: objectPath || imageUrl };
      res.status(200);
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(responseData));
      return;
    } catch (error: any) {
      console.error("[menu-items/image] Error:", safeError(error));
      return res.status(400).json({ message: 'Choose a valid photo uploaded for this café' });
    }
  });

  app.delete("/api/menu-items/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteMenuItem(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting menu item:", safeError(error));
      res.status(500).json({ message: "Failed to delete menu item" });
    }
  });

  app.get("/api/price-variants/:menuItemId", isAuthenticated, async (req, res) => {
    try {
      const variants = await storage.getPriceVariantsByMenuItemId(req.params.menuItemId);
      res.json(variants);
    } catch (error) {
      console.error("Error fetching price variants:", safeError(error));
      res.status(500).json({ message: "Failed to fetch price variants" });
    }
  });

  app.get("/api/price-variants/public/:menuItemId", async (req, res) => {
    try {
      const variants = await storage.getPriceVariantsByMenuItemId(req.params.menuItemId);
      res.json(variants);
    } catch (error) {
      console.error("Error fetching price variants:", safeError(error));
      res.status(500).json({ message: "Failed to fetch price variants" });
    }
  });

  app.get("/api/price-variants/public/restaurant/:restaurantId", async (req, res) => {
    try {
      const variants = await storage.getPriceVariantsByRestaurantId(req.params.restaurantId);
      const visible = new Set((await storage.getMenuItemsByRestaurantId(req.params.restaurantId)).filter(i => i.isAvailable).map(i => i.id));
      res.json(variants.filter(v => visible.has(v.menuItemId)));
    } catch (error) {
      console.error("Error fetching price variants:", safeError(error));
      res.status(500).json({ message: "Failed to fetch price variants" });
    }
  });

  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", safeError(error));
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      await objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", safeError(error));
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.use("/api", (_req, res) => res.status(404).json({ message: "Endpoint not found" }));
  const httpServer = createServer(app);
  return httpServer;
}
