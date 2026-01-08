import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { ProductSearch } from '@/components/ProductSearch';
import { ValueChainDisplay } from '@/components/ValueChainDisplay';
import { AIMapperFlow } from '@/components/AIMapperFlow';
import { Asset, getProductMapping, ProductMapping } from '@/lib/v18Data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Database, Cpu, Target } from 'lucide-react';

type ViewState = 'search' | 'detail' | 'ai-mapper';

export default function Dashboard() {
  const [view, setView] = useState<ViewState>('search');
  const [selectedMapping, setSelectedMapping] = useState<ProductMapping | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSelectProduct = (asset: Asset) => {
    const mapping = getProductMapping(asset.id);
    if (mapping) {
      setSelectedMapping(mapping);
      setView('detail');
    }
  };

  const handleRequestAIMapping = () => {
    setView('ai-mapper');
  };

  const handleBackToSearch = () => {
    setView('search');
    setSelectedMapping(null);
  };

  const handleAIComplete = () => {
    setView('search');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <div className="grid-pattern min-h-full">
          <div className="p-6 space-y-6">
            {view === 'search' && (
              <>
                <header className="text-center max-w-3xl mx-auto">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center glow-primary">
                      <Shield className="w-7 h-7 text-primary" />
                    </div>
                  </div>
                  <h1 className="text-3xl font-bold text-foreground tracking-tight">OpenTidal</h1>
                  <p className="text-muted-foreground mt-2">
                    Threat-Informed Defense Platform — Map security products to MITRE ATT&CK v18
                  </p>
                </header>

                <div className="max-w-3xl mx-auto">
                  <ProductSearch 
                    onSelectProduct={handleSelectProduct}
                    onRequestAIMapping={handleRequestAIMapping}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto mt-8">
                  <Card className="bg-card/30 border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Database className="w-4 h-4 text-green-400" />
                        CTID Mappings
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Search verified mappings from the Center for Threat-Informed Defense Security Stack Mappings project.
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card/30 border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-primary" />
                        AI Auto-Mapping
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        For products not in CTID, AI analyzes capabilities and maps to ATT&CK techniques automatically.
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card/30 border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Target className="w-4 h-4 text-red-400" />
                        Value Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        See the full v18 logic chain: Asset → Data Components → Analytics → Techniques.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            {view === 'detail' && selectedMapping && (
              <ValueChainDisplay 
                mapping={selectedMapping}
                onBack={handleBackToSearch}
              />
            )}

            {view === 'ai-mapper' && (
              <AIMapperFlow
                initialQuery={searchQuery}
                onComplete={handleAIComplete}
                onCancel={handleBackToSearch}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
