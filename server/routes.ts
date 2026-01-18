import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProductSchema, insertDataComponentSchema, insertDetectionStrategySchema, insertAnalyticSchema, insertMitreAssetSchema, insertProductAliasSchema, insertProductStreamSchema, products, productAliases, productStreams, ssmCapabilities, ssmMappings, techniques } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { runAutoMapper, getMappingStatus, getAllProductMappings, RESOURCE_PRIORITY } from "./auto-mapper";
import { slugifyPlatform } from "./auto-mapper/utils";
import { mitreKnowledgeGraph } from "./mitre-stix";
import { productService, adminService, getAllDetections } from "./services";
import { getGlobalCoverage } from "./services/coverage-service";
import { getCoverageGaps, getCoveragePaths } from "./services/gap-analysis-service";
import { db } from "./db";
import { and, eq, inArray } from "drizzle-orm";
import { getCache, setCache, buildCacheKey } from "./utils/cache";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  const respondWithCache = async <T>(
    key: string,
    ttlMs: number,
    fetcher: () => Promise<T>,
    res: Response
  ) => {
    const cached = getCache<T>(key);
    if (cached) {
      return res.json(cached);
    }
    const data = await fetcher();
    setCache(key, data, ttlMs);
    return res.json(data);
  };
  
  // Search products
  app.get("/api/products/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
      }
      
      const results = await storage.searchProducts(query);
      res.json(results);
    } catch (error) {
      console.error("Error searching products:", error);
      res.status(500).json({ error: "Failed to search products" });
    }
  });

  // Get product by ID
  app.get("/api/products/:productId", async (req, res) => {
    try {
      const { productId } = req.params;
      const product = await storage.getProductById(productId);
      
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.get("/api/products/:productId/streams", async (req, res) => {
    try {
      const { productId } = req.params;
      const product = await db.select({ id: products.id })
        .from(products)
        .where(eq(products.productId, productId))
        .limit(1);
      const productRow = product[0];
      if (!productRow) {
        return res.status(404).json({ error: "Product not found" });
      }

      const streams = await db
        .select()
        .from(productStreams)
        .where(eq(productStreams.productId, productRow.id));

      res.json({ streams });
    } catch (error) {
      console.error("Error fetching product streams:", error);
      res.status(500).json({ error: "Failed to fetch product streams" });
    }
  });

  app.post("/api/products/:productId/streams", async (req, res) => {
    try {
      const { productId } = req.params;
      const payload = req.body;
      if (!payload || !Array.isArray(payload.streams)) {
        return res.status(400).json({ error: "Expected streams array" });
      }

      const product = await db.select({ id: products.id })
        .from(products)
        .where(eq(products.productId, productId))
        .limit(1);
      const productRow = product[0];
      if (!productRow) {
        return res.status(404).json({ error: "Product not found" });
      }

      const seen = new Set<string>();
      const rows = payload.streams
        .map((stream: any) => {
          const name = typeof stream.name === 'string' ? stream.name.trim() : '';
          const streamType = typeof stream.streamType === 'string' ? stream.streamType : 'log';
          const mappedDataComponents = Array.isArray(stream.mappedDataComponents)
            ? stream.mappedDataComponents.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
            : [];
          const metadata = stream && typeof stream.metadata === 'object' && !Array.isArray(stream.metadata)
            ? stream.metadata
            : undefined;
          if (!name) return null;
          const key = name.toLowerCase();
          if (seen.has(key)) return null;
          seen.add(key);
          return insertProductStreamSchema.parse({
            productId: productRow.id,
            name,
            streamType,
            mappedDataComponents,
            metadata,
            isConfigured: mappedDataComponents.length > 0,
          });
        })
        .filter(Boolean);

      await db.transaction(async (tx) => {
        await tx.delete(productStreams).where(eq(productStreams.productId, productRow.id));
        if (rows.length > 0) {
          await tx.insert(productStreams).values(rows);
        }
      });

      const streams = await db
        .select()
        .from(productStreams)
        .where(eq(productStreams.productId, productRow.id));

      res.json({ streams });
    } catch (error) {
      console.error("Error saving product streams:", error);
      res.status(500).json({ error: "Failed to save product streams" });
    }
  });

  app.post("/api/wizard/coverage", async (req, res) => {
    try {
      await mitreKnowledgeGraph.ensureInitialized();
      const { productId, platforms, streams } = req.body || {};
      if (!productId || typeof productId !== "string") {
        return res.status(400).json({ error: "productId is required" });
      }

      const product = await db
        .select({ id: products.id, platforms: products.platforms })
        .from(products)
        .where(eq(products.productId, productId))
        .limit(1);
      const productRow = product[0];
      if (!productRow) {
        return res.status(404).json({ error: "Product not found" });
      }

      const platformList = Array.isArray(platforms) && platforms.length > 0
        ? platforms
        : (productRow.platforms || []);
      const normalizedPlatforms = platformList
        .map((platform: unknown) => (typeof platform === "string" ? platform.trim() : ""))
        .filter((platform: string) => platform.length > 0);
      if (normalizedPlatforms.length === 0) {
        return res.status(400).json({ error: "At least one platform is required" });
      }

      const streamRows = Array.isArray(streams) && streams.length > 0
        ? streams
        : await db.select().from(productStreams).where(eq(productStreams.productId, productRow.id));

      const dataComponentHints = new Set<string>();
      const streamNames = new Set<string>();
      const questionIds = new Set<string>();
      const missingNames = new Set<string>();

      for (const stream of streamRows as Array<Record<string, unknown>>) {
        if (stream && typeof stream.name === "string" && stream.name.trim()) {
          streamNames.add(stream.name.trim());
        }

        const mapped = Array.isArray((stream as { mappedDataComponents?: unknown }).mappedDataComponents)
          ? (stream as { mappedDataComponents?: unknown[] }).mappedDataComponents
          : [];
        mapped.forEach((item) => {
          if (typeof item === "string" && item.trim()) {
            dataComponentHints.add(item.trim());
          }
        });

        const metadata = stream && typeof (stream as { metadata?: unknown }).metadata === "object"
          ? (stream as { metadata?: Record<string, unknown> }).metadata
          : null;
        const metaQuestionIds = metadata && Array.isArray(metadata.question_ids) ? metadata.question_ids : [];
        metaQuestionIds.forEach((item: unknown) => {
          if (typeof item === "string" && item.trim()) {
            questionIds.add(item.trim());
          }
        });
        const metaMissing = metadata && Array.isArray(metadata.missing_dc_names) ? metadata.missing_dc_names : [];
        metaMissing.forEach((item: unknown) => {
          if (typeof item === "string" && item.trim()) {
            missingNames.add(item.trim());
          }
        });
      }

      if (dataComponentHints.size === 0) {
        return res.status(400).json({ error: "No data components selected" });
      }

      const resolvedComponents = mitreKnowledgeGraph.resolveDataComponentsFromHints(
        Array.from(dataComponentHints)
      );
      const dataSources = new Set<string>();
      resolvedComponents.forEach(dc => {
        if (dc.dataSourceName) {
          dataSources.add(dc.dataSourceName);
        }
      });

      const techniqueById = new Map<string, { technique: { id: string; name: string; platforms: string[] }; dataComponents: Set<string> }>();
      resolvedComponents.forEach((dc) => {
        const inferred = mitreKnowledgeGraph.getTechniquesByDataComponentName(dc.name);
        inferred.forEach((tech) => {
          if (!techniqueById.has(tech.id)) {
            techniqueById.set(tech.id, {
              technique: {
                id: tech.id,
                name: tech.name,
                platforms: tech.platforms || [],
              },
              dataComponents: new Set(),
            });
          }
          techniqueById.get(tech.id)?.dataComponents.add(dc.name);
        });
      });

      const platformMatches = (techPlatforms: string[], targetPlatform: string) => {
        if (!techPlatforms || techPlatforms.length === 0) return true;
        const target = targetPlatform.toLowerCase();
        return techPlatforms.some((platform) => {
          const candidate = platform.toLowerCase();
          return candidate.includes(target) || target.includes(candidate);
        });
      };

      const techniquesByPlatform = new Map<string, Array<{ id: string; name: string; dataComponents: Set<string> }>>();
      normalizedPlatforms.forEach((platform) => {
        techniquesByPlatform.set(platform, []);
      });

      const matchedTechniqueIds = new Set<string>();
      techniqueById.forEach(({ technique, dataComponents }) => {
        normalizedPlatforms.forEach((platform) => {
          if (!platformMatches(technique.platforms, platform)) return;
          matchedTechniqueIds.add(technique.id);
          techniquesByPlatform.get(platform)?.push({
            id: technique.id,
            name: technique.name,
            dataComponents,
          });
        });
      });

      const WIZARD_GUIDED_SOURCE = "wizard_questions";
      const existingCaps = await db
        .select({ id: ssmCapabilities.id })
        .from(ssmCapabilities)
        .where(and(
          eq(ssmCapabilities.productId, productId),
          eq(ssmCapabilities.source, WIZARD_GUIDED_SOURCE)
        ));

      if (existingCaps.length > 0) {
        const capIds = existingCaps.map(cap => cap.id);
        await db.delete(ssmMappings).where(inArray(ssmMappings.capabilityId, capIds));
        await db.delete(ssmCapabilities).where(inArray(ssmCapabilities.id, capIds));
      }

      let mappingsCreated = 0;
      for (const platform of normalizedPlatforms) {
        const techniquesForPlatform = techniquesByPlatform.get(platform) || [];
        if (techniquesForPlatform.length === 0) continue;

        const [capability] = await db.insert(ssmCapabilities).values({
          productId,
          capabilityGroupId: `${WIZARD_GUIDED_SOURCE}_${slugifyPlatform(platform)}_${productId}`,
          name: `Guided Telemetry Coverage (${platform})`,
          description: `Telemetry coverage derived from guided questions.`,
          platform,
          source: WIZARD_GUIDED_SOURCE,
        }).returning();

        const mappings = techniquesForPlatform.map((tech) => ({
          capabilityId: capability.id,
          techniqueId: tech.id,
          techniqueName: tech.name || tech.id,
          mappingType: "Detect",
          scoreCategory: "Minimal",
          scoreValue: "Guided telemetry",
          comments: "Guided questions",
          metadata: {
            coverage_type: "wizard_guided",
            mapped_data_components: Array.from(tech.dataComponents),
            question_ids: Array.from(questionIds),
            stream_names: Array.from(streamNames),
          },
        }));

        if (mappings.length > 0) {
          await db.insert(ssmMappings).values(mappings);
          mappingsCreated += mappings.length;
        }
      }

      res.json({
        techniques: matchedTechniqueIds.size,
        dataComponents: resolvedComponents.length,
        sources: Array.from(dataSources),
        platforms: normalizedPlatforms,
        streams: streamNames.size,
        mappingsCreated,
        missingDataComponents: Array.from(missingNames),
      });
    } catch (error) {
      console.error("Error processing wizard coverage:", error);
      res.status(500).json({ error: "Failed to save wizard coverage" });
    }
  });

  // Get aliases for a product
  app.get("/api/products/:productId/aliases", async (req, res) => {
    try {
      const { productId } = req.params;
      const product = await db.select().from(products).where(eq(products.productId, productId)).limit(1);
      if (!product[0]) {
        return res.status(404).json({ error: "Product not found" });
      }
      const aliases = await db.select({
        id: productAliases.id,
        alias: productAliases.alias,
        confidence: productAliases.confidence,
        createdAt: productAliases.createdAt,
      }).from(productAliases).where(eq(productAliases.productId, product[0].id));
      res.json(aliases);
    } catch (error) {
      console.error("Error fetching product aliases:", error);
      res.status(500).json({ error: "Failed to fetch product aliases" });
    }
  });

  // Get SSM capabilities + mappings for a product
  app.get("/api/products/:productId/ssm", async (req, res) => {
    try {
      const { productId } = req.params;
      if (!productId) {
        return res.status(400).json({ error: "Invalid product ID" });
      }

      const caps = await db.select().from(ssmCapabilities).where(eq(ssmCapabilities.productId, productId));
      if (caps.length === 0) return res.json([]);

      const capIds = caps.map(cap => cap.id);
      const maps = await db.select().from(ssmMappings).where(inArray(ssmMappings.capabilityId, capIds));

      const result = caps.map(cap => ({
        ...cap,
        mappings: maps
          .filter(map => map.capabilityId === cap.id)
          .map(({ capabilityId: _capabilityId, ...rest }) => rest),
      }));

      res.json(result);
    } catch (error) {
      console.error("Error fetching SSM data:", error);
      res.status(500).json({ error: "Failed to fetch SSM data" });
    }
  });

  // Update SSM mapping metadata
  app.patch("/api/ssm/mappings/:mappingId", async (req, res) => {
    try {
      const mappingId = Number(req.params.mappingId);
      if (Number.isNaN(mappingId)) {
        return res.status(400).json({ error: "Invalid mapping ID" });
      }
      const { metadata } = req.body;
      if (!metadata || typeof metadata !== "object") {
        return res.status(400).json({ error: "metadata is required" });
      }
      const existing = await db.select().from(ssmMappings).where(eq(ssmMappings.id, mappingId)).limit(1);
      if (!existing[0]) {
        return res.status(404).json({ error: "Mapping not found" });
      }
      const nextMetadata = {
        ...(existing[0].metadata || {}),
        ...(metadata as Record<string, unknown>),
      };
      const updated = await db.update(ssmMappings)
        .set({ metadata: nextMetadata })
        .where(eq(ssmMappings.id, mappingId))
        .returning();
      res.json(updated[0]);
    } catch (error) {
      console.error("Error updating SSM mapping metadata:", error);
      res.status(500).json({ error: "Failed to update SSM mapping metadata" });
    }
  });

  // Add alias for a product
  app.post("/api/products/:productId/aliases", async (req, res) => {
    try {
      const { productId } = req.params;
      const { alias, confidence } = req.body;
      if (!alias || typeof alias !== "string") {
        return res.status(400).json({ error: "Alias is required" });
      }
      const product = await db.select().from(products).where(eq(products.productId, productId)).limit(1);
      if (!product[0]) {
        return res.status(404).json({ error: "Product not found" });
      }
      const newAlias = await productService.addAlias(product[0].id, alias, confidence || 100);
      res.status(201).json(newAlias);
    } catch (error) {
      console.error("Error adding product alias:", error);
      res.status(500).json({ error: "Failed to add product alias" });
    }
  });

  // Remove alias for a product
  app.delete("/api/products/:productId/aliases/:aliasId", async (req, res) => {
    try {
      const { productId, aliasId } = req.params;
      const aliasIdNumber = Number(aliasId);
      if (Number.isNaN(aliasIdNumber)) {
        return res.status(400).json({ error: "Invalid alias ID" });
      }
      const product = await db.select().from(products).where(eq(products.productId, productId)).limit(1);
      if (!product[0]) {
        return res.status(404).json({ error: "Product not found" });
      }
      const alias = await db.select().from(productAliases).where(
        and(eq(productAliases.id, aliasIdNumber), eq(productAliases.productId, product[0].id))
      ).limit(1);
      if (!alias[0]) {
        return res.status(404).json({ error: "Alias not found" });
      }
      const deleted = await productService.deleteAlias(aliasIdNumber);
      if (!deleted) {
        return res.status(404).json({ error: "Alias not found" });
      }
      res.json({ message: "Alias removed" });
    } catch (error) {
      console.error("Error deleting product alias:", error);
      res.status(500).json({ error: "Failed to delete product alias" });
    }
  });

  // Create product
  app.post("/api/products", async (req, res) => {
    try {
      const validation = insertProductSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: fromZodError(validation.error).toString() });
      }
      
      const product = await storage.createProduct(validation.data);
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  // Bulk create products
  app.post("/api/products/bulk", async (req, res) => {
    try {
      const { products } = req.body;
      if (!Array.isArray(products)) {
        return res.status(400).json({ error: "Expected array of products" });
      }
      
      await storage.bulkCreateProducts(products);
      res.status(201).json({ message: "Products created successfully" });
    } catch (error) {
      console.error("Error bulk creating products:", error);
      res.status(500).json({ error: "Failed to create products" });
    }
  });

  // Get all data components
  app.get("/api/data-components", async (req, res) => {
    try {
      const key = buildCacheKey(["data-components"]);
      await respondWithCache(key, 5 * 60 * 1000, () => storage.getAllDataComponents(), res);
    } catch (error) {
      console.error("Error fetching data components:", error);
      res.status(500).json({ error: "Failed to fetch data components" });
    }
  });

  // Get data component by ID
  app.get("/api/data-components/:componentId", async (req, res) => {
    try {
      const { componentId } = req.params;
      const component = await storage.getDataComponentById(componentId);
      
      if (!component) {
        return res.status(404).json({ error: "Data component not found" });
      }
      
      res.json(component);
    } catch (error) {
      console.error("Error fetching data component:", error);
      res.status(500).json({ error: "Failed to fetch data component" });
    }
  });

  // Bulk create data components
  app.post("/api/data-components/bulk", async (req, res) => {
    try {
      const { components } = req.body;
      if (!Array.isArray(components)) {
        return res.status(400).json({ error: "Expected array of components" });
      }
      
      await storage.bulkCreateDataComponents(components);
      res.status(201).json({ message: "Data components created successfully" });
    } catch (error) {
      console.error("Error bulk creating data components:", error);
      res.status(500).json({ error: "Failed to create data components" });
    }
  });

  // Get all detection strategies
  app.get("/api/detection-strategies", async (req, res) => {
    try {
      const key = buildCacheKey(["detection-strategies"]);
      await respondWithCache(key, 5 * 60 * 1000, () => storage.getAllDetectionStrategies(), res);
    } catch (error) {
      console.error("Error fetching detection strategies:", error);
      res.status(500).json({ error: "Failed to fetch detection strategies" });
    }
  });

  // Bulk create detection strategies
  app.post("/api/detection-strategies/bulk", async (req, res) => {
    try {
      const { strategies } = req.body;
      if (!Array.isArray(strategies)) {
        return res.status(400).json({ error: "Expected array of strategies" });
      }
      
      await storage.bulkCreateDetectionStrategies(strategies);
      res.status(201).json({ message: "Detection strategies created successfully" });
    } catch (error) {
      console.error("Error bulk creating detection strategies:", error);
      res.status(500).json({ error: "Failed to create detection strategies" });
    }
  });

  // Get technique names by IDs (from DB)
  app.post("/api/techniques/names", async (req, res) => {
    try {
      const { techniqueIds, limit, offset } = req.body;
      if (!Array.isArray(techniqueIds)) {
        return res.status(400).json({ error: "Expected techniqueIds array" });
      }
      const normalizedIds = techniqueIds
        .filter((id: unknown) => typeof id === "string" && id.trim().length > 0)
        .map((id: string) => id.trim().toUpperCase());
      if (normalizedIds.length === 0) {
        return res.json({ techniqueNames: {} });
      }

      const safeLimit = typeof limit === "number" && limit > 0 ? Math.min(limit, 500) : normalizedIds.length;
      const safeOffset = typeof offset === "number" && offset >= 0 ? offset : 0;
      const key = buildCacheKey([
        "technique-names",
        normalizedIds.join(","),
        safeLimit,
        safeOffset,
      ]);

      await respondWithCache(key, 10 * 60 * 1000, async () => {
        const rows = await db.select({
          techniqueId: techniques.techniqueId,
          name: techniques.name,
        })
          .from(techniques)
          .where(inArray(techniques.techniqueId, normalizedIds))
          .limit(safeLimit)
          .offset(safeOffset);

        const techniqueNames = rows.reduce<Record<string, string>>((acc, row) => {
          acc[row.techniqueId.toUpperCase()] = row.name;
          return acc;
        }, {});

        return { techniqueNames, total: normalizedIds.length, limit: safeLimit, offset: safeOffset };
      }, res);
    } catch (error) {
      console.error("Error fetching technique names:", error);
      res.status(500).json({ error: "Failed to fetch technique names" });
    }
  });

  // Get analytics by strategy ID
  app.get("/api/analytics/:strategyId", async (req, res) => {
    try {
      const { strategyId } = req.params;
      const analyticsList = await storage.getAnalyticsByStrategyId(strategyId);
      res.json(analyticsList);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Bulk create analytics
  app.post("/api/analytics/bulk", async (req, res) => {
    try {
      const { analytics } = req.body;
      if (!Array.isArray(analytics)) {
        return res.status(400).json({ error: "Expected array of analytics" });
      }
      
      await storage.bulkCreateAnalytics(analytics);
      res.status(201).json({ message: "Analytics created successfully" });
    } catch (error) {
      console.error("Error bulk creating analytics:", error);
      res.status(500).json({ error: "Failed to create analytics" });
    }
  });

  // Get all MITRE assets
  app.get("/api/mitre-assets", async (req, res) => {
    try {
      const assets = await storage.getAllMitreAssets();
      res.json(assets);
    } catch (error) {
      console.error("Error fetching MITRE assets:", error);
      res.status(500).json({ error: "Failed to fetch MITRE assets" });
    }
  });

  // Bulk create MITRE assets
  app.post("/api/mitre-assets/bulk", async (req, res) => {
    try {
      const { assets } = req.body;
      if (!Array.isArray(assets)) {
        return res.status(400).json({ error: "Expected array of assets" });
      }
      
      await storage.bulkCreateMitreAssets(assets);
      res.status(201).json({ message: "MITRE assets created successfully" });
    } catch (error) {
      console.error("Error bulk creating MITRE assets:", error);
      res.status(500).json({ error: "Failed to create MITRE assets" });
    }
  });

  // Auto-mapper endpoints
  
  // Run auto-mapper for a product
  app.post("/api/auto-mapper/run/:productId", async (req, res) => {
    try {
      const { productId } = req.params;
      const result = await runAutoMapper(productId);
      res.json(result);
    } catch (error) {
      console.error("Error running auto-mapper:", error);
      res.status(500).json({ error: "Failed to run auto-mapper" });
    }
  });

  // Get mapping status for a product
  app.get("/api/auto-mapper/mappings/:productId", async (req, res) => {
    try {
      const { productId } = req.params;
      const mapping = await getMappingStatus(productId);
      
      if (!mapping) {
        return res.status(404).json({ error: "No mapping found for this product" });
      }
      
      res.json(mapping);
    } catch (error) {
      console.error("Error fetching mapping:", error);
      res.status(500).json({ error: "Failed to fetch mapping" });
    }
  });

  // Get all product mappings
  app.get("/api/auto-mapper/mappings", async (req, res) => {
    try {
      const mappings = await getAllProductMappings();
      res.json(mappings);
    } catch (error) {
      console.error("Error fetching all mappings:", error);
      res.status(500).json({ error: "Failed to fetch mappings" });
    }
  });

  app.get("/api/detections", async (_req, res) => {
    try {
      const key = buildCacheKey(["detections"]);
      await respondWithCache(key, 5 * 60 * 1000, () => getAllDetections(), res);
    } catch (error) {
      console.error("Error fetching detections:", error);
      res.status(500).json({ error: "Failed to fetch detections" });
    }
  });

  // Get resource priority matrix
  app.get("/api/auto-mapper/priority", async (req, res) => {
    res.json(RESOURCE_PRIORITY);
  });

  // MITRE STIX Knowledge Graph endpoints
  
  // Initialize STIX data (trigger on server start or explicit call)
  app.post("/api/mitre-stix/init", async (req, res) => {
    try {
      await mitreKnowledgeGraph.ensureInitialized();
      const stats = mitreKnowledgeGraph.getStats();
      res.json({ status: 'initialized', stats });
    } catch (error) {
      console.error("Error initializing MITRE STIX data:", error);
      res.status(500).json({ error: "Failed to initialize MITRE STIX data" });
    }
  });

  // Get STIX stats
  app.get("/api/mitre-stix/stats", async (req, res) => {
    try {
      await mitreKnowledgeGraph.ensureInitialized();
      const key = buildCacheKey(["mitre-stix", "stats"]);
      await respondWithCache(key, 5 * 60 * 1000, () => Promise.resolve(mitreKnowledgeGraph.getStats()), res);
    } catch (error) {
      console.error("Error getting MITRE STIX stats:", error);
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  // Get log requirements for a technique
  app.get("/api/mitre-stix/technique/:techniqueId/requirements", async (req, res) => {
    try {
      await mitreKnowledgeGraph.ensureInitialized();
      const { techniqueId } = req.params;
      const requirements = mitreKnowledgeGraph.getLogRequirements(techniqueId);
      res.json({ techniqueId, requirements });
    } catch (error) {
      console.error("Error getting log requirements:", error);
      res.status(500).json({ error: "Failed to get log requirements" });
    }
  });

  // Get full mapping for multiple techniques
  app.post("/api/mitre-stix/techniques/mapping", async (req, res) => {
    try {
      await mitreKnowledgeGraph.ensureInitialized();
      const { techniqueIds, platforms } = req.body;
      
      if (!Array.isArray(techniqueIds)) {
        return res.status(400).json({ error: "techniqueIds must be an array" });
      }
      const platformKey = Array.isArray(platforms) ? platforms.join(",") : "";
      const key = buildCacheKey(["mitre-stix", "mapping", techniqueIds.join(","), platformKey]);
      await respondWithCache(
        key,
        5 * 60 * 1000,
        () => Promise.resolve(
          mitreKnowledgeGraph.getFullMappingForTechniques(
            techniqueIds,
            Array.isArray(platforms) ? platforms : undefined
          )
        ),
        res
      );
    } catch (error) {
      console.error("Error getting technique mapping:", error);
      res.status(500).json({ error: "Failed to get technique mapping" });
    }
  });

  app.get("/api/mitre-stix/platforms", async (_req, res) => {
    try {
      await mitreKnowledgeGraph.ensureInitialized();
      const key = buildCacheKey(["mitre-stix", "platforms"]);
      await respondWithCache(
        key,
        5 * 60 * 1000,
        () => Promise.resolve({ platforms: mitreKnowledgeGraph.getPlatforms() }),
        res
      );
    } catch (error) {
      console.error("Error getting MITRE platforms:", error);
      res.status(500).json({ error: "Failed to get MITRE platforms" });
    }
  });

  app.get("/api/mitre/data-components", async (req, res) => {
    try {
      await mitreKnowledgeGraph.ensureInitialized();
      const platform = typeof req.query.platform === "string" ? req.query.platform.trim() : "";
      const normalizedPlatform = platform.toLowerCase();
      const cacheKey = buildCacheKey(["mitre-data-components", normalizedPlatform || "all"]);

      await respondWithCache(
        cacheKey,
        5 * 60 * 1000,
        () => {
          const components = mitreKnowledgeGraph.getAllDataComponents().map(dc => {
            const derivedPlatforms = dc.derivedPlatforms || [];
            const isRecommended = normalizedPlatform
              ? derivedPlatforms.some(p => p.toLowerCase() === normalizedPlatform)
              : true;
            return {
              id: dc.id,
              name: dc.name,
              description: dc.description,
              dataSourceName: dc.dataSourceName,
              platforms: derivedPlatforms,
              relevanceScore: isRecommended ? 1 : 0,
            };
          });
          return Promise.resolve({ dataComponents: components });
        },
        res
      );
    } catch (error) {
      console.error("Error getting MITRE data components:", error);
      res.status(500).json({ error: "Failed to get MITRE data components" });
    }
  });

  app.get("/api/mitre/validate-dc", async (req, res) => {
    try {
      await mitreKnowledgeGraph.ensureInitialized();
      const idsParam = typeof req.query.ids === "string" ? req.query.ids : "";
      const requested = idsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      const validSet = new Set(
        mitreKnowledgeGraph.getAllDataComponents().map((dc) => dc.id.toLowerCase())
      );
      const valid: string[] = [];
      const invalid: string[] = [];
      requested.forEach((id) => {
        if (validSet.has(id.toLowerCase())) {
          valid.push(id);
        } else {
          invalid.push(id);
        }
      });
      res.json({ valid, invalid });
    } catch (error) {
      console.error("Error validating data components:", error);
      res.status(500).json({ error: "Failed to validate data components" });
    }
  });

  app.get("/api/graph/coverage", async (req, res) => {
    try {
      const mitreVersion = typeof req.query.mitreVersion === "string" ? req.query.mitreVersion : "18.1";
      const localVersion = typeof req.query.localVersion === "string" ? req.query.localVersion : "current";
      const productId = typeof req.query.productId === "string" ? req.query.productId : undefined;
      const scopeParam = typeof req.query.scope === "string" ? req.query.scope : "detection";
      const scope = scopeParam === "visibility" ? "visibility" : "detection";
      const platformsParam = typeof req.query.platforms === "string" ? req.query.platforms : "";
      const platforms = platformsParam
        ? platformsParam.split(",").map((p) => p.trim()).filter(Boolean)
        : [];

      const key = buildCacheKey(["graph-coverage", mitreVersion, localVersion, productId, platforms.join(","), scope]);
      await respondWithCache(
        key,
        30 * 1000,
        async () => ({ coverage: await getGlobalCoverage(mitreVersion, localVersion, productId, platforms, scope) }),
        res
      );
    } catch (error) {
      console.error("Error computing coverage:", error);
      res.status(500).json({ error: "Failed to compute coverage" });
    }
  });

  app.get("/api/graph/coverage/paths", async (req, res) => {
    try {
      const mitreVersion = typeof req.query.mitreVersion === "string" ? req.query.mitreVersion : "18.1";
      const localVersion = typeof req.query.localVersion === "string" ? req.query.localVersion : "current";
      const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 200;
      const safeLimit = Number.isNaN(limit) ? 200 : limit;
      const key = buildCacheKey(["graph-coverage-paths", mitreVersion, localVersion, safeLimit]);
      await respondWithCache(
        key,
        30 * 1000,
        async () => ({ paths: await getCoveragePaths(mitreVersion, localVersion, safeLimit) }),
        res
      );
    } catch (error) {
      console.error("Error computing coverage paths:", error);
      res.status(500).json({ error: "Failed to compute coverage paths" });
    }
  });

  app.get("/api/graph/gaps", async (req, res) => {
    try {
      const mitreVersion = typeof req.query.mitreVersion === "string" ? req.query.mitreVersion : "18.1";
      const localVersion = typeof req.query.localVersion === "string" ? req.query.localVersion : "current";
      const productId = typeof req.query.productId === "string" ? req.query.productId : undefined;
      const platformsParam = typeof req.query.platforms === "string" ? req.query.platforms : "";
      const platforms = platformsParam
        ? platformsParam.split(",").map((p) => p.trim()).filter(Boolean)
        : [];

      let productDbId: number | undefined;
      if (productId) {
        const product = await db.select()
          .from(products)
          .where(eq(products.productId, productId))
          .limit(1);
        productDbId = product[0]?.id;
      }

      const key = buildCacheKey(["graph-gaps", mitreVersion, localVersion, productId, platforms.join(",")]);
      await respondWithCache(
        key,
        30 * 1000,
        async () => ({ gaps: await getCoverageGaps(mitreVersion, localVersion, productDbId, platforms) }),
        res
      );
    } catch (error) {
      console.error("Error computing gaps:", error);
      res.status(500).json({ error: "Failed to compute gaps" });
    }
  });

  // Get strategies for a technique
  app.get("/api/mitre-stix/technique/:techniqueId/strategies", async (req, res) => {
    try {
      await mitreKnowledgeGraph.ensureInitialized();
      const { techniqueId } = req.params;
      const strategies = mitreKnowledgeGraph.getStrategiesForTechnique(techniqueId);
      res.json({ techniqueId, strategies });
    } catch (error) {
      console.error("Error getting strategies:", error);
      res.status(500).json({ error: "Failed to get strategies" });
    }
  });

  // Hybrid Selector endpoints
  
  // Get hybrid selector options (master list)
  app.get("/api/hybrid-selector/options", async (req, res) => {
    const options = [
      { label: "Windows Endpoint", type: "platform", value: "Windows" },
      { label: "Linux Server/Endpoint", type: "platform", value: "Linux" },
      { label: "macOS Endpoint", type: "platform", value: "macOS" },
      { label: "Identity Provider (Azure AD/Okta)", type: "platform", value: "Identity Provider" },
      { label: "Cloud Infrastructure (AWS/Azure/GCP)", type: "platform", value: "IaaS" },
      { label: "SaaS Application (M365/Salesforce)", type: "platform", value: "SaaS" },
      { label: "Container / Kubernetes", type: "platform", value: "Containers" },
      { label: "Network Devices (Router/Switch/Firewall)", type: "platform", value: "Network" },
      { label: "Office Suite (M365/Google Workspace)", type: "platform", value: "Office 365" },
      { label: "ESXi / VMware", type: "platform", value: "ESXi" },
    ];
    res.json(options);
  });

  // Get techniques by hybrid selector
  app.post("/api/mitre-stix/techniques/by-selector", async (req, res) => {
    try {
      await mitreKnowledgeGraph.ensureInitialized();
      const { selectorType, selectorValue } = req.body;
      
      if (!selectorType || !selectorValue) {
        return res.status(400).json({ error: "selectorType and selectorValue are required" });
      }
      
      if (selectorType !== 'platform') {
        return res.status(400).json({ 
          error: "Only 'platform' selectorType is supported (Enterprise ATT&CK focus)" 
        });
      }
      
      const techniqueIds = mitreKnowledgeGraph.getTechniquesByHybridSelector(selectorType, selectorValue);
      res.json({ techniqueIds, count: techniqueIds.length });
    } catch (error) {
      console.error("Error getting techniques by selector:", error);
      res.status(500).json({ error: "Failed to get techniques" });
    }
  });

  // Update product hybrid selector (platform type only, multi-select)
  app.patch("/api/products/:productId/hybrid-selector", async (req, res) => {
    try {
      const { productId } = req.params;
      let { hybridSelectorType, hybridSelectorValues } = req.body;

      if (!hybridSelectorType) {
        return res.status(400).json({ error: "hybridSelectorType is required" });
      }

      if (!Array.isArray(hybridSelectorValues)) {
        return res.status(400).json({ error: "hybridSelectorValues must be an array of platform names" });
      }

      if (hybridSelectorType !== 'platform') {
        return res.status(400).json({ error: "Only 'platform' type is supported" });
      }

      const updated = await storage.updateProductHybridSelector(productId, hybridSelectorType, hybridSelectorValues);

      if (!updated) {
        return res.status(404).json({ error: "Product not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating product hybrid selector:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  // ============================================================
  // Admin API Routes - Phase 2: Intelligence & Persistence
  // ============================================================

  // Get all products (with optional source filter)
  app.get("/api/admin/products", async (req, res) => {
    try {
      const source = req.query.source as string | undefined;
      if (source) {
        const products = await productService.getProductsBySource(source);
        res.json(products);
      } else {
        const products = await productService.getAllProducts();
        res.json(products);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  // Search products with alias resolution
  app.get("/api/admin/products/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      const results = await productService.searchProducts(query || '');
      res.json(results);
    } catch (error) {
      console.error("Error searching products:", error);
      res.status(500).json({ error: "Failed to search products" });
    }
  });

  // Resolve search terms for a product (for debugging/inspection)
  app.get("/api/admin/products/resolve/:query", async (req, res) => {
    try {
      const { query } = req.params;
      const resolved = await productService.resolveSearchTerms(query);
      if (!resolved) {
        return res.status(404).json({ error: "Could not resolve product" });
      }
      res.json(resolved);
    } catch (error) {
      console.error("Error resolving search terms:", error);
      res.status(500).json({ error: "Failed to resolve search terms" });
    }
  });

  // Create a custom product
  app.post("/api/admin/products", async (req, res) => {
    try {
      const validation = insertProductSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: fromZodError(validation.error).toString() });
      }

      const autoMap = req.query.autoMap !== "false";
      const product = await productService.createProduct(validation.data, { autoMap });
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  // Update a product
  app.patch("/api/admin/products/:productId", async (req, res) => {
    try {
      const { productId } = req.params;
      const updated = await productService.updateProduct(productId, req.body);

      if (!updated) {
        return res.status(404).json({ error: "Product not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  // Delete a product
  app.delete("/api/admin/products/:productId", async (req, res) => {
    try {
      const { productId } = req.params;
      const deleted = await productService.deleteProduct(productId);

      if (!deleted) {
        return res.status(404).json({ error: "Product not found" });
      }

      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // ============================================================
  // Alias Management Routes
  // ============================================================

  // Get all aliases
  app.get("/api/admin/aliases", async (req, res) => {
    try {
      const aliases = await productService.getAllAliases();
      res.json(aliases);
    } catch (error) {
      console.error("Error fetching aliases:", error);
      res.status(500).json({ error: "Failed to fetch aliases" });
    }
  });

  // Add a new alias (accepts productId or productName)
  app.post("/api/admin/aliases", async (req, res) => {
    try {
      const { productId, productName, alias, confidence } = req.body;

      if (!alias) {
        return res.status(400).json({ error: "alias is required" });
      }

      if (!productId && !productName) {
        return res.status(400).json({ error: "Either productId (number) or productName (string) is required" });
      }

      let newAlias;

      if (typeof productId === 'number') {
        // Use direct productId (integer FK)
        newAlias = await productService.addAlias(productId, alias, confidence || 100);
      } else if (productName) {
        // Lookup product by name first
        newAlias = await productService.addAliasByName(productName, alias, confidence || 100);
        if (!newAlias) {
          return res.status(404).json({ error: `Product "${productName}" not found` });
        }
      }

      res.status(201).json(newAlias);
    } catch (error) {
      console.error("Error adding alias:", error);
      res.status(500).json({ error: "Failed to add alias" });
    }
  });

  // Bulk add aliases
  app.post("/api/admin/aliases/bulk", async (req, res) => {
    try {
      const { aliases } = req.body;
      if (!Array.isArray(aliases)) {
        return res.status(400).json({ error: "Expected array of aliases" });
      }

      await productService.bulkAddAliases(aliases);
      res.status(201).json({ message: "Aliases added successfully" });
    } catch (error) {
      console.error("Error bulk adding aliases:", error);
      res.status(500).json({ error: "Failed to add aliases" });
    }
  });

  // Delete an alias
  app.delete("/api/admin/aliases/:aliasId", async (req, res) => {
    try {
      const aliasId = parseInt(req.params.aliasId, 10);

      if (isNaN(aliasId)) {
        return res.status(400).json({ error: "Invalid alias ID" });
      }

      const deleted = await productService.deleteAlias(aliasId);

      if (!deleted) {
        return res.status(404).json({ error: "Alias not found" });
      }

      res.json({ message: "Alias deleted successfully" });
    } catch (error) {
      console.error("Error deleting alias:", error);
      res.status(500).json({ error: "Failed to delete alias" });
    }
  });

  // Update an alias
  app.patch("/api/admin/aliases/:aliasId", async (req, res) => {
    try {
      const aliasId = parseInt(req.params.aliasId, 10);
      if (isNaN(aliasId)) {
        return res.status(400).json({ error: "Invalid alias ID" });
      }

      const { alias, confidence } = req.body;
      if (!alias) {
        return res.status(400).json({ error: "alias is required" });
      }

      const updated = await productService.updateAlias(aliasId, alias, confidence);
      if (!updated) {
        return res.status(404).json({ error: "Alias not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating alias:", error);
      res.status(500).json({ error: "Failed to update alias" });
    }
  });

  // ============================================================
  // Maintenance Routes
  // ============================================================

  // Get system status
  app.get("/api/admin/status", async (req, res) => {
    try {
      const key = buildCacheKey(["admin-status"]);
      await respondWithCache(
        key,
        30 * 1000,
        async () => {
          const [products, aliases, repoStatus, lastMitreSync, startupLog] = await Promise.all([
            productService.getAllProducts(),
            productService.getAllAliases(),
            adminService.getRepoStatus(),
            adminService.getLastMitreSync(),
            adminService.getStartupLog()
          ]);

          const stixStats = mitreKnowledgeGraph.getStats();

          return {
            products: {
              total: products.length,
              bySource: {
                ctid: products.filter(p => p.source === 'ctid').length,
                custom: products.filter(p => p.source === 'custom').length,
                'ai-pending': products.filter(p => p.source === 'ai-pending').length
              }
            },
            aliases: aliases.length,
            stix: stixStats,
            sigma: repoStatus.sigma,
            repos: repoStatus,
            lastMitreSync,
            startupLog,
            timestamp: new Date().toISOString()
          };
        },
        res
      );
    } catch (error) {
      console.error("Error getting system status:", error);
      res.status(500).json({ error: "Failed to get system status" });
    }
  });

  // Refresh Sigma Rules (Smart Git Pull/Clone)
  app.post("/api/admin/maintenance/refresh-sigma", async (req, res) => {
    try {
      const result = await adminService.smartRefreshSigmaRules();
      res.json(result);
    } catch (error) {
      console.error("Error refreshing Sigma rules:", error);
      res.status(500).json({ error: "Failed to refresh Sigma rules" });
    }
  });

  app.post("/api/admin/maintenance/refresh-splunk", async (req, res) => {
    try {
      const result = await adminService.smartRefreshRepo('splunk');
      res.json(result);
    } catch (error) {
      console.error("Error refreshing Splunk rules:", error);
      res.status(500).json({ error: "Failed to refresh Splunk rules" });
    }
  });

  app.post("/api/admin/maintenance/refresh-elastic", async (req, res) => {
    try {
      const result = await adminService.smartRefreshRepo('elastic');
      res.json(result);
    } catch (error) {
      console.error("Error refreshing Elastic rules:", error);
      res.status(500).json({ error: "Failed to refresh Elastic rules" });
    }
  });

  app.post("/api/admin/maintenance/refresh-azure", async (req, res) => {
    try {
      const result = await adminService.smartRefreshRepo('azure');
      res.json(result);
    } catch (error) {
      console.error("Error refreshing Azure Sentinel rules:", error);
      res.status(500).json({ error: "Failed to refresh Azure Sentinel rules" });
    }
  });

  app.post("/api/admin/maintenance/refresh-ctid", async (req, res) => {
    try {
      const result = await adminService.smartRefreshRepo('ctid');
      res.json(result);
    } catch (error) {
      console.error("Error refreshing CTID mappings:", error);
      res.status(500).json({ error: "Failed to refresh CTID mappings" });
    }
  });

  // Refresh MITRE data (STIX flatten + upsert)
  app.post("/api/admin/maintenance/refresh-mitre", async (req, res) => {
    try {
      const result = await adminService.syncMitreData('manual');
      res.json(result);
    } catch (error) {
      console.error("Error refreshing MITRE data:", error);
      res.status(500).json({ error: "Failed to refresh MITRE data" });
    }
  });

  return httpServer;
}
