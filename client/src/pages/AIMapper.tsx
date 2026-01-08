import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Cpu, Sparkles, Globe, FileText, ArrowRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AnalysisResult {
  productName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  techniques: { id: string; name: string; confidence: number }[];
  timestamp: Date;
}

export default function AIMapper() {
  const [productName, setProductName] = useState('');
  const [documentationUrl, setDocumentationUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<AnalysisResult[]>([
    {
      productName: 'Miro',
      status: 'completed',
      techniques: [
        { id: 'T1078', name: 'Valid Accounts', confidence: 92 },
        { id: 'T1110', name: 'Brute Force', confidence: 85 },
        { id: 'T1087', name: 'Account Discovery', confidence: 78 },
      ],
      timestamp: new Date(Date.now() - 3600000),
    },
  ]);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!productName || !documentationUrl) {
      toast({
        title: 'Missing fields',
        description: 'Please provide both product name and documentation URL.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    const newResult: AnalysisResult = {
      productName,
      status: 'processing',
      techniques: [],
      timestamp: new Date(),
    };
    setResults(prev => [newResult, ...prev]);

    setTimeout(() => {
      setResults(prev => prev.map((r, i) => 
        i === 0 ? {
          ...r,
          status: 'completed',
          techniques: [
            { id: 'T1059', name: 'Command and Scripting Interpreter', confidence: 88 },
            { id: 'T1071', name: 'Application Layer Protocol', confidence: 82 },
            { id: 'T1105', name: 'Ingress Tool Transfer', confidence: 75 },
            { id: 'T1566', name: 'Phishing', confidence: 71 },
          ],
        } : r
      ));
      setIsProcessing(false);
      setProductName('');
      setDocumentationUrl('');
      
      toast({
        title: 'Analysis Complete',
        description: `Successfully mapped ${productName} to MITRE ATT&CK techniques.`,
      });
    }, 3000);
  };

  const getStatusIcon = (status: AnalysisResult['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'processing': return <Clock className="w-4 h-4 text-yellow-400 animate-pulse" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-400" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 85) return 'text-green-400 bg-green-500/10 border-green-500/30';
    if (confidence >= 70) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <div className="grid-pattern min-h-full">
          <div className="p-6 space-y-6">
            <header>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center glow-primary">
                  <Cpu className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">AI Auto-Mapper</h1>
                  <p className="text-muted-foreground text-sm">
                    Automatically map security products to MITRE ATT&CK techniques using AI
                  </p>
                </div>
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-card/50 backdrop-blur border-border" data-testid="card-analysis-form">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Analyze New Product
                  </CardTitle>
                  <CardDescription>
                    Enter a product name and its documentation URL. The AI will scrape the docs and map audit log capabilities to MITRE techniques.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="productName" className="text-sm font-medium">
                        Product Name
                      </Label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="productName"
                          value={productName}
                          onChange={(e) => setProductName(e.target.value)}
                          placeholder="e.g., Miro, Notion, Slack"
                          className="pl-10 bg-background border-input"
                          data-testid="input-product-name"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="documentationUrl" className="text-sm font-medium">
                        Documentation URL
                      </Label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="documentationUrl"
                          value={documentationUrl}
                          onChange={(e) => setDocumentationUrl(e.target.value)}
                          placeholder="https://docs.example.com/audit-logs"
                          className="pl-10 bg-background border-input"
                          data-testid="input-documentation-url"
                        />
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isProcessing}
                      data-testid="button-analyze"
                    >
                      {isProcessing ? (
                        <>
                          <Clock className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Analyze with AI
                        </>
                      )}
                    </Button>
                  </form>

                  <div className="mt-6 p-4 rounded-lg bg-muted/30 border border-border">
                    <h4 className="text-sm font-medium text-foreground mb-2">How it works</h4>
                    <ol className="space-y-2 text-xs text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="bg-primary/20 text-primary rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 text-xs">1</span>
                        <span>n8n webhook receives the product details</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="bg-primary/20 text-primary rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 text-xs">2</span>
                        <span>Documentation is scraped and parsed</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="bg-primary/20 text-primary rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 text-xs">3</span>
                        <span>OpenAI maps audit logs to MITRE techniques</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="bg-primary/20 text-primary rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 text-xs">4</span>
                        <span>Results are pushed to ATT&CK Workbench</span>
                      </li>
                    </ol>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur border-border" data-testid="card-analysis-results">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Analysis History
                  </CardTitle>
                  <CardDescription>
                    Recent AI-powered technique mappings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {results.length === 0 ? (
                    <div className="text-center py-8">
                      <Cpu className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                      <p className="text-muted-foreground text-sm">No analyses yet</p>
                      <p className="text-muted-foreground text-xs mt-1">Submit a product to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {results.map((result, index) => (
                        <div 
                          key={index}
                          className="p-4 rounded-lg bg-background border border-border"
                          data-testid={`result-analysis-${index}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(result.status)}
                              <span className="font-medium text-foreground">{result.productName}</span>
                            </div>
                            <Badge 
                              variant={result.status === 'completed' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {result.status}
                            </Badge>
                          </div>
                          
                          {result.techniques.length > 0 && (
                            <div className="space-y-2">
                              {result.techniques.map((technique) => (
                                <div 
                                  key={technique.id}
                                  className="flex items-center justify-between p-2 rounded bg-muted/30"
                                >
                                  <div className="flex items-center gap-2">
                                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                    <span className="font-mono text-xs text-primary">{technique.id}</span>
                                    <span className="text-xs text-foreground">{technique.name}</span>
                                  </div>
                                  <span className={`text-xs font-mono px-2 py-0.5 rounded border ${getConfidenceColor(technique.confidence)}`}>
                                    {technique.confidence}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <div className="mt-2 text-xs text-muted-foreground">
                            {result.timestamp.toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="bg-card/50 backdrop-blur border-border">
              <CardHeader>
                <CardTitle className="text-sm font-medium">n8n Webhook Configuration</CardTitle>
                <CardDescription>
                  Configure your n8n instance to receive product analysis requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-background border border-border">
                    <h4 className="text-sm font-medium text-foreground mb-2">Webhook Endpoint</h4>
                    <code className="text-xs font-mono text-primary bg-muted/50 px-3 py-2 rounded block">
                      POST /webhook/analyze-product
                    </code>
                  </div>
                  <div className="p-4 rounded-lg bg-background border border-border">
                    <h4 className="text-sm font-medium text-foreground mb-2">Request Body</h4>
                    <pre className="text-xs font-mono text-muted-foreground bg-muted/50 px-3 py-2 rounded overflow-x-auto">
{`{
  "productName": "string",
  "documentationUrl": "string"
}`}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
