import {
  users,
  restaurants,
  categories,
  menuItems,
  menuItemPriceVariants,
  type User,
  type UpsertUser,
  type Restaurant,
  type InsertRestaurant,
  type Category,
  type InsertCategory,
  type MenuItem,
  type InsertMenuItem,
  type PriceVariant,
  type InsertPriceVariant,
} from "@shared/schema";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import bcrypt from "./passwords";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, user: Partial<UpsertUser>): Promise<User>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<void>;
  deleteUser(id: string): Promise<void>;
  
  getRestaurantByUserId(userId: string): Promise<Restaurant | undefined>;
  getRestaurantById(id: string): Promise<Restaurant | undefined>;
  getAllRestaurants(): Promise<Restaurant[]>;
  createRestaurant(restaurant: InsertRestaurant): Promise<Restaurant>;
  updateRestaurant(id: string, restaurant: Partial<InsertRestaurant>): Promise<Restaurant>;
  deleteRestaurant(id: string): Promise<void>;
  
  getCategoriesByRestaurantId(restaurantId: string): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: string): Promise<void>;
  
  getMenuItemsByRestaurantId(restaurantId: string): Promise<MenuItem[]>;
  getMenuItemsByCategoryId(categoryId: string): Promise<MenuItem[]>;
  createMenuItem(item: InsertMenuItem): Promise<MenuItem>;
  updateMenuItem(id: string, item: Partial<InsertMenuItem>): Promise<MenuItem>;
  deleteMenuItem(id: string): Promise<void>;
  
  getPriceVariantsByMenuItemId(menuItemId: string): Promise<PriceVariant[]>;
  getPriceVariantsByRestaurantId(restaurantId: string): Promise<PriceVariant[]>;
  createPriceVariant(variant: InsertPriceVariant): Promise<PriceVariant>;
  updatePriceVariant(id: string, variant: Partial<InsertPriceVariant>): Promise<PriceVariant>;
  deletePriceVariant(id: string): Promise<void>;
  deletePriceVariantsByMenuItemId(menuItemId: string): Promise<void>;
  replacePriceVariants(menuItemId: string, variants: Omit<InsertPriceVariant, 'menuItemId'>[]): Promise<PriceVariant[]>;
  
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`);
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async createUser(userData: UpsertUser): Promise<User> {
    // Hash password before storing
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        password: hashedPassword,
      })
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUser(id: string, userData: Partial<UpsertUser>): Promise<User> {
    // Hash password if it's being updated
    const updateData = { ...userData };
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    const [user] = await db
      .update(users)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getRestaurantByUserId(userId: string): Promise<Restaurant | undefined> {
    const [restaurant] = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.userId, userId))
      .limit(1);
    return restaurant;
  }

  async getRestaurantById(id: string): Promise<Restaurant | undefined> {
    const [restaurant] = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, id));
    return restaurant;
  }

  async createRestaurant(restaurant: InsertRestaurant): Promise<Restaurant> {
    const [existing] = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.userId, restaurant.userId))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(restaurants)
        .set({ ...restaurant, updatedAt: new Date() })
        .where(eq(restaurants.id, existing.id))
        .returning();
      return updated;
    }

    const [newRestaurant] = await db
      .insert(restaurants)
      .values(restaurant)
      .returning();
    return newRestaurant;
  }

  async updateRestaurant(id: string, restaurant: Partial<InsertRestaurant>): Promise<Restaurant> {
    const [updated] = await db
      .update(restaurants)
      .set({ ...restaurant, updatedAt: new Date() })
      .where(eq(restaurants.id, id))
      .returning();
    return updated;
  }

  async getAllRestaurants(): Promise<Restaurant[]> {
    return await db.select().from(restaurants);
  }

  async deleteRestaurant(id: string): Promise<void> {
    await db.delete(restaurants).where(eq(restaurants.id, id));
  }

  async getCategoriesByRestaurantId(restaurantId: string): Promise<Category[]> {
    return await db
      .select()
      .from(categories)
      .where(eq(categories.restaurantId, restaurantId))
      .orderBy(categories.order, categories.id);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db
      .insert(categories)
      .values(category)
      .returning();
    return newCategory;
  }

  async updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category> {
    const [updated] = await db
      .update(categories)
      .set(category)
      .where(eq(categories.id, id))
      .returning();
    return updated;
  }

  async deleteCategory(id: string): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  async getMenuItemsByRestaurantId(restaurantId: string): Promise<MenuItem[]> {
    const result = await db
      .select({
        menuItem: menuItems,
      })
      .from(menuItems)
      .innerJoin(categories, eq(menuItems.categoryId, categories.id))
      .where(eq(categories.restaurantId, restaurantId))
      .orderBy(menuItems.order, menuItems.id);

    return result.map(r => r.menuItem);
  }

  async getMenuItemsByCategoryId(categoryId: string): Promise<MenuItem[]> {
    return await db
      .select()
      .from(menuItems)
      .where(eq(menuItems.categoryId, categoryId))
      .orderBy(menuItems.order, menuItems.id);
  }

  async createMenuItem(item: InsertMenuItem): Promise<MenuItem> {
    const itemData = {
      ...item,
      price: typeof item.price === 'number' ? String(item.price) : item.price,
      discount: item.discount !== undefined ? (typeof item.discount === 'number' ? String(item.discount) : item.discount) : undefined,
    };
    const [newItem] = await db
      .insert(menuItems)
      .values(itemData as any)
      .returning();
    return newItem;
  }

  async updateMenuItem(id: string, item: Partial<InsertMenuItem>): Promise<MenuItem> {
    const itemData: any = { ...item, updatedAt: new Date() };
    if (item.price !== undefined) {
      itemData.price = typeof item.price === 'number' ? String(item.price) : item.price;
    }
    if (item.discount !== undefined) {
      itemData.discount = typeof item.discount === 'number' ? String(item.discount) : item.discount;
    }
    const [updated] = await db
      .update(menuItems)
      .set(itemData)
      .where(eq(menuItems.id, id))
      .returning();
    return updated;
  }

  async deleteMenuItem(id: string): Promise<void> {
    await db.delete(menuItems).where(eq(menuItems.id, id));
  }

  async getPriceVariantsByMenuItemId(menuItemId: string): Promise<PriceVariant[]> {
    return await db
      .select()
      .from(menuItemPriceVariants)
      .where(eq(menuItemPriceVariants.menuItemId, menuItemId))
      .orderBy(menuItemPriceVariants.order, menuItemPriceVariants.id);
  }

  async getPriceVariantsByRestaurantId(restaurantId: string): Promise<PriceVariant[]> {
    const result = await db
      .select({
        variant: menuItemPriceVariants,
      })
      .from(menuItemPriceVariants)
      .innerJoin(menuItems, eq(menuItemPriceVariants.menuItemId, menuItems.id))
      .innerJoin(categories, eq(menuItems.categoryId, categories.id))
      .where(eq(categories.restaurantId, restaurantId))
      .orderBy(menuItemPriceVariants.order, menuItemPriceVariants.menuItemId, menuItemPriceVariants.id);

    return result.map(r => r.variant);
  }

  async createPriceVariant(variant: InsertPriceVariant): Promise<PriceVariant> {
    const variantData = {
      ...variant,
      price: typeof variant.price === 'number' ? String(variant.price) : variant.price,
      discount: variant.discount !== undefined ? (typeof variant.discount === 'number' ? String(variant.discount) : variant.discount) : undefined,
    };
    const [newVariant] = await db
      .insert(menuItemPriceVariants)
      .values(variantData as any)
      .returning();
    return newVariant;
  }

  async updatePriceVariant(id: string, variant: Partial<InsertPriceVariant>): Promise<PriceVariant> {
    const variantData: any = { ...variant };
    if (variant.price !== undefined) {
      variantData.price = typeof variant.price === 'number' ? String(variant.price) : variant.price;
    }
    if (variant.discount !== undefined) {
      variantData.discount = typeof variant.discount === 'number' ? String(variant.discount) : variant.discount;
    }
    const [updated] = await db
      .update(menuItemPriceVariants)
      .set(variantData)
      .where(eq(menuItemPriceVariants.id, id))
      .returning();
    return updated;
  }

  async deletePriceVariant(id: string): Promise<void> {
    await db.delete(menuItemPriceVariants).where(eq(menuItemPriceVariants.id, id));
  }

  async deletePriceVariantsByMenuItemId(menuItemId: string): Promise<void> {
    await db.delete(menuItemPriceVariants).where(eq(menuItemPriceVariants.menuItemId, menuItemId));
  }

  async replacePriceVariants(
    menuItemId: string, 
    variants: Omit<InsertPriceVariant, 'menuItemId'>[]
  ): Promise<PriceVariant[]> {
    return await db.transaction(async (tx) => {
      // Delete all existing variants within the transaction
      await tx.delete(menuItemPriceVariants).where(eq(menuItemPriceVariants.menuItemId, menuItemId));

      // If no variants to create, return empty array
      if (variants.length === 0) {
        return [];
      }

      // Prepare all variant data FIRST before any inserts
      const sanitizedVariants = variants.map(variant => ({
        ...variant,
        menuItemId,
        price: typeof variant.price === 'number' ? String(variant.price) : variant.price,
        discount: variant.discount !== undefined ? (typeof variant.discount === 'number' ? String(variant.discount) : variant.discount) : "0",
      }));

      // Perform a SINGLE bulk insert with all variants
      // If this fails, the entire transaction rolls back (true atomicity)
      const createdVariants = await tx
        .insert(menuItemPriceVariants)
        .values(sanitizedVariants as any)
        .returning();

      return createdVariants;
    });
  }

}

export const storage = new DatabaseStorage();
