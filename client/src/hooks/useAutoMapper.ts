import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { 
  getDetectionStrategiesByTechniques, 
  getDataComponentsFromStrategies,
  DetectionStrategy,
  DataComponentRef 
} from "@/lib/mitreData";

export interface EnrichedCommunityMapping {
  source: string;
  confidence: number;
  techniqueIds: string[];
  detectionStrategies: DetectionStrategy[];
  dataComponents: DataComponentRef[];
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

export function useAutoMappingWithAutoRun(productId: string, platform?: string) {
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
                        statusQuery.data === null && 
                        !autoRunMutation.isPending && 
                        !autoRunMutation.isSuccess &&
                        !autoRunMutation.isError;

  const rawData = autoRunMutation.data || statusQuery.data;

  const enrichedMapping = useMemo((): EnrichedCommunityMapping | null => {
    if (!rawData?.mapping || rawData.status !== 'matched') {
      return null;
    }
    
    const techniqueIds = rawData.mapping.detectionStrategies;
    const detectionStrategies = getDetectionStrategiesByTechniques(techniqueIds, platform);
    const dataComponents = getDataComponentsFromStrategies(detectionStrategies);
    
    return {
      source: rawData.source || 'unknown',
      confidence: rawData.confidence || 0,
      techniqueIds,
      detectionStrategies,
      dataComponents,
      communityAnalytics: rawData.mapping.analytics,
    };
  }, [rawData, platform]);

  return {
    data: rawData,
    enrichedMapping,
    isLoading: statusQuery.isLoading || autoRunMutation.isPending,
    isAutoRunning: autoRunMutation.isPending,
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
