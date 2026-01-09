import { db } from "../server/db";
import { products, dataComponents, detectionStrategies, analytics, mitreAssets } from "../shared/schema";

// Import hardcoded data from frontend
import { ctidProducts, dataComponents as dcData, detectionStrategies as dsData, mitreAssets as maData } from "../client/src/lib/mitreData";

async function seedDatabase() {
  console.log("[*] Starting database seed...");

  try {
    // Seed MITRE Assets
    console.log("[*] Seeding MITRE Assets...");
    const assetData = Object.values(maData).map(asset => ({
      assetId: asset.id,
      name: asset.name,
      domain: asset.domain,
      description: asset.description,
    }));
    
    await db.insert(mitreAssets).values(assetData).onConflictDoNothing();
    console.log(`[✓] Seeded ${assetData.length} MITRE assets`);

    // Seed Data Components
    console.log("[*] Seeding Data Components...");
    const dcDataValues = Object.values(dcData).map(dc => ({
      componentId: dc.id,
      name: dc.name,
      dataSourceName: dc.dataSource,
      description: dc.description,
      dataCollectionMeasures: dc.dataCollectionMeasures?.map(m => `${m.platform}: ${m.description}`) || [],
      logSources: dc.logSources || [],
    }));
    
    await db.insert(dataComponents).values(dcDataValues).onConflictDoNothing();
    console.log(`[✓] Seeded ${dcDataValues.length} data components`);

    // Seed Detection Strategies
    console.log("[*] Seeding Detection Strategies...");
    const dsDataValues = Object.values(dsData).map(ds => ({
      strategyId: ds.id,
      name: ds.name,
      description: ds.description,
    }));
    
    await db.insert(detectionStrategies).values(dsDataValues).onConflictDoNothing();
    console.log(`[✓] Seeded ${dsDataValues.length} detection strategies`);

    // Seed Analytics
    console.log("[*] Seeding Analytics...");
    const analyticsData = Object.values(dsData).flatMap(strategy => 
      strategy.analytics.map(analytic => ({
        analyticId: analytic.id,
        strategyId: strategy.id,
        name: analytic.name,
        description: analytic.description,
        pseudocode: analytic.pseudocode,
        dataComponentIds: analytic.dataComponents,
        logSources: [],
        mutableElements: [],
      }))
    );
    
    if (analyticsData.length > 0) {
      await db.insert(analytics).values(analyticsData).onConflictDoNothing();
      console.log(`[✓] Seeded ${analyticsData.length} analytics`);
    }

    // Seed Products
    console.log("[*] Seeding Products...");
    const productsData = ctidProducts.map(product => ({
      productId: product.id,
      vendor: product.vendor,
      productName: product.productName,
      deployment: product.deployment,
      description: product.description,
      platforms: product.platforms,
      dataComponentIds: product.dataComponentIds,
      mitreAssetIds: product.mitreAssetIds || [],
      source: product.source,
    }));
    
    await db.insert(products).values(productsData).onConflictDoNothing();
    console.log(`[✓] Seeded ${productsData.length} products`);

    console.log("[✓] Database seed completed successfully!");
  } catch (error) {
    console.error("[✗] Error seeding database:", error);
    throw error;
  }
}

seedDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
