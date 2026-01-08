import { useState } from 'react';
import { Asset, getDetectionStrategiesForProduct, getDataComponentsForProduct, DetectionStrategy, DataComponentRef, dataComponents } from '@/lib/mitreData';
import { DetectionStrategyView } from './DetectionStrategyView';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Server,
  Target,
  Database,
  ChevronRight,
  ExternalLink,
  Shield,
  Layers,
  FileText,
  Monitor,
  Terminal
} from 'lucide-react';

interface ProductViewProps {
  product: Asset;
  onBack: () => void;
}

function getPlatformIcon(platform: string) {
  switch (platform) {
    case 'Windows': return <Monitor className="w-4 h-4" />;
    case 'Linux': return <Terminal className="w-4 h-4" />;
    case 'Azure AD': return <Database className="w-4 h-4" />;
    default: return <Monitor className="w-4 h-4" />;
  }
}

function DataComponentSummaryCard({ dc }: { dc: DataComponentRef }) {
  return (
    <Card className="bg-card/30 border-border hover:border-blue-500/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-blue-400">{dc.id}</span>
            <a 
              href={`https://attack.mitre.org/datacomponents/${dc.id}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-blue-400"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <Badge variant="secondary" className="text-[10px]">{dc.dataSource}</Badge>
        </div>
        <h4 className="font-medium text-foreground text-sm">{dc.name}</h4>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{dc.description}</p>
        <div className="mt-3 pt-3 border-t border-border">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Mutable Elements</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {dc.mutableElements.slice(0, 5).map(me => (
              <code key={me.name} className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono text-muted-foreground">
                {me.name}
              </code>
            ))}
            {dc.mutableElements.length > 5 && (
              <span className="text-[10px] text-muted-foreground">+{dc.mutableElements.length - 5} more</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DetectionStrategySummaryCard({ strategy, onClick }: { strategy: DetectionStrategy; onClick: () => void }) {
  return (
    <Card 
      className="bg-card/30 border-border hover:border-primary/50 transition-colors cursor-pointer group"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-primary">{strategy.id}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <h4 className="font-medium text-foreground group-hover:text-primary transition-colors">
              {strategy.name}
            </h4>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{strategy.description}</p>
            
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1 text-xs">
                <Layers className="w-3 h-3 text-amber-400" />
                <span className="text-muted-foreground">{strategy.analytics.length} Analytics</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <Target className="w-3 h-3 text-red-400" />
                <span className="text-muted-foreground">{strategy.techniques.length} Techniques</span>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-1 mt-2">
              {strategy.techniques.slice(0, 3).map(t => (
                <Badge key={t} variant="destructive" className="text-[10px] font-mono">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProductView({ product, onBack }: ProductViewProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<DetectionStrategy | null>(null);
  const strategies = getDetectionStrategiesForProduct(product.id);
  const dcRefs = getDataComponentsForProduct(product.id);

  if (selectedStrategy) {
    return (
      <DetectionStrategyView 
        strategy={selectedStrategy}
        onBack={() => setSelectedStrategy(null)}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <button 
        onClick={onBack}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        data-testid="button-back"
      >
        ← Back to search
      </button>

      <Card className="bg-card/50 backdrop-blur border-border">
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <Server className="w-7 h-7 text-green-400" />
            </div>
            <div className="flex-1">
              <span className="text-sm text-muted-foreground">{product.vendor}</span>
              <CardTitle className="text-xl mt-1">{product.productName}</CardTitle>
              <p className="text-muted-foreground mt-2">{product.description}</p>
              <div className="flex items-center gap-3 mt-4">
                {product.deployment && (
                  <Badge variant="secondary">{product.deployment}</Badge>
                )}
                {product.platforms.map(p => (
                  <Badge key={p} variant="outline" className="flex items-center gap-1">
                    {getPlatformIcon(p)}
                    {p}
                  </Badge>
                ))}
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  CTID Verified
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card/30 border-border">
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-green-400">{strategies.length}</div>
            <div className="text-sm text-muted-foreground">Detection Strategies</div>
          </CardContent>
        </Card>
        <Card className="bg-card/30 border-border">
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-blue-400">{dcRefs.length}</div>
            <div className="text-sm text-muted-foreground">Data Components</div>
          </CardContent>
        </Card>
        <Card className="bg-card/30 border-border">
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-amber-400">
              {strategies.reduce((acc, s) => acc + s.analytics.length, 0)}
            </div>
            <div className="text-sm text-muted-foreground">Total Analytics</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="strategies" className="w-full">
        <TabsList className="w-full justify-start h-11 bg-muted/30 p-1">
          <TabsTrigger value="strategies" className="flex items-center gap-2 px-4">
            <Target className="w-4 h-4" />
            Detection Strategies
          </TabsTrigger>
          <TabsTrigger value="data-components" className="flex items-center gap-2 px-4">
            <Database className="w-4 h-4" />
            Data Components
          </TabsTrigger>
        </TabsList>

        <TabsContent value="strategies" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Click on a detection strategy to see its analytics, log sources, and mutable elements.
          </p>
          {strategies.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {strategies.map(strategy => (
                <DetectionStrategySummaryCard
                  key={strategy.id}
                  strategy={strategy}
                  onClick={() => setSelectedStrategy(strategy)}
                />
              ))}
            </div>
          ) : (
            <Card className="bg-card/30 border-border border-dashed">
              <CardContent className="py-12 text-center">
                <Target className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="text-muted-foreground">No detection strategies mapped for this product yet.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="data-components" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            The log types and events this product provides visibility into.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dcRefs.map(dc => (
              <DataComponentSummaryCard key={dc.id} dc={dc} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
