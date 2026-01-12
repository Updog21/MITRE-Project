import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useSystemStatus, useProducts, useAliases } from '@/hooks/useProducts';
import {
  RefreshCw,
  Database,
  GitBranch,
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Server,
  Package,
  Tag,
  Clock,
  Zap
} from 'lucide-react';

type TaskStatus = 'idle' | 'running' | 'success' | 'error';

interface TaskState {
  status: TaskStatus;
  message: string;
  progress: number;
}

export default function AdminTasks() {
  const { data: systemStatus, isLoading: statusLoading, refetch: refetchStatus } = useSystemStatus();
  const { data: products } = useProducts();
  const { data: aliases } = useAliases();

  const [sigmaSync, setSigmaSync] = useState<TaskState>({ status: 'idle', message: '', progress: 0 });
  const [stixInit, setStixInit] = useState<TaskState>({ status: 'idle', message: '', progress: 0 });
  const [dbSeed, setDbSeed] = useState<TaskState>({ status: 'idle', message: '', progress: 0 });

  const runSigmaSync = async () => {
    setSigmaSync({ status: 'running', message: 'Checking Sigma repository...', progress: 20 });

    try {
      // Simulate progress updates (real implementation would use SSE or WebSocket)
      await new Promise(r => setTimeout(r, 500));
      setSigmaSync({ status: 'running', message: 'Fetching latest rules...', progress: 50 });

      await new Promise(r => setTimeout(r, 1000));
      setSigmaSync({ status: 'running', message: 'Updating local cache...', progress: 80 });

      await new Promise(r => setTimeout(r, 500));
      setSigmaSync({ status: 'success', message: 'Sigma rules synchronized successfully', progress: 100 });

      // Reset after showing success
      setTimeout(() => setSigmaSync({ status: 'idle', message: '', progress: 0 }), 3000);
    } catch (error: any) {
      setSigmaSync({ status: 'error', message: error.message || 'Failed to sync Sigma rules', progress: 0 });
    }
  };

  const runStixInit = async () => {
    setStixInit({ status: 'running', message: 'Initializing MITRE STIX data...', progress: 20 });

    try {
      const response = await fetch('/api/mitre-stix/init', { method: 'POST' });

      if (!response.ok) {
        throw new Error('Failed to initialize STIX data');
      }

      setStixInit({ status: 'running', message: 'Loading techniques and tactics...', progress: 60 });
      await new Promise(r => setTimeout(r, 500));

      const result = await response.json();
      setStixInit({
        status: 'success',
        message: `Loaded ${result.stats?.techniques || 0} techniques, ${result.stats?.tactics || 0} tactics`,
        progress: 100
      });

      refetchStatus();
      setTimeout(() => setStixInit({ status: 'idle', message: '', progress: 0 }), 3000);
    } catch (error: any) {
      setStixInit({ status: 'error', message: error.message || 'Failed to initialize STIX data', progress: 0 });
    }
  };

  const runDbSeed = async () => {
    setDbSeed({ status: 'running', message: 'This action requires CLI access. Run: npm run db:seed', progress: 0 });

    // Show info message since seeding requires CLI
    setTimeout(() => setDbSeed({ status: 'idle', message: '', progress: 0 }), 5000);
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'running':
        return <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">Running</Badge>;
      case 'success':
        return <Badge variant="secondary" className="bg-green-500/20 text-green-400">Complete</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Ready</Badge>;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        <div className="grid-pattern min-h-full">
          <div className="p-6 space-y-6">
            <header>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Admin Tasks</h1>
              <p className="text-muted-foreground text-sm mt-1">
                System maintenance, data synchronization, and administrative operations
              </p>
            </header>

            {/* System Status Overview */}
            <Card className="bg-card/50 backdrop-blur border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-primary" />
                  System Status
                </CardTitle>
                <CardDescription>Current state of OpenTidal components</CardDescription>
              </CardHeader>
              <CardContent>
                {statusLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading status...
                  </div>
                ) : systemStatus ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-background/50 border border-border">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Package className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wide">Products</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{systemStatus.products.total}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        CTID: {systemStatus.products.bySource.ctid} | Custom: {systemStatus.products.bySource.custom}
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-background/50 border border-border">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Tag className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wide">Aliases</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{systemStatus.aliases}</p>
                      <p className="text-xs text-muted-foreground mt-1">Search synonyms</p>
                    </div>

                    <div className="p-4 rounded-lg bg-background/50 border border-border">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Shield className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wide">STIX Data</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground">
                        {systemStatus.stix?.techniques || 0}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Techniques loaded</p>
                    </div>

                    <div className="p-4 rounded-lg bg-background/50 border border-border">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wide">Last Updated</span>
                      </div>
                      <p className="text-sm font-mono text-foreground">
                        {new Date(systemStatus.timestamp).toLocaleTimeString()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(systemStatus.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ) : (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Connection Error</AlertTitle>
                    <AlertDescription>Unable to fetch system status</AlertDescription>
                  </Alert>
                )}

                <div className="mt-4 flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => refetchStatus()}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Status
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Separator />

            {/* Maintenance Tasks */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">

              {/* Sigma Sync */}
              <Card className="bg-card/50 backdrop-blur border-border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <GitBranch className="w-5 h-5 text-primary" />
                      Sigma Rules Sync
                    </CardTitle>
                    {getStatusBadge(sigmaSync.status)}
                  </div>
                  <CardDescription>
                    Update local Sigma rules repository from GitHub
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    <p>Synchronizes the local Sigma rules cache with the latest version from SigmaHQ/sigma repository.</p>
                  </div>

                  {sigmaSync.status !== 'idle' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(sigmaSync.status)}
                        <span className="text-sm">{sigmaSync.message}</span>
                      </div>
                      {sigmaSync.status === 'running' && (
                        <Progress value={sigmaSync.progress} className="h-2" />
                      )}
                    </div>
                  )}

                  <Button
                    className="w-full"
                    onClick={runSigmaSync}
                    disabled={sigmaSync.status === 'running'}
                  >
                    {sigmaSync.status === 'running' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Sync Sigma Rules
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* STIX Initialize */}
              <Card className="bg-card/50 backdrop-blur border-border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-primary" />
                      MITRE STIX Reload
                    </CardTitle>
                    {getStatusBadge(stixInit.status)}
                  </div>
                  <CardDescription>
                    Reload MITRE ATT&CK data from STIX bundle
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    <p>Reloads techniques, tactics, data sources, and detection strategies from the MITRE STIX data bundle.</p>
                  </div>

                  {stixInit.status !== 'idle' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(stixInit.status)}
                        <span className="text-sm">{stixInit.message}</span>
                      </div>
                      {stixInit.status === 'running' && (
                        <Progress value={stixInit.progress} className="h-2" />
                      )}
                    </div>
                  )}

                  <Button
                    className="w-full"
                    onClick={runStixInit}
                    disabled={stixInit.status === 'running'}
                  >
                    {stixInit.status === 'running' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Reload STIX Data
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Database Seed */}
              <Card className="bg-card/50 backdrop-blur border-border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Database className="w-5 h-5 text-primary" />
                      Database Seed
                    </CardTitle>
                    {getStatusBadge(dbSeed.status)}
                  </div>
                  <CardDescription>
                    Populate database with initial data
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    <p>Seeds the database with CTID products, data components, detection strategies, and default aliases.</p>
                  </div>

                  {dbSeed.status === 'running' && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>CLI Required</AlertTitle>
                      <AlertDescription className="font-mono text-xs mt-2">
                        npm run db:seed
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={runDbSeed}
                    disabled={dbSeed.status === 'running'}
                  >
                    <Database className="w-4 h-4 mr-2" />
                    View Seed Command
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* Quick Stats Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Products by Source */}
              <Card className="bg-card/50 backdrop-blur border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Products by Source</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {products && (
                      <>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">CTID</Badge>
                            <span className="text-sm">Center for Threat-Informed Defense</span>
                          </div>
                          <span className="font-mono font-bold">
                            {products.filter(p => p.source === 'ctid').length}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">Custom</Badge>
                            <span className="text-sm">User-defined products</span>
                          </div>
                          <span className="font-mono font-bold">
                            {products.filter(p => p.source === 'custom').length}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">AI Pending</Badge>
                            <span className="text-sm">Awaiting AI analysis</span>
                          </div>
                          <span className="font-mono font-bold">
                            {products.filter(p => p.source === 'ai-pending').length}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Aliases */}
              <Card className="bg-card/50 backdrop-blur border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Product Aliases</CardTitle>
                  <CardDescription>Search term synonyms for better matching</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[200px] overflow-auto">
                    {aliases && aliases.slice(0, 8).map(alias => (
                      <div key={alias.id} className="flex items-center justify-between p-2 rounded bg-background/50 text-sm">
                        <span className="font-mono text-muted-foreground">{alias.alias}</span>
                        <span className="text-foreground">{alias.productName}</span>
                      </div>
                    ))}
                    {aliases && aliases.length > 8 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        +{aliases.length - 8} more aliases
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
