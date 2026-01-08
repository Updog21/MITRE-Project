import { CTIDAdapter } from './adapters/ctid';
import { SigmaAdapter } from './adapters/sigma';
import { ElasticAdapter } from './adapters/elastic';
import { SplunkAdapter } from './adapters/splunk';
import { MitreStixAdapter } from './adapters/mitre-stix';
import { ResourceAdapter, NormalizedMapping, ResourceType } from './types';
import { db } from '../db';
import { products, productMappings } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const adapters: Record<ResourceType, ResourceAdapter> = {
  ctid: new CTIDAdapter(),
  sigma: new SigmaAdapter(),
  elastic: new ElasticAdapter(),
  splunk: new SplunkAdapter(),
  mitre_stix: new MitreStixAdapter(),
};

const COMMUNITY_RESOURCE_ORDER: ResourceType[] = ['ctid', 'splunk', 'sigma', 'elastic'];

export interface MappingResult {
  productId: string;
  status: 'matched' | 'partial' | 'ai_pending' | 'not_found';
  source?: ResourceType;
  sources?: ResourceType[];
  confidence?: number;
  mapping?: NormalizedMapping;
  error?: string;
}

export async function runAutoMapper(productId: string): Promise<MappingResult> {
  const product = await db.select().from(products).where(eq(products.productId, productId)).limit(1);
  
  if (!product[0]) {
    return { productId, status: 'not_found', error: 'Product not found' };
  }

  const { productName, vendor } = product[0];

  const allMappings: NormalizedMapping[] = [];
  const successfulSources: ResourceType[] = [];

  for (const resourceType of COMMUNITY_RESOURCE_ORDER) {
    const adapter = adapters[resourceType];
    
    try {
      const cached = await getCachedMapping(productId, resourceType);
      if (cached) {
        allMappings.push(cached);
        successfulSources.push(resourceType);
        continue;
      }

      const mapping = await adapter.fetchMappings(productName, vendor);
      
      if (mapping && mapping.analytics.length > 0) {
        await saveMappingResult(productId, resourceType, 'matched', mapping);
        allMappings.push(mapping);
        successfulSources.push(resourceType);
      } else {
        await saveMappingResult(productId, resourceType, 'not_found', null);
      }
    } catch (error) {
      console.error(`Error fetching from ${resourceType}:`, error);
    }
  }

  if (allMappings.length === 0) {
    await saveMappingResult(productId, 'mitre_stix', 'ai_pending', null);
    
    return {
      productId,
      status: 'ai_pending',
      error: 'No mappings found in any resource. Marked for AI-assisted mapping.',
    };
  }

  const combinedMapping = combineAllMappings(productId, allMappings, successfulSources);
  
  return {
    productId,
    status: 'matched',
    source: successfulSources[0],
    sources: successfulSources,
    confidence: combinedMapping.confidence,
    mapping: combinedMapping,
  };
}

function combineAllMappings(
  productId: string,
  mappings: NormalizedMapping[],
  sources: ResourceType[]
): NormalizedMapping {
  const techniqueSet = new Set<string>();
  const analyticsMap = new Map<string, NormalizedMapping['analytics'][0]>();
  const dataComponentsMap = new Map<string, NormalizedMapping['dataComponents'][0]>();
  const rawDataList: any[] = [];

  for (const mapping of mappings) {
    for (const ds of mapping.detectionStrategies) {
      techniqueSet.add(ds);
    }
    
    for (const analytic of mapping.analytics) {
      if (!analyticsMap.has(analytic.id)) {
        analyticsMap.set(analytic.id, analytic);
      }
    }
    
    for (const dc of mapping.dataComponents) {
      if (!dataComponentsMap.has(dc.id)) {
        dataComponentsMap.set(dc.id, dc);
      }
    }
    
    if (mapping.rawData) {
      rawDataList.push(...(Array.isArray(mapping.rawData) ? mapping.rawData : [mapping.rawData]));
    }
  }

  const totalAnalytics = Array.from(analyticsMap.values()).length;
  const confidence = Math.min(100, totalAnalytics * 5 + sources.length * 10);

  return {
    productId,
    source: sources.join('+') as any,
    confidence,
    detectionStrategies: Array.from(techniqueSet),
    analytics: Array.from(analyticsMap.values()),
    dataComponents: Array.from(dataComponentsMap.values()),
    rawData: rawDataList,
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
  const allMappings = await db.select()
    .from(productMappings)
    .where(eq(productMappings.productId, productId));

  if (allMappings.length === 0) {
    return null;
  }

  const matchedMappings = allMappings.filter(m => m.status === 'matched' && m.rawMapping);
  
  if (matchedMappings.length === 0) {
    const firstMapping = allMappings[0];
    return {
      productId,
      status: firstMapping.status as MappingResult['status'],
      source: firstMapping.resourceType as ResourceType,
    };
  }

  const sources = matchedMappings.map(m => m.resourceType as ResourceType);
  const normalizedMappings = matchedMappings.map(m => m.rawMapping as NormalizedMapping);
  const combinedMapping = combineAllMappings(productId, normalizedMappings, sources);

  return {
    productId,
    status: 'matched',
    source: sources[0],
    sources,
    confidence: combinedMapping.confidence,
    mapping: combinedMapping,
  };
}

export async function getAllProductMappings(): Promise<MappingResult[]> {
  const allProducts = await db.select().from(products);
  const allMappings = await db.select().from(productMappings);

  const mappingsByProduct = new Map<string, (typeof allMappings)[0][]>();
  for (const m of allMappings) {
    const existing = mappingsByProduct.get(m.productId) || [];
    existing.push(m);
    mappingsByProduct.set(m.productId, existing);
  }

  return allProducts.map(product => {
    const productMaps = mappingsByProduct.get(product.productId) || [];
    const matched = productMaps.filter(m => m.status === 'matched');
    
    if (matched.length > 0) {
      return {
        productId: product.productId,
        status: 'matched' as const,
        source: matched[0].resourceType as ResourceType,
        sources: matched.map(m => m.resourceType as ResourceType),
        confidence: matched[0].confidence || undefined,
      };
    }
    
    if (productMaps.length > 0) {
      return {
        productId: product.productId,
        status: productMaps[0].status as MappingResult['status'],
        source: productMaps[0].resourceType as ResourceType,
      };
    }
    
    return {
      productId: product.productId,
      status: 'not_found' as const,
    };
  });
}
