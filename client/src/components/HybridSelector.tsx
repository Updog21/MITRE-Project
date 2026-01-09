import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Check, Settings2, AlertTriangle, Monitor, Terminal, Cloud, Server, Globe, Box, Network, Shield, Database, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HybridSelectorOption {
  label: string;
  type: 'platform';
  value: string;
}

interface HybridSelectorProps {
  productId: string;
  currentType?: string | null;
  currentValues?: string[] | null;
  onRerun?: () => void;
  isLoading?: boolean;
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  'Windows': <Monitor className="w-5 h-5" />,
  'Linux': <Terminal className="w-5 h-5" />,
  'macOS': <Monitor className="w-5 h-5" />,
  'IaaS': <Cloud className="w-5 h-5" />,
  'SaaS': <Globe className="w-5 h-5" />,
  'Containers': <Box className="w-5 h-5" />,
  'Network': <Network className="w-5 h-5" />,
  'Identity Provider': <Shield className="w-5 h-5" />,
  'Office 365': <Database className="w-5 h-5" />,
  'ESXi': <Server className="w-5 h-5" />,
};

async function fetchHybridOptions(): Promise<HybridSelectorOption[]> {
  const response = await fetch('/api/hybrid-selector/options');
  if (!response.ok) {
    throw new Error('Failed to fetch hybrid selector options');
  }
  return response.json();
}

async function updateProductHybridSelector(
  productId: string,
  selectorType: string | null,
  selectorValues: string[]
): Promise<void> {
  const response = await fetch(`/api/products/${productId}/hybrid-selector`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hybridSelectorType: selectorType, hybridSelectorValues: selectorValues }),
  });
  if (!response.ok) {
    throw new Error('Failed to update product hybrid selector');
  }
}

export function useHybridSelectorOptions() {
  return useQuery({
    queryKey: ['hybrid-selector-options'],
    queryFn: fetchHybridOptions,
    staleTime: 60 * 60 * 1000,
  });
}

function setsAreEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

export function HybridSelector({
  productId,
  currentType,
  currentValues,
  onRerun,
  isLoading,
}: HybridSelectorProps) {
  const queryClient = useQueryClient();
  const { data: options, isLoading: optionsLoading } = useHybridSelectorOptions();
  
  const isLegacyAssetType = currentType === 'asset';
  
  const initialValues = useMemo(() => {
    if (isLegacyAssetType) return new Set<string>();
    return new Set(currentValues || []);
  }, [currentValues, isLegacyAssetType]);
  
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(
    new Set(currentValues || [])
  );

  const hasChanges = useMemo(() => {
    return !setsAreEqual(selectedPlatforms, initialValues);
  }, [selectedPlatforms, initialValues]);

  const updateMutation = useMutation({
    mutationFn: ({ values }: { values: string[] }) =>
      updateProductHybridSelector(productId, values.length > 0 ? 'platform' : null, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      if (onRerun) {
        onRerun();
      }
    },
  });

  useEffect(() => {
    if (currentValues && !isLegacyAssetType) {
      setSelectedPlatforms(new Set(currentValues));
    } else {
      setSelectedPlatforms(new Set());
    }
  }, [currentValues, isLegacyAssetType]);

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev => {
      const next = new Set(prev);
      if (next.has(platform)) {
        next.delete(platform);
      } else {
        next.add(platform);
      }
      return next;
    });
  };

  const handleSave = () => {
    const values = Array.from(selectedPlatforms);
    updateMutation.mutate({ values });
  };

  const handleClearAndSave = () => {
    setSelectedPlatforms(new Set());
    updateMutation.mutate({ values: [] });
  };

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
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-amber-500/20 flex items-center justify-center">
              <Settings2 className="w-4 h-4 text-amber-400" />
            </div>
            Platform Coverage Overlay
          </CardTitle>
          {selectedPlatforms.size > 0 && (
            <Badge variant="secondary" className="text-xs">
              {selectedPlatforms.size} selected
            </Badge>
          )}
        </div>
        <CardDescription>
          Select one or more platforms to add additional technique coverage from MITRE ATT&CK
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLegacyAssetType && (
          <div className="flex items-center gap-2 p-3 rounded bg-yellow-500/10 border border-yellow-500/30">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
            <p className="text-sm text-yellow-200">
              Asset-based filtering is no longer supported. Please select platforms below.
            </p>
          </div>
        )}
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {options?.map((option) => {
            const isSelected = selectedPlatforms.has(option.value);
            const icon = PLATFORM_ICONS[option.value] || <Cloud className="w-5 h-5" />;
            
            return (
              <button
                key={option.value}
                onClick={() => togglePlatform(option.value)}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all duration-200",
                  "hover:border-amber-500/50 hover:bg-amber-500/5",
                  isSelected 
                    ? "border-amber-500 bg-amber-500/10 text-amber-400" 
                    : "border-border bg-background/50 text-muted-foreground"
                )}
                data-testid={`tile-platform-${option.value.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {isSelected && (
                  <div className="absolute top-1 right-1">
                    <Check className="w-4 h-4 text-amber-400" />
                  </div>
                )}
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  isSelected ? "bg-amber-500/20" : "bg-muted/50"
                )}>
                  {icon}
                </div>
                <span className="text-xs font-medium text-center leading-tight">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>

        {selectedPlatforms.size > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground mr-1">Selected:</span>
            {Array.from(selectedPlatforms).map(platform => (
              <Badge 
                key={platform} 
                className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30"
              >
                {platform}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {initialValues.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearAndSave}
              disabled={updateMutation.isPending || isLoading}
              data-testid="button-clear-selector"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear All
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending || isLoading}
            className="flex-1"
            data-testid="button-save-selector"
          >
            {updateMutation.isPending || isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                {hasChanges ? 'Save & Re-run Mapper' : 'No Changes'}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
