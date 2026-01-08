import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TechniqueMatrix } from '@/components/TechniqueMatrix';
import { threatGroups, securityProducts, getCoverageStats } from '@/lib/mockData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Shield, Target, AlertTriangle, CheckCircle2, Layers } from 'lucide-react';

export default function Dashboard() {
  const [selectedThreatGroup, setSelectedThreatGroup] = useState<string | null>('G0016');
  const [selectedProducts, setSelectedProducts] = useState<string[]>(['P001', 'P002']);

  const stats = getCoverageStats(selectedProducts, selectedThreatGroup);
  const selectedGroup = threatGroups.find(g => g.id === selectedThreatGroup);

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <div className="grid-pattern min-h-full">
          <div className="p-6 space-y-6">
            <header className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">Coverage Map</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  MITRE ATT&CK v18 Technique Coverage Analysis
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-red-500/50 border border-red-500"></div>
                  <span className="text-xs text-muted-foreground">Gap</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-green-500/50 border border-green-500"></div>
                  <span className="text-xs text-muted-foreground">Covered</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-card border border-border"></div>
                  <span className="text-xs text-muted-foreground">Not Targeted</span>
                </div>
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <Card className="bg-card/50 backdrop-blur border-border" data-testid="card-threat-selector">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Target className="w-4 h-4 text-red-400" />
                    Adversary Profile
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedThreatGroup || ''} onValueChange={setSelectedThreatGroup}>
                    <SelectTrigger className="bg-background border-input" data-testid="select-threat-group">
                      <SelectValue placeholder="Select threat group" />
                    </SelectTrigger>
                    <SelectContent>
                      {threatGroups.map(group => (
                        <SelectItem key={group.id} value={group.id} data-testid={`option-threat-${group.id}`}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">{group.id}</span>
                            <span>{group.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedGroup && (
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {selectedGroup.aliases.slice(0, 2).map(alias => (
                          <Badge key={alias} variant="secondary" className="text-xs">
                            {alias}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {selectedGroup.description}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur border-border" data-testid="card-product-selector">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    Defensive Stack
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {securityProducts.map(product => (
                    <label 
                      key={product.id} 
                      className="flex items-center gap-2 cursor-pointer group"
                      data-testid={`checkbox-product-${product.id}`}
                    >
                      <Checkbox 
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={() => toggleProduct(product.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-foreground group-hover:text-primary transition-colors truncate block">
                          {product.name}
                        </span>
                        <span className="text-xs text-muted-foreground">{product.category}</span>
                      </div>
                    </label>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur border-border" data-testid="card-coverage-stats">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    Coverage Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Threat Coverage</span>
                      <span className="text-sm font-bold text-primary">{stats.coveragePercent}%</span>
                    </div>
                    <Progress value={stats.coveragePercent} className="h-2" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-green-500/10 rounded-lg p-2 border border-green-500/20">
                      <CheckCircle2 className="w-4 h-4 text-green-400 mb-1" />
                      <div className="text-lg font-bold text-green-400">{stats.coveredThreatCount}</div>
                      <div className="text-xs text-muted-foreground">Protected</div>
                    </div>
                    <div className="bg-red-500/10 rounded-lg p-2 border border-red-500/20">
                      <AlertTriangle className="w-4 h-4 text-red-400 mb-1" />
                      <div className="text-lg font-bold text-red-400">{stats.gapCount}</div>
                      <div className="text-xs text-muted-foreground">Gaps</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur border-border" data-testid="card-summary">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Total Techniques</span>
                    <span className="font-mono text-sm text-foreground">{stats.totalTechniques}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Covered by Stack</span>
                    <span className="font-mono text-sm text-primary">{stats.coveredCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Threat Techniques</span>
                    <span className="font-mono text-sm text-red-400">{stats.threatCount}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground">Products Active</span>
                    <span className="font-mono text-sm text-foreground">{selectedProducts.length}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-card/50 backdrop-blur border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">ATT&CK Matrix</CardTitle>
              </CardHeader>
              <CardContent>
                <TechniqueMatrix 
                  selectedThreatGroup={selectedThreatGroup}
                  selectedProducts={selectedProducts}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
