import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProductSchema, insertDataComponentSchema, insertDetectionStrategySchema, insertAnalyticSchema, insertMitreAssetSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { runAutoMapper, getMappingStatus, getAllProductMappings, RESOURCE_PRIORITY } from "./auto-mapper";
import { mitreKnowledgeGraph } from "./mitre-stix";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
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
      const components = await storage.getAllDataComponents();
      res.json(components);
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
      const strategies = await storage.getAllDetectionStrategies();
      res.json(strategies);
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
      const stats = mitreKnowledgeGraph.getStats();
      res.json(stats);
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
      const { techniqueIds, platform } = req.body;
      
      if (!Array.isArray(techniqueIds)) {
        return res.status(400).json({ error: "techniqueIds must be an array" });
      }
      
      const mapping = mitreKnowledgeGraph.getFullMappingForTechniques(techniqueIds, platform);
      res.json(mapping);
    } catch (error) {
      console.error("Error getting technique mapping:", error);
      res.status(500).json({ error: "Failed to get technique mapping" });
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

  return httpServer;
}
