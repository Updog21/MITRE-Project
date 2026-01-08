import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";

export interface StixDetectionStrategy {
  id: string;
  name: string;
  description: string;
  techniques: string[];
  analytics: StixAnalytic[];
}

export interface StixAnalytic {
  id: string;
  name: string;
  description: string;
  platforms: string[];
  dataComponents: string[];
}

export interface StixDataComponent {
  id: string;
  name: string;
  dataSource: string;
}

export interface EnrichedCommunityMapping {
  source: string;
  confidence: number;
  techniqueIds: string[];
  detectionStrategies: StixDetectionStrategy[];
  dataComponents: StixDataComponent[];
  communityAnalytics: AnalyticMapping[];
}

export interface AnalyticMapping {
  id: string;
  name: string;
  description?: string;
  logSources?: string[];
  query?: string;
}

export interface DataComponentMapping {
  id: string;
  name: string;
  dataSource?: string;
  eventIds?: string[];
}

export interface NormalizedMapping {
  productId: string;
  source: string;
  confidence: number;
  detectionStrategies: string[];
  analytics: AnalyticMapping[];
  dataComponents: DataComponentMapping[];
  rawData: unknown;
}

export interface MappingResult {
  productId: string;
  status: 'matched' | 'partial' | 'ai_pending' | 'not_found';
  source?: string;
  confidence?: number;
  mapping?: NormalizedMapping;
  error?: string;
}

async function fetchMappingStatus(productId: string): Promise<MappingResult | null> {
  const response = await fetch(`/api/auto-mapper/mappings/${productId}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error('Failed to fetch mapping status');
  }
  return response.json();
}

async function runAutoMapper(productId: string): Promise<MappingResult> {
  const response = await fetch(`/api/auto-mapper/run/${productId}`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to run auto-mapper');
  }
  return response.json();
}

export function useMappingStatus(productId: string) {
  return useQuery({
    queryKey: ['mapping', productId],
    queryFn: () => fetchMappingStatus(productId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRunAutoMapper() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: runAutoMapper,
    onSuccess: (data) => {
      queryClient.setQueryData(['mapping', data.productId], data);
    },
  });
}

export interface HybridSelectorTechniques {
  techniqueIds: string[];
  count: number;
  selectorType: 'platform';
  selectorValue: string;
}

async function fetchTechniquesBySelector(
  selectorType: 'platform',
  selectorValue: string
): Promise<{ techniqueIds: string[]; count: number }> {
  const response = await fetch('/api/mitre-stix/techniques/by-selector', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selectorType, selectorValue }),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch techniques by selector');
  }
  return response.json();
}

export function useAutoMappingWithAutoRun(
  productId: string, 
  platform?: string,
  hybridSelector?: { type: 'platform'; value: string } | null
) {
  const queryClient = useQueryClient();
  
  const statusQuery = useQuery({
    queryKey: ['mapping', productId],
    queryFn: () => fetchMappingStatus(productId),
    staleTime: 5 * 60 * 1000,
  });

  const autoRunMutation = useMutation({
    mutationFn: runAutoMapper,
    onSuccess: (data) => {
      queryClient.setQueryData(['mapping', data.productId], data);
    },
  });

  const shouldAutoRun = statusQuery.isSuccess && 
                        !statusQuery.isFetching &&
                        statusQuery.data === null && 
                        !autoRunMutation.isPending && 
                        !autoRunMutation.isSuccess &&
                        !autoRunMutation.isError;

  const rawData = autoRunMutation.data || statusQuery.data;

  const [stixMapping, setStixMapping] = useState<{
    detectionStrategies: StixDetectionStrategy[];
    dataComponents: StixDataComponent[];
  } | null>(null);
  const [stixLoading, setStixLoading] = useState(false);
  
  const [hybridTechniques, setHybridTechniques] = useState<HybridSelectorTechniques | null>(null);
  const [hybridLoading, setHybridLoading] = useState(false);

  const baseTechniqueIds = useMemo(() => {
    if (!rawData?.mapping || rawData.status !== 'matched') {
      return [];
    }
    
    const rawStrategies = rawData.mapping.detectionStrategies || [];
    return rawStrategies.map((id: string) => {
      if (id.startsWith('DS-')) {
        return id.substring(3);
      }
      return id;
    });
  }, [rawData]);

  useEffect(() => {
    if (!hybridSelector?.type || !hybridSelector?.value) {
      setHybridTechniques(null);
      return;
    }

    setHybridLoading(true);
    fetchTechniquesBySelector(hybridSelector.type, hybridSelector.value)
      .then(data => {
        setHybridTechniques({
          ...data,
          selectorType: hybridSelector.type,
          selectorValue: hybridSelector.value,
        });
        setHybridLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch hybrid techniques:', err);
        setHybridLoading(false);
      });
  }, [hybridSelector?.type, hybridSelector?.value]);

  const combinedTechniqueIds = useMemo(() => {
    const baseSet = new Set(baseTechniqueIds);
    if (hybridTechniques?.techniqueIds) {
      hybridTechniques.techniqueIds.forEach(id => baseSet.add(id));
    }
    return Array.from(baseSet);
  }, [baseTechniqueIds, hybridTechniques]);

  useEffect(() => {
    if (combinedTechniqueIds.length === 0) {
      setStixMapping(null);
      return;
    }

    const idsKey = combinedTechniqueIds.join(',');
    
    setStixLoading(true);
    fetch('/api/mitre-stix/techniques/mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ techniqueIds: combinedTechniqueIds }),
    })
      .then(res => res.json())
      .then(data => {
        setStixMapping(data);
        setStixLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch STIX mapping:', err);
        setStixLoading(false);
      });
  }, [combinedTechniqueIds.join(',')]);

  const enrichedMapping = useMemo((): EnrichedCommunityMapping | null => {
    if (!rawData?.mapping || rawData.status !== 'matched') {
      return null;
    }
    
    return {
      source: rawData.source || 'unknown',
      confidence: rawData.confidence || 0,
      techniqueIds: combinedTechniqueIds,
      detectionStrategies: stixMapping?.detectionStrategies || [],
      dataComponents: stixMapping?.dataComponents || [],
      communityAnalytics: rawData.mapping.analytics,
    };
  }, [rawData, combinedTechniqueIds, stixMapping]);

  return {
    data: rawData,
    enrichedMapping,
    isLoading: statusQuery.isLoading || autoRunMutation.isPending || stixLoading || hybridLoading,
    isAutoRunning: autoRunMutation.isPending,
    isStixLoading: stixLoading,
    isHybridLoading: hybridLoading,
    hybridTechniques,
    baseTechniqueIds,
    combinedTechniqueIds,
    error: statusQuery.error || autoRunMutation.error,
    shouldAutoRun,
    triggerAutoRun: () => autoRunMutation.mutate(productId),
  };
}

export const RESOURCE_LABELS: Record<string, { label: string; color: string }> = {
  ctid: { label: 'CTID Mappings', color: 'bg-blue-500' },
  sigma: { label: 'Sigma Rules', color: 'bg-purple-500' },
  elastic: { label: 'Elastic Rules', color: 'bg-orange-500' },
  splunk: { label: 'Splunk Content', color: 'bg-green-500' },
  mitre_stix: { label: 'MITRE STIX', color: 'bg-red-500' },
};
