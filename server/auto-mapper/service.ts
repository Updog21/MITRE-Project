import { CTIDAdapter } from './adapters/ctid';
import { SigmaAdapter } from './adapters/sigma';
import { ElasticAdapter } from './adapters/elastic';
import { SplunkAdapter } from './adapters/splunk';
import { MitreStixAdapter } from './adapters/mitre-stix';
import { ResourceAdapter, NormalizedMapping, RESOURCE_PRIORITY, ResourceType } from './types';
import { db } from '../db';
import { products, productMappings, resourceCache } from '@shared/schema';
import { eq, and, gt } from 'drizzle-orm';

const adapters: Record<ResourceType, ResourceAdapter> = {
  ctid: new CTIDAdapter(),
  sigma: new SigmaAdapter(),
  elastic: new ElasticAdapter(),
  splunk: new SplunkAdapter(),
  mitre_stix: new MitreStixAdapter(),
};

export interface MappingResult {
  productId: string;
  status: 'matched' | 'partial' | 'ai_pending' | 'not_found';
  source?: ResourceType;
  confidence?: number;
  mapping?: NormalizedMapping;
  error?: string;
}

export async function runAutoMapper(productId: string): Promise<MappingResult> {
  const product = await db.select().from(products).where(eq(products.productId, productId)).limit(1);
  
  if (!product[0]) {
    return { productId, status: 'not_found', error: 'Product not found' };
  }

  const { productName, vendor, productType, platforms } = product[0];
  const type = (productType || 'default') as keyof typeof RESOURCE_PRIORITY;
  const priority = RESOURCE_PRIORITY[type] || RESOURCE_PRIORITY.default;

  for (const resourceType of priority) {
    const adapter = adapters[resourceType];
    
    if (!adapter.isApplicable(type, platforms)) {
      continue;
    }

    try {
      const cached = await getCachedMapping(productId, resourceType);
      if (cached) {
        return {
          productId,
          status: 'matched',
          source: resourceType,
          confidence: cached.confidence,
          mapping: cached,
        };
      }

      const mapping = await adapter.fetchMappings(productName, vendor);
      
      if (mapping && mapping.analytics.length > 0) {
        await saveMappingResult(productId, resourceType, 'matched', mapping);
        
        return {
          productId,
          status: 'matched',
          source: resourceType,
          confidence: mapping.confidence,
          mapping,
        };
      }
    } catch (error) {
      console.error(`Error fetching from ${resourceType}:`, error);
    }
  }

  await saveMappingResult(productId, 'mitre_stix', 'ai_pending', null);
  
  return {
    productId,
    status: 'ai_pending',
    error: 'No mappings found in any resource. Marked for AI-assisted mapping.',
  };
}

async function getCachedMapping(productId: string, resourceType: ResourceType): Promise<NormalizedMapping | null> {
  const cached = await db.select()
    .from(productMappings)
    .where(
      and(
        eq(productMappings.productId, productId),
        eq(productMappings.resourceType, resourceType),
        eq(productMappings.status, 'matched')
      )
    )
    .limit(1);

  if (cached[0] && cached[0].rawMapping) {
    return cached[0].rawMapping as NormalizedMapping;
  }

  return null;
}

async function saveMappingResult(
  productId: string, 
  resourceType: ResourceType, 
  status: string, 
  mapping: NormalizedMapping | null
): Promise<void> {
  const existing = await db.select()
    .from(productMappings)
    .where(
      and(
        eq(productMappings.productId, productId),
        eq(productMappings.resourceType, resourceType)
      )
    )
    .limit(1);

  const mappingData = {
    productId,
    resourceType,
    status,
    confidence: mapping?.confidence || null,
    detectionStrategyIds: mapping?.detectionStrategies || [],
    analyticIds: mapping?.analytics.map(a => a.id) || [],
    dataComponentIds: mapping?.dataComponents.map(dc => dc.id) || [],
    rawMapping: mapping,
    updatedAt: new Date(),
  };

  if (existing[0]) {
    await db.update(productMappings)
      .set(mappingData)
      .where(eq(productMappings.id, existing[0].id));
  } else {
    await db.insert(productMappings).values(mappingData);
  }
}

export async function getMappingStatus(productId: string): Promise<MappingResult | null> {
  const mapping = await db.select()
    .from(productMappings)
    .where(eq(productMappings.productId, productId))
    .orderBy(productMappings.updatedAt)
    .limit(1);

  if (!mapping[0]) {
    return null;
  }

  return {
    productId,
    status: mapping[0].status as MappingResult['status'],
    source: mapping[0].resourceType as ResourceType,
    confidence: mapping[0].confidence || undefined,
    mapping: mapping[0].rawMapping as NormalizedMapping | undefined,
  };
}

export async function getAllProductMappings(): Promise<MappingResult[]> {
  const allProducts = await db.select().from(products);
  const allMappings = await db.select().from(productMappings);

  const mappingsByProduct = new Map<string, typeof allMappings[0]>();
  for (const m of allMappings) {
    if (!mappingsByProduct.has(m.productId) || m.status === 'matched') {
      mappingsByProduct.set(m.productId, m);
    }
  }

  return allProducts.map(product => {
    const mapping = mappingsByProduct.get(product.productId);
    if (mapping) {
      return {
        productId: product.productId,
        status: mapping.status as MappingResult['status'],
        source: mapping.resourceType as ResourceType,
        confidence: mapping.confidence || undefined,
      };
    }
    return {
      productId: product.productId,
      status: 'not_found' as const,
    };
  });
}
