import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, timestamp, jsonb, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const productTypeEnum = ['cloud', 'network', 'endpoint', 'siem', 'identity', 'database', 'web', 'abstract'] as const;
export type ProductType = typeof productTypeEnum[number];
export const mappingStatusEnum = ['matched', 'partial', 'ai_pending', 'not_found'] as const;
export type MappingStatus = typeof mappingStatusEnum[number];
export const resourceTypeEnum = ['ctid', 'sigma', 'elastic', 'splunk', 'mitre_stix'] as const;
export type ResourceType = typeof resourceTypeEnum[number];
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});
export const hybridSelectorTypeEnum = ['platform'] as const;
export type HybridSelectorType = typeof hybridSelectorTypeEnum[number];
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  productId: text("product_id").notNull().unique(),
  vendor: text("vendor").notNull(),
  productName: text("product_name").notNull(),
  deployment: text("deployment"),
  description: text("description").notNull(),
  platforms: text("platforms").array().notNull(),
  productType: text("product_type"),
  capabilityTags: text("capability_tags").array(),
  dataComponentIds: text("data_component_ids").array().notNull(),
  mitreAssetIds: text("mitre_asset_ids").array(),
  source: text("source").notNull(),
  logoPath: text("logo_path"),  // Path to product logo image
  hybridSelectorType: text("hybrid_selector_type"),
  hybridSelectorValues: text("hybrid_selector_values").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const dataComponents = pgTable("data_components", {
  id: serial("id").primaryKey(),
  componentId: text("component_id").notNull().unique(),
  name: text("name").notNull(),
  dataSourceId: text("data_source_id"),
  dataSourceName: text("data_source_name"),
  description: text("description").notNull(),
  dataCollectionMeasures: text("data_collection_measures").array().notNull().default(sql`'{}'::text[]`),
  logSources: jsonb("log_sources").notNull().default('[]'),
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
  dataComponentIds: text("data_component_ids").array().default(sql`'{}'::text[]`),
  logSources: jsonb("log_sources").default('[]'),
  mutableElements: jsonb("mutable_elements").default('[]'),
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
export const tactics = pgTable("tactics", {
  id: serial("id").primaryKey(),
  tacticId: text("tactic_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const techniques = pgTable("techniques", {
  id: serial("id").primaryKey(),
  techniqueId: text("technique_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  isSubtechnique: boolean("is_subtechnique").notNull(),
  tactics: text("tactics").array().notNull().default(sql`'{}'::text[]`),
  platforms: text("platforms").array().notNull().default(sql`'{}'::text[]`),
  detectionStrategyIds: text("detection_strategy_ids").array().notNull().default(sql`'{}'::text[]`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const resourceCache = pgTable("resource_cache", {
  id: serial("id").primaryKey(),
  resourceType: text("resource_type").notNull(),
  resourceKey: text("resource_key").notNull(),
  payload: jsonb("payload").notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});
export const productMappings = pgTable("product_mappings", {
  id: serial("id").primaryKey(),
  productId: text("product_id").notNull(),
  resourceType: text("resource_type").notNull(),
  status: text("status").notNull(),
  confidence: integer("confidence"),
  detectionStrategyIds: text("detection_strategy_ids").array().default(sql`'{}'::text[]`),
  analyticIds: text("analytic_ids").array().default(sql`'{}'::text[]`),
  dataComponentIds: text("data_component_ids").array().default(sql`'{}'::text[]`),
  rawMapping: jsonb("raw_mapping"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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

export const insertTacticSchema = createInsertSchema(tactics).omit({
  id: true,
  createdAt: true,
});

export const insertTechniqueSchema = createInsertSchema(techniques).omit({
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

export type InsertTactic = z.infer<typeof insertTacticSchema>;
export type Tactic = typeof tactics.$inferSelect;

export type InsertTechnique = z.infer<typeof insertTechniqueSchema>;
export type Technique = typeof techniques.$inferSelect;

export const insertResourceCacheSchema = createInsertSchema(resourceCache).omit({
  id: true,
  fetchedAt: true,
});

export const insertProductMappingSchema = createInsertSchema(productMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Product Aliases table for search term normalization
// Allows "m365" to map to "Microsoft 365", "O365" to "Office 365", etc.
// Uses Foreign Key to products.id for referential integrity
export const productAliases = pgTable("product_aliases", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id), // FK to products.id
  alias: text("alias").notNull().unique(), // e.g., "m365", "O365", "Office365"
  confidence: integer("confidence").default(100), // How sure are we of this alias?
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProductAliasSchema = createInsertSchema(productAliases).omit({
  id: true,
  createdAt: true,
});

export type InsertResourceCache = z.infer<typeof insertResourceCacheSchema>;
export type ResourceCache = typeof resourceCache.$inferSelect;

export type InsertProductMapping = z.infer<typeof insertProductMappingSchema>;
export type ProductMapping = typeof productMappings.$inferSelect;

export type InsertProductAlias = z.infer<typeof insertProductAliasSchema>;
export type ProductAlias = typeof productAliases.$inferSelect;
