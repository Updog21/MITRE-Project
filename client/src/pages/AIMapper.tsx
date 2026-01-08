import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { AIMapperFlow } from '@/components/AIMapperFlow';
import { getCustomMappings, CustomMapping } from '@/lib/v18Data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Cpu, Plus, Database, CheckCircle2, Clock, FileText } from 'lucide-react';

export default function AIMapper() {
  const [showFlow, setShowFlow] = useState(false);
  const [customMappings, setCustomMappings] = useState<CustomMapping[]>(getCustomMappings());

  const handleComplete = () => {
    setShowFlow(false);
    setCustomMappings(getCustomMappings());
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <div className="grid-pattern min-h-full">
          <div className="p-6 space-y-6">
            <header className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center glow-primary">
                  <Cpu className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">AI Auto-Mapper</h1>
                  <p className="text-muted-foreground text-sm">
                    Create and manage AI-generated MITRE ATT&CK mappings
                  </p>
                </div>
              </div>
              {!showFlow && (
                <Button onClick={() => setShowFlow(true)} data-testid="button-new-mapping">
                  <Plus className="w-4 h-4 mr-2" />
                  New AI Mapping
                </Button>
              )}
            </header>

            {showFlow ? (
              <AIMapperFlow
                onComplete={handleComplete}
                onCancel={() => setShowFlow(false)}
              />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-card/50 backdrop-blur border-border">
                    <CardContent className="pt-6">
                      <div className="text-3xl font-bold text-primary">{customMappings.length}</div>
                      <div className="text-sm text-muted-foreground">Custom Mappings</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card/50 backdrop-blur border-border">
                    <CardContent className="pt-6">
                      <div className="text-3xl font-bold text-green-400">
                        {customMappings.filter(m => m.status === 'approved').length}
                      </div>
                      <div className="text-sm text-muted-foreground">Approved</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card/50 backdrop-blur border-border">
                    <CardContent className="pt-6">
                      <div className="text-3xl font-bold text-foreground">
                        {customMappings.reduce((acc, m) => acc + m.techniques.length, 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Techniques Mapped</div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-card/50 backdrop-blur border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="w-5 h-5 text-primary" />
                      Custom Repository
                    </CardTitle>
                    <CardDescription>
                      AI-generated mappings that have been reviewed and saved
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {customMappings.length === 0 ? (
                      <div className="text-center py-12">
                        <Cpu className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-30" />
                        <h3 className="text-lg font-semibold text-foreground mb-2">No custom mappings yet</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Create your first AI mapping for a product not in the CTID database
                        </p>
                        <Button onClick={() => setShowFlow(true)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Create First Mapping
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {customMappings.map((mapping, index) => (
                          <Card 
                            key={index}
                            className="bg-background border-border hover:border-primary/50 transition-colors cursor-pointer"
                            data-testid={`card-custom-mapping-${index}`}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm text-muted-foreground">{mapping.asset.vendor}</span>
                                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                                      Custom
                                    </Badge>
                                  </div>
                                  <h3 className="font-semibold text-foreground">{mapping.asset.productName}</h3>
                                  {mapping.asset.deployment && (
                                    <span className="text-xs text-muted-foreground">{mapping.asset.deployment}</span>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="flex items-center gap-1 text-green-400">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span className="text-sm font-medium">{mapping.techniques.length} techniques</span>
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {mapping.createdAt.toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur border-border">
                  <CardHeader>
                    <CardTitle className="text-sm">How AI Mapping Works</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="text-center p-4">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
                          <span className="text-primary font-bold">1</span>
                        </div>
                        <h4 className="text-sm font-medium text-foreground">Input Product</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Enter vendor, product name, and deployment details
                        </p>
                      </div>
                      <div className="text-center p-4">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
                          <span className="text-primary font-bold">2</span>
                        </div>
                        <h4 className="text-sm font-medium text-foreground">AI Analysis</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          AI maps logging capabilities to ATT&CK techniques
                        </p>
                      </div>
                      <div className="text-center p-4">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
                          <span className="text-primary font-bold">3</span>
                        </div>
                        <h4 className="text-sm font-medium text-foreground">Review & Iterate</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Approve/reject mappings, provide feedback, AI re-iterates
                        </p>
                      </div>
                      <div className="text-center p-4">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
                          <span className="text-primary font-bold">4</span>
                        </div>
                        <h4 className="text-sm font-medium text-foreground">Save to Repo</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Finalized mapping saved for future reference
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
