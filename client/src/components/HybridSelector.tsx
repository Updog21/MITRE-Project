import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, RefreshCw, Cloud, CheckCircle2, Settings2, AlertTriangle } from 'lucide-react';

interface HybridSelectorOption {
  label: string;
  type: 'platform';
  value: string;
}

interface HybridSelectorProps {
  productId: string;
  currentType?: string | null;
  currentValue?: string | null;
  onSelectionChange?: (type: 'platform', value: string) => void;
  onRerun?: () => void;
  isLoading?: boolean;
}

async function fetchHybridOptions(): Promise<HybridSelectorOption[]> {
  const response = await fetch('/api/hybrid-selector/options');
  if (!response.ok) {
    throw new Error('Failed to fetch hybrid selector options');
  }
  return response.json();
}

async function updateProductHybridSelector(
  productId: string,
  selectorType: string,
  selectorValue: string
): Promise<void> {
  const response = await fetch(`/api/products/${productId}/hybrid-selector`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hybridSelectorType: selectorType, hybridSelectorValue: selectorValue }),
  });
  if (!response.ok) {
    throw new Error('Failed to update product hybrid selector');
  }
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

export function useHybridSelectorOptions() {
  return useQuery({
    queryKey: ['hybrid-selector-options'],
    queryFn: fetchHybridOptions,
    staleTime: 60 * 60 * 1000,
  });
}

export function useHybridSelectorTechniques(selectorType?: 'platform', selectorValue?: string) {
  return useQuery({
    queryKey: ['hybrid-selector-techniques', selectorType, selectorValue],
    queryFn: () => fetchTechniquesBySelector(selectorType!, selectorValue!),
    enabled: !!selectorType && !!selectorValue,
    staleTime: 5 * 60 * 1000,
  });
}

export function HybridSelector({
  productId,
  currentType,
  currentValue,
  onSelectionChange,
  onRerun,
  isLoading,
}: HybridSelectorProps) {
  const queryClient = useQueryClient();
  const { data: options, isLoading: optionsLoading } = useHybridSelectorOptions();
  
  // Check if the stored type is a legacy asset type (not supported anymore)
  const isLegacyAssetType = currentType === 'asset';
  
  const [selectedKey, setSelectedKey] = useState<string | undefined>(
    currentType && currentValue && !isLegacyAssetType ? `${currentType}:${currentValue}` : undefined
  );
  // Force editing mode if legacy asset type or no selection
  const [isEditing, setIsEditing] = useState(!currentType || !currentValue || isLegacyAssetType);

  const updateMutation = useMutation({
    mutationFn: ({ type, value }: { type: string; value: string }) =>
      updateProductHybridSelector(productId, type, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsEditing(false);
      if (onRerun) {
        onRerun();
      }
    },
  });

  useEffect(() => {
    if (currentType && currentValue && currentType !== 'asset') {
      setSelectedKey(`${currentType}:${currentValue}`);
    } else if (currentType === 'asset') {
      // Legacy asset type - clear selection and force re-selection
      setSelectedKey(undefined);
      setIsEditing(true);
    }
  }, [currentType, currentValue]);

  const handleSelectionChange = (key: string) => {
    setSelectedKey(key);
    const [type, value] = key.split(':');
    if (onSelectionChange) {
      onSelectionChange(type as 'platform', value);
    }
  };

  const handleApply = () => {
    if (!selectedKey) return;
    const [type, value] = selectedKey.split(':');
    updateMutation.mutate({ type, value });
  };

  const selectedOption = options?.find(o => `${o.type}:${o.value}` === selectedKey);

  if (optionsLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border">
        <CardContent className="py-4 flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">Loading options...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur border-amber-500/30" data-testid="card-hybrid-selector">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-amber-500/20 flex items-center justify-center">
              <Settings2 className="w-4 h-4 text-amber-400" />
            </div>
            Platform Coverage Overlay
          </CardTitle>
          {currentType && currentValue && !isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              data-testid="button-edit-selector"
            >
              Change
            </Button>
          )}
        </div>
        <CardDescription>
          Select a platform to add additional technique coverage from MITRE ATT&CK platform relationships
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isEditing && currentType && currentValue && selectedOption ? (
          <div className="flex items-center justify-between p-3 rounded bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-3">
              <Cloud className="w-5 h-5 text-amber-400" />
              <div>
                <div className="font-medium text-foreground">{selectedOption.label}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
                    Platform
                  </Badge>
                  <span className="text-xs text-muted-foreground">{selectedOption.value}</span>
                </div>
              </div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          </div>
        ) : (
          <>
            {isLegacyAssetType && (
              <div className="flex items-center gap-2 p-3 rounded bg-yellow-500/10 border border-yellow-500/30 mb-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                <p className="text-sm text-yellow-200">
                  Asset-based filtering is no longer supported. Please select a platform type below.
                </p>
              </div>
            )}
            <Select value={selectedKey} onValueChange={handleSelectionChange}>
              <SelectTrigger className="bg-background" data-testid="select-hybrid-type">
                <SelectValue placeholder="Select platform type..." />
              </SelectTrigger>
              <SelectContent>
                {options?.map((option) => (
                  <SelectItem key={`${option.type}:${option.value}`} value={`${option.type}:${option.value}`}>
                    <div className="flex items-center gap-2">
                      <Cloud className="w-4 h-4 text-blue-400" />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              {currentType && currentValue && !isLegacyAssetType && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setSelectedKey(`${currentType}:${currentValue}`);
                  }}
                  data-testid="button-cancel-selector"
                >
                  Cancel
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleApply}
                disabled={!selectedKey || updateMutation.isPending || isLoading}
                data-testid="button-apply-selector"
              >
                {updateMutation.isPending || isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Apply & Re-run Mapper
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
