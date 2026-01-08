import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  productId: text("product_id").notNull().unique(),
  vendor: text("vendor").notNull(),
  productName: text("product_name").notNull(),
  deployment: text("deployment"),
  description: text("description").notNull(),
  platforms: text("platforms").array().notNull(),
  dataComponentIds: text("data_component_ids").array().notNull(),
  mitreAssetIds: text("mitre_asset_ids").array(),
  source: text("source").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dataComponents = pgTable("data_components", {
  id: serial("id").primaryKey(),
  componentId: text("component_id").notNull().unique(),
  name: text("name").notNull(),
  dataSourceId: text("data_source_id").notNull(),
  dataSourceName: text("data_source_name").notNull(),
  description: text("description").notNull(),
  dataCollectionMeasures: text("data_collection_measures").array().notNull(),
  logSources: jsonb("log_sources").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const detectionStrategies = pgTable("detection_strategies", {
  id: serial("id").primaryKey(),
  strategyId: text("strategy_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const analytics = pgTable("analytics", {
  id: serial("id").primaryKey(),
  analyticId: text("analytic_id").notNull().unique(),
  strategyId: text("strategy_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  pseudocode: text("pseudocode"),
  dataComponentIds: text("data_component_ids").array().notNull(),
  logSources: jsonb("log_sources").notNull(),
  mutableElements: jsonb("mutable_elements").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mitreAssets = pgTable("mitre_assets", {
  id: serial("id").primaryKey(),
  assetId: text("asset_id").notNull().unique(),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export const insertDataComponentSchema = createInsertSchema(dataComponents).omit({
  id: true,
  createdAt: true,
});

export const insertDetectionStrategySchema = createInsertSchema(detectionStrategies).omit({
  id: true,
  createdAt: true,
});

export const insertAnalyticSchema = createInsertSchema(analytics).omit({
  id: true,
  createdAt: true,
});

export const insertMitreAssetSchema = createInsertSchema(mitreAssets).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export type InsertDataComponent = z.infer<typeof insertDataComponentSchema>;
export type DataComponent = typeof dataComponents.$inferSelect;

export type InsertDetectionStrategy = z.infer<typeof insertDetectionStrategySchema>;
export type DetectionStrategy = typeof detectionStrategies.$inferSelect;

export type InsertAnalytic = z.infer<typeof insertAnalyticSchema>;
export type Analytic = typeof analytics.$inferSelect;

export type InsertMitreAsset = z.infer<typeof insertMitreAssetSchema>;
export type MitreAsset = typeof mitreAssets.$inferSelect;
