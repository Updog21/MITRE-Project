import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProductSchema, insertDataComponentSchema, insertDetectionStrategySchema, insertAnalyticSchema, insertMitreAssetSchema, insertProductAliasSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { runAutoMapper, getMappingStatus, getAllProductMappings, RESOURCE_PRIORITY } from "./auto-mapper";
import { mitreKnowledgeGraph } from "./mitre-stix";
import { productService } from "./services";

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
      const { techniqueIds } = req.body;
      
      if (!Array.isArray(techniqueIds)) {
        return res.status(400).json({ error: "techniqueIds must be an array" });
      }
      
      const mapping = mitreKnowledgeGraph.getFullMappingForTechniques(techniqueIds);
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

      const product = await productService.createProduct(validation.data);
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

  // ============================================================
  // Maintenance Routes
  // ============================================================

  // Get system status
  app.get("/api/admin/status", async (req, res) => {
    try {
      const [products, aliases] = await Promise.all([
        productService.getAllProducts(),
        productService.getAllAliases()
      ]);

      const stixStats = mitreKnowledgeGraph.getStats();

      res.json({
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
        sigmaPath: './data/sigma',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error getting system status:", error);
      res.status(500).json({ error: "Failed to get system status" });
    }
  });

  return httpServer;
}
