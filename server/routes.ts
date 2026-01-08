import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProductSchema, insertDataComponentSchema, insertDetectionStrategySchema, insertAnalyticSchema, insertMitreAssetSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

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

  return httpServer;
}
