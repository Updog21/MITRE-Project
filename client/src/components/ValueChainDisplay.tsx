import { ProductMapping, DataComponent, Analytic, Technique } from '@/lib/v18Data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Server, 
  FileText, 
  Search, 
  Target, 
  ArrowRight, 
  CheckCircle2, 
  Shield,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ValueChainDisplayProps {
  mapping: ProductMapping;
  onBack: () => void;
}

export function ValueChainDisplay({ mapping, onBack }: ValueChainDisplayProps) {
  const { asset, dataComponents, analytics, techniques, valueScore } = mapping;

  const getValueLabel = (score: number) => {
    if (score >= 80) return { label: 'Critical Value', color: 'text-green-400', bg: 'bg-green-500/20' };
    if (score >= 60) return { label: 'High Value', color: 'text-blue-400', bg: 'bg-blue-500/20' };
    if (score >= 40) return { label: 'Medium Value', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    return { label: 'Low Value', color: 'text-orange-400', bg: 'bg-orange-500/20' };
  };

  const valueInfo = getValueLabel(valueScore);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          data-testid="button-back"
        >
          ← Back to search
        </button>
        <Badge className={cn(valueInfo.bg, valueInfo.color, "text-sm px-3 py-1")}>
          <Zap className="w-3 h-3 mr-1" />
          {valueInfo.label} ({valueScore}%)
        </Badge>
      </div>

      <Card className="bg-card/50 backdrop-blur border-border">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-sm text-muted-foreground">{asset.vendor}</span>
              <CardTitle className="text-2xl mt-1">{asset.productName}</CardTitle>
              {asset.deployment && (
                <Badge variant="secondary" className="mt-2">{asset.deployment}</Badge>
              )}
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary">{analytics.length}</div>
              <div className="text-xs text-muted-foreground">Analytics Unlocked</div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-3">{asset.description}</p>
        </CardHeader>
      </Card>

      <div className="text-center py-4">
        <h3 className="text-lg font-semibold text-foreground mb-2">MITRE v18 Value Chain</h3>
        <p className="text-sm text-muted-foreground">
          How this product provides detection value through the ATT&CK framework
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur border-primary/30" data-testid="card-asset">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center">
                <Server className="w-4 h-4 text-primary" />
              </div>
              Step 1: Asset
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-3 rounded bg-primary/10 border border-primary/20">
              <div className="font-semibold text-foreground">{asset.productName}</div>
              <div className="text-xs text-muted-foreground mt-1">The security tool that produces data</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-blue-500/30" data-testid="card-data-components">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center">
                <FileText className="w-4 h-4 text-blue-400" />
              </div>
              Step 2: Data Components
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {dataComponents.map((dc) => (
                <div 
                  key={dc.id}
                  className="p-2 rounded bg-blue-500/10 border border-blue-500/20"
                >
                  <div className="text-sm font-medium text-foreground">{dc.name}</div>
                  <div className="text-xs text-muted-foreground">{dc.dataSource}</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground mt-2 text-center">
              {dataComponents.length} log types generated
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-yellow-500/30" data-testid="card-analytics">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-yellow-500/20 flex items-center justify-center">
                <Search className="w-4 h-4 text-yellow-400" />
              </div>
              Step 3: Analytics Unlocked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {analytics.map((a) => (
                <div 
                  key={a.id}
                  className="p-2 rounded bg-yellow-500/10 border border-yellow-500/20"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                    <span className="font-mono text-xs text-yellow-400">{a.id}</span>
                  </div>
                  <div className="text-sm font-medium text-foreground mt-1">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{a.source}</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground mt-2 text-center">
              {analytics.length} detection rules enabled
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-red-500/30" data-testid="card-techniques">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-red-500/20 flex items-center justify-center">
                <Target className="w-4 h-4 text-red-400" />
              </div>
              Step 4: Techniques Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {techniques.map((t) => (
                <div 
                  key={t.id}
                  className="p-2 rounded bg-red-500/10 border border-red-500/20"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-3 h-3 text-green-400 flex-shrink-0" />
                    <span className="font-mono text-xs text-red-400">{t.id}</span>
                  </div>
                  <div className="text-sm font-medium text-foreground mt-1">{t.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{t.tactic}</div>
                  {t.usedByGroups.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {t.usedByGroups.slice(0, 2).map(g => (
                        <Badge key={g} variant="destructive" className="text-[10px] px-1">
                          {g}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground mt-2 text-center">
              Protection against {techniques.length} techniques
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-r from-green-500/10 to-primary/10 border-green-500/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <Zap className="w-6 h-6 text-green-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-foreground">Security Value Summary</h4>
              <p className="text-sm text-muted-foreground mt-1">
                By deploying <strong className="text-primary">{asset.productName}</strong>, you gain visibility into{' '}
                <strong className="text-blue-400">{dataComponents.length} data components</strong>, which enables{' '}
                <strong className="text-yellow-400">{analytics.length} detection analytics</strong> that protect against{' '}
                <strong className="text-red-400">{techniques.length} ATT&CK techniques</strong> used by threat groups like{' '}
                {techniques.flatMap(t => t.usedByGroups).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).join(', ')}.
              </p>
              <div className="mt-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Overall Detection Value</span>
                  <span className={cn("font-bold", valueInfo.color)}>{valueScore}%</span>
                </div>
                <Progress value={valueScore} className="h-2" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
