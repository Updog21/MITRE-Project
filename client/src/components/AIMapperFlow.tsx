import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { WIZARD_QUESTION_SETS, WIZARD_CONTEXT_ALIASES } from '@/lib/wizard-questions';
import { AnalyticRequirementsPanel, InlineRequirementHint } from '@/components/AnalyticRequirementsPanel';
import { DC_ANALYTIC_REQUIREMENTS } from '@/lib/dc-analytic-requirements';

interface AIMapperFlowProps {
  initialQuery?: string;
  existingProductId?: string;
  mode?: 'create' | 'evidence';
  onComplete: (productId: string) => void;
  onCancel: () => void;
}

type Step = 'details' | 'platforms' | 'streams' | 'review' | 'analyzing' | 'evidence' | 'guided-results' | 'complete';

interface MitrePlatformsResponse {
  platforms: string[];
}

interface MitreDataComponent {
  id: string;
  name: string;
  description?: string;
  dataSourceName?: string;
  platforms?: string[];
  relevanceScore?: number;
}

interface MitreDataComponentsResponse {
  dataComponents: MitreDataComponent[];
}

interface CreatedProduct {
  id: number;
  productId: string;
}

interface StreamDraft {
  name: string;
  streamType: 'log' | 'alert' | 'finding' | 'inventory';
  mappedDataComponents: string[];
  questionAnswers?: Record<string, boolean>;
  metadata?: Record<string, unknown>;
}

interface GuidedSummary {
  techniques: number;
  dataComponents: number;
  sources: string[];
  platforms: string[];
  streams: number;
  mappingsCreated: number;
  missingDataComponents?: string[];
}

const baseSteps: { id: Step; label: string }[] = [
  { id: 'details', label: 'Details' },
  { id: 'platforms', label: 'Platforms' },
  { id: 'review', label: 'Review' },
  { id: 'streams', label: 'Telemetry' },
  { id: 'guided-results', label: 'Results' },
  { id: 'complete', label: 'Complete' },
];

const evidenceSteps: { id: Step; label: string }[] = [
  { id: 'evidence', label: 'Evidence Review' },
  { id: 'complete', label: 'Complete' },
];

const STEP_DESCRIPTIONS: Record<Step, string> = {
  details: 'Define the vendor, product name, aliases, and a short description.',
  platforms: 'Pick the MITRE platforms that apply to this product.',
  streams: 'Answer guided questions to map telemetry to MITRE data components.',
  review: 'Confirm inputs and launch the auto mapping process.',
  evidence: 'Review evidence details when needed.',
  'guided-results': 'Review the telemetry coverage inferred from your guided answers.',
  complete: 'Mapping is saved and ready to review on the product page.',
  analyzing: 'Auto mapping runs in the background and prepares evidence prompts.',
};

interface SsmMapping {
  id?: number;
  techniqueId: string;
  techniqueName: string;
  metadata?: Record<string, unknown> | null;
}

interface SsmCapability {
  id?: number;
  capabilityGroupId: string;
  name: string;
  description?: string | null;
  platform: string;
  source?: string;
  mappings: SsmMapping[];
}

interface TechniqueRequirement {
  strategyId: string;
  strategyName: string;
  analyticId: string;
  analyticName: string;
  dataComponentId: string;
  dataComponentName: string;
  dataSourceName: string;
}

interface TechniqueEvidenceEntry {
  name: string;
  channel: string;
  eventId: string;
  dataComponent: string;
}

const PLATFORM_DESCRIPTIONS: Record<string, string> = {
  'Windows': 'Windows desktops, servers, and endpoints.',
  'Linux': 'Linux servers and workloads.',
  'macOS': 'Apple macOS endpoints and laptops.',
  'Identity Provider': 'Identity and access platforms (IdP).',
  'Azure AD': 'Microsoft identity and directory services.',
  'IaaS': 'Cloud infrastructure workloads (AWS/Azure/GCP).',
  'SaaS': 'Cloud-hosted SaaS applications.',
  'Office 365': 'Microsoft 365 productivity suite.',
  'Network': 'Network appliances, firewalls, and routers.',
  'Network Devices': 'Routers, switches, and network sensors.',
  'Containers': 'Container runtime or Kubernetes.',
  'ESXi': 'VMware ESXi / vSphere environments.',
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function buildProductId(vendor: string, product: string) {
  const base = `${slugify(vendor)}-${slugify(product)}` || 'custom-product';
  return `custom-${base}-${Date.now().toString(36)}`;
}

async function fetchPlatforms(): Promise<MitrePlatformsResponse> {
  const response = await fetch('/api/mitre-stix/platforms');
  if (!response.ok) {
    throw new Error('Failed to fetch MITRE platforms');
  }
  return response.json();
}

async function fetchProduct(productId: string) {
  const response = await fetch(`/api/products/${encodeURIComponent(productId)}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch product');
  }
  return response.json();
}

async function fetchDataComponents(platform?: string): Promise<MitreDataComponentsResponse> {
  const params = new URLSearchParams();
  if (platform) {
    params.set('platform', platform);
  }
  const response = await fetch(`/api/mitre/data-components${params.toString() ? `?${params.toString()}` : ''}`);
  if (!response.ok) {
    throw new Error('Failed to fetch MITRE data components');
  }
  return response.json();
}

async function createProduct(payload: {
  productId: string;
  vendor: string;
  productName: string;
  description: string;
  platforms: string[];
  dataComponentIds: string[];
  source: 'custom';
}) {
  const response = await fetch('/api/admin/products?autoMap=false', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create product');
  }
  return response.json() as Promise<CreatedProduct>;
}

async function deleteProduct(productId: string) {
  const response = await fetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as { error?: string }).error || 'Failed to delete product');
  }
}

async function addAlias(productDbId: number, alias: string) {
  const response = await fetch('/api/admin/aliases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: productDbId, alias, confidence: 100 }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add alias');
  }
  return response.json();
}

async function saveProductStreams(productId: string, streams: StreamDraft[]) {
  const response = await fetch(`/api/products/${encodeURIComponent(productId)}/streams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ streams }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save evidence sources');
  }
  return response.json();
}

async function saveWizardCoverage(
  productId: string,
  platforms: string[],
  streams: StreamDraft[]
): Promise<GuidedSummary> {
  const response = await fetch('/api/wizard/coverage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId,
      platforms,
      streams: streams.map(stream => ({
        name: stream.name,
        mappedDataComponents: stream.mappedDataComponents,
        metadata: stream.metadata,
      })),
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save guided coverage');
  }
  return response.json();
}

async function runAutoMapper(productId: string) {
  const response = await fetch(`/api/auto-mapper/run/${encodeURIComponent(productId)}`, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to run auto-mapper');
  }
  return response.json();
}

async function fetchProductSsm(productId: string): Promise<SsmCapability[]> {
  const response = await fetch(`/api/products/${productId}/ssm`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch SSM data');
  }
  return response.json();
}

async function fetchMappingStatus(productId: string) {
  const response = await fetch(`/api/auto-mapper/mappings/${encodeURIComponent(productId)}`);
  if (!response.ok) {
    return null;
  }
  return response.json();
}

async function fetchTechniqueRequirements(techniqueId: string): Promise<TechniqueRequirement[]> {
  const response = await fetch(`/api/mitre-stix/technique/${encodeURIComponent(techniqueId)}/requirements`);
  if (!response.ok) {
    return [];
  }
  const data = await response.json();
  return Array.isArray(data.requirements) ? data.requirements : [];
}

async function updateMappingMetadata(mappingId: number, metadata: Record<string, unknown>) {
  const response = await fetch(`/api/ssm/mappings/${mappingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metadata }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update mapping metadata');
  }
  return response.json();
}

async function waitForMapping(productId: string, maxAttempts = 30, delayMs = 2000) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch(`/api/auto-mapper/mappings/${encodeURIComponent(productId)}`);
    if (response.status === 404) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      continue;
    }
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch mapping status');
    }
    return response.json();
  }
  throw new Error('Auto mapping is still running. Try again in a moment.');
}

function getSuggestedPlatforms(
  platforms: string[],
  input: string
): string[] {
  if (!platforms.length || !input.trim()) return [];
  const normalizedInput = input.toLowerCase();
  const platformMap = new Map(platforms.map(platform => [platform.toLowerCase(), platform]));
  const suggestions = new Set<string>();

  platforms.forEach(platform => {
    const normalizedPlatform = platform.toLowerCase();
    if (normalizedInput.includes(normalizedPlatform)) {
      suggestions.add(platform);
    }
  });

  const keywordMap: Record<string, string[]> = {
    'windows': ['Windows'],
    'linux': ['Linux'],
    'mac': ['macOS'],
    'macos': ['macOS'],
    'osx': ['macOS'],
    'azure ad': ['Azure AD', 'Identity Provider'],
    'entra': ['Azure AD', 'Identity Provider'],
    'okta': ['Identity Provider'],
    'aws': ['AWS', 'Amazon Web Services', 'IaaS'],
    'azure': ['Azure', 'IaaS'],
    'gcp': ['GCP', 'Google Cloud', 'IaaS'],
    'office 365': ['Office 365'],
    'm365': ['Office 365'],
    'google workspace': ['Google Workspace', 'SaaS'],
    'saas': ['SaaS'],
    'cloud': ['IaaS'],
    'container': ['Containers', 'Kubernetes'],
    'kubernetes': ['Containers', 'Kubernetes'],
    'network': ['Network'],
    'firewall': ['Network'],
    'proxy': ['Network'],
    'vmware': ['ESXi'],
    'esxi': ['ESXi'],
    'edr': ['Windows', 'Linux', 'macOS'],
    'endpoint': ['Windows', 'Linux', 'macOS'],
    'identity': ['Identity Provider'],
  };

  Object.entries(keywordMap).forEach(([keyword, candidates]) => {
    if (!normalizedInput.includes(keyword)) return;
    candidates.forEach(candidate => {
      const match = platformMap.get(candidate.toLowerCase());
      if (match) suggestions.add(match);
    });
  });

  return Array.from(suggestions);
}

export function AIMapperFlow({ initialQuery, existingProductId, mode = 'create', onComplete, onCancel }: AIMapperFlowProps) {
  const { toast } = useToast();
  const isEvidenceOnly = mode === 'evidence' && Boolean(existingProductId);
  const [step, setStep] = useState<Step>(isEvidenceOnly ? 'evidence' : 'details');
  const [vendor, setVendor] = useState('');
  const [product, setProduct] = useState(initialQuery || '');
  const [description, setDescription] = useState('');
  const [aliasInput, setAliasInput] = useState('');
  const [aliases, setAliases] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set());
  const [streams, setStreams] = useState<StreamDraft[]>([
    {
      name: '',
      streamType: 'log',
      mappedDataComponents: [],
      questionAnswers: {},
      metadata: {},
    }
  ]);
  const [wantsEvidence, setWantsEvidence] = useState(false);
  const [includeEnrichment, setIncludeEnrichment] = useState(true);
  const [includeDatabaseQuestions, setIncludeDatabaseQuestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState('Preparing mapping...');
  const [suggestionsApplied, setSuggestionsApplied] = useState(false);
  const [ssmCapabilities, setSsmCapabilities] = useState<SsmCapability[]>([]);
  const [techniqueRequirements, setTechniqueRequirements] = useState<Record<string, TechniqueRequirement[]>>({});
  const [evidenceEntries, setEvidenceEntries] = useState<Record<string, TechniqueEvidenceEntry[]>>({});
  const [evidenceFormExpanded, setEvidenceFormExpanded] = useState(true);
  const [evidenceFormInitialized, setEvidenceFormInitialized] = useState(false);
  const [mappingSummary, setMappingSummary] = useState<{
    techniques: number;
    analytics: number;
    dataComponents: number;
    sources: string[];
  } | null>(null);
  const [guidedSummary, setGuidedSummary] = useState<GuidedSummary | null>(null);

  const { data: platformData, isLoading: platformsLoading } = useQuery({
    queryKey: ['mitre-platforms'],
    queryFn: fetchPlatforms,
    staleTime: 10 * 60 * 1000,
  });

  const platforms = (platformData?.platforms || []).filter(platform => platform !== 'PRE');
  const selectedPlatformsList = useMemo(() => Array.from(selectedPlatforms), [selectedPlatforms]);
  const dataComponentPlatform = selectedPlatformsList[0] || '';

  const { data: dataComponentsData } = useQuery({
    queryKey: ['mitre-data-components', dataComponentPlatform],
    queryFn: () => fetchDataComponents(dataComponentPlatform),
    enabled: selectedPlatformsList.length > 0,
    staleTime: 10 * 60 * 1000,
  });

  const suggestionInput = useMemo(
    () => [vendor, product, description, ...aliases].join(' ').trim(),
    [vendor, product, description, aliases]
  );
  const suggestedPlatforms = useMemo(
    () => getSuggestedPlatforms(platforms, suggestionInput),
    [platforms, suggestionInput]
  );

  const defaultEvidenceSourceName = useMemo(() => {
    const trimmedVendor = vendor.trim();
    const trimmedProduct = product.trim();
    return [trimmedVendor, trimmedProduct].filter(Boolean).join(' ').trim();
  }, [vendor, product]);

  const dataComponents = dataComponentsData?.dataComponents || [];
  const dataComponentByName = useMemo(() => {
    return new Map(dataComponents.map(component => [component.name.toLowerCase(), component]));
  }, [dataComponents]);
  const wizardContextOptions = useMemo(() => {
    const contexts = new Set<string>();
    selectedPlatformsList.forEach(platform => {
      const alias = WIZARD_CONTEXT_ALIASES[platform] || platform;
      if (WIZARD_QUESTION_SETS[alias]) {
        contexts.add(alias);
      }
    });
    if (includeDatabaseQuestions && WIZARD_QUESTION_SETS['Database Platform']) {
      contexts.add('Database Platform');
    }
    if (includeEnrichment && WIZARD_QUESTION_SETS['Enrichment']) {
      contexts.add('Enrichment');
    }
    return Array.from(contexts);
  }, [selectedPlatformsList, includeEnrichment, includeDatabaseQuestions]);

  const resolveComponentNames = (dcNames: string[]) => {
    const resolved = new Set<string>();
    const missing = new Set<string>();
    dcNames.forEach((name) => {
      const component = dataComponentByName.get(name.toLowerCase());
      if (component) {
        resolved.add(component.name);
      } else {
        missing.add(name);
      }
    });
    return { resolved: Array.from(resolved), missing: Array.from(missing) };
  };

  const evidenceTechniqueCount = useMemo(() => {
    const set = new Set<string>();
    ssmCapabilities.forEach(cap => {
      cap.mappings.forEach(mapping => set.add(mapping.techniqueId));
    });
    return set.size;
  }, [ssmCapabilities]);

  const EVIDENCE_AUTO_THRESHOLD = 5;

  const shouldRecommendEvidence = useMemo(() => {
    return Boolean(mappingSummary) && evidenceTechniqueCount < EVIDENCE_AUTO_THRESHOLD;
  }, [mappingSummary, evidenceTechniqueCount, EVIDENCE_AUTO_THRESHOLD]);

  const stepItems = isEvidenceOnly ? evidenceSteps : baseSteps;

  useEffect(() => {
    if (!isEvidenceOnly || !existingProductId) return;
    let isMounted = true;

    const loadEvidence = async () => {
      try {
        setProgressMessage('Loading product details...');
        const productData = await fetchProduct(existingProductId);
        if (!isMounted) return;
        setVendor(productData.vendor || '');
        setProduct(productData.productName || '');
        setDescription(productData.description || '');
        if (Array.isArray(productData.platforms)) {
          setSelectedPlatforms(new Set(productData.platforms));
        }
        setCreatedProductId(existingProductId);
        setStep('evidence');
        setProgressMessage('Preparing evidence prompts...');
        const ssm = await fetchProductSsm(existingProductId);
        if (!isMounted) return;
        setSsmCapabilities(ssm);

        const techniqueIds = Array.from(
          new Set(ssm.flatMap(cap => cap.mappings.map(mapping => mapping.techniqueId)))
        );
        const requirementsEntries = await Promise.all(
          techniqueIds.map(async (techId) => ({
            techId,
            requirements: await fetchTechniqueRequirements(techId),
          }))
        );
        const requirementsMap: Record<string, TechniqueRequirement[]> = {};
        requirementsEntries.forEach(entry => {
          requirementsMap[entry.techId] = entry.requirements;
        });
        setTechniqueRequirements(requirementsMap);

        const defaultEvidence: Record<string, TechniqueEvidenceEntry[]> = {};
        techniqueIds.forEach((techId) => {
          const firstRequirement = requirementsMap[techId]?.[0];
          defaultEvidence[techId] = [{
            name: '',
            channel: '',
            eventId: '',
            dataComponent: firstRequirement?.dataComponentName || '',
          }];
        });
        setEvidenceEntries(defaultEvidence);
        setEvidenceFormExpanded(techniqueIds.length < EVIDENCE_AUTO_THRESHOLD);
        setEvidenceFormInitialized(true);

        const mappingResult = await fetchMappingStatus(existingProductId);
        setMappingSummary({
          techniques: techniqueIds.length,
          analytics: mappingResult?.mapping?.analytics?.length || 0,
          dataComponents: mappingResult?.mapping?.dataComponents?.length || 0,
          sources: mappingResult?.sources || (mappingResult?.source ? [mappingResult.source] : []),
        });
      } catch (error) {
        console.error(error);
        toast({
          title: 'Failed to load evidence wizard',
          description: error instanceof Error ? error.message : 'Unexpected error',
          variant: 'destructive',
        });
        onCancel();
      }
    };

    loadEvidence();

    return () => {
      isMounted = false;
    };
  }, [existingProductId, isEvidenceOnly, onCancel, toast]);

  useEffect(() => {
    if (step !== 'platforms') return;
    if (suggestionsApplied) return;
    if (selectedPlatforms.size > 0) return;
    if (suggestedPlatforms.length === 0) return;
    setSelectedPlatforms(new Set(suggestedPlatforms));
    setSuggestionsApplied(true);
  }, [step, suggestedPlatforms, selectedPlatforms.size, suggestionsApplied]);

  useEffect(() => {
    if (selectedPlatforms.size === 0) {
      setSuggestionsApplied(false);
    }
  }, [suggestionInput, selectedPlatforms.size]);

  useEffect(() => {
    if (step !== 'evidence') return;
    if (evidenceFormInitialized) return;
    setEvidenceFormExpanded(evidenceTechniqueCount < EVIDENCE_AUTO_THRESHOLD);
    setEvidenceFormInitialized(true);
  }, [step, evidenceTechniqueCount, evidenceFormInitialized, EVIDENCE_AUTO_THRESHOLD]);

  const canNavigateTo = (target: Step) => {
    if (target === step) return true;
    if (step === 'analyzing') return false;
    if (step === 'complete') return target === 'complete';
    if (target === 'platforms') return (vendor || product) && description;
    if (target === 'review') return selectedPlatforms.size > 0;
    if (target === 'streams') return createdProductId !== null;
    if (target === 'guided-results') return guidedSummary !== null;
    if (target === 'evidence') return createdProductId !== null;
    return true;
  };

  const renderStepper = () => (
    <div className="max-w-4xl mx-auto mb-8">
      <div className="flex items-center gap-8">
        {stepItems.map((item, index) => {
          const isActive = item.id === step;
          const stepIndex = stepItems.findIndex(s => s.id === step);
          const isComplete = stepIndex > index;
          return (
            <div key={item.id} className="flex items-center gap-3">
              <div className="relative group">
                <Button
                  variant="ghost"
                  size="lg"
                  className={cn(
                    'flex items-center gap-4 px-4 py-3 text-lg',
                    isActive && 'text-primary',
                    !canNavigateTo(item.id) && 'opacity-50 cursor-not-allowed'
                  )}
                  onClick={() => {
                    if (!canNavigateTo(item.id)) return;
                    setStep(item.id);
                  }}
                >
                  <span
                    className={cn(
                      'w-12 h-12 rounded-full border text-lg flex items-center justify-center',
                      isActive && 'border-primary text-primary',
                      isComplete && 'bg-primary text-primary-foreground border-primary',
                      !isActive && !isComplete && 'border-border text-muted-foreground'
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="text-lg font-semibold">{item.label}</span>
                </Button>
                <div className="pointer-events-none absolute left-1/2 top-full z-10 w-60 -translate-x-1/2 translate-y-2 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground opacity-0 shadow-sm transition group-hover:opacity-100">
                  {STEP_DESCRIPTIONS[item.id]}
                </div>
              </div>
              {index < stepItems.length - 1 && (
                <div className={cn('h-px w-12', isComplete ? 'bg-primary' : 'bg-border')} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const handleAddAlias = () => {
    const nextAlias = aliasInput.trim();
    if (!nextAlias) return;
    if (aliases.some(alias => alias.toLowerCase() === nextAlias.toLowerCase())) {
      toast({
        title: 'Alias already added',
        description: 'That alias is already in the list.',
        variant: 'destructive',
      });
      return;
    }
    setAliases(prev => [...prev, nextAlias]);
    setAliasInput('');
  };

  const handleRemoveAlias = (alias: string) => {
    setAliases(prev => prev.filter(item => item !== alias));
  };

  const updateStreamGuided = (index: number, updates: Partial<StreamDraft>) => {
    setStreams(prev => {
      const next = [...prev];
      const target = { ...next[index], ...updates };
      next[index] = target;
      return next;
    });
  };

  const resetStreamGuided = () => {
    setStreams(prev => prev.map((stream, idx) => {
      if (idx === 0) {
        return {
          ...stream,
          mappedDataComponents: [],
          questionAnswers: {},
          metadata: {
            ...(stream.metadata || {}),
            guided_mode: true,
            question_ids: [],
            missing_dc_names: [],
            resolved_dc_names: [],
          },
        };
      }
      return stream;
    }));
  };

  const applyGuidedMapping = (index: number, answers: Record<string, boolean>) => {
    const selectedNames = wizardContextOptions
      .flatMap(context => WIZARD_QUESTION_SETS[context]?.categories || [])
      .flatMap(category => category.questions)
      .filter(question => answers[question.id])
      .flatMap(question => question.dcNames);
    const { resolved, missing } = resolveComponentNames(selectedNames);
    const nextName = streams[index]?.name?.trim() || defaultEvidenceSourceName;
    const nextType = streams[index]?.streamType || 'log';
    updateStreamGuided(index, {
      mappedDataComponents: resolved,
      questionAnswers: answers,
      name: nextName,
      streamType: nextType,
      metadata: {
        ...(streams[index]?.metadata || {}),
        guided_mode: true,
        question_ids: Object.keys(answers).filter(key => answers[key]),
        missing_dc_names: missing,
        resolved_dc_names: resolved,
      },
    });
  };


  const hasConfiguredStreams = useMemo(() => {
    return streams.some(stream => stream.mappedDataComponents.length > 0);
  }, [streams]);

  const handleTogglePlatform = (platform: string) => {
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

  const handleNextDetails = () => {
    const vendorTrimmed = vendor.trim();
    const productTrimmed = product.trim();
    if (!vendorTrimmed && !productTrimmed) {
      toast({
        title: 'Missing details',
        description: 'Enter a vendor or product name to continue.',
        variant: 'destructive',
      });
      return;
    }
    if (!description.trim()) {
      toast({
        title: 'Missing description',
        description: 'Add a short description to continue.',
        variant: 'destructive',
      });
      return;
    }
    const nextVendor = vendorTrimmed || productTrimmed;
    const nextProduct = productTrimmed || vendorTrimmed;
    setVendor(nextVendor);
    setProduct(nextProduct);
    setStep('platforms');
  };

  const handleNextPlatforms = () => {
    if (selectedPlatforms.size === 0) {
      toast({
        title: 'Select platforms',
        description: 'Choose at least one MITRE platform to continue.',
        variant: 'destructive',
      });
      return;
    }
    setStep('review');
  };

  const handleNextStreams = async () => {
    if (!hasConfiguredStreams) {
      toast({
        title: 'Answer at least one question',
        description: 'Select at least one guided question so we can map data components.',
        variant: 'destructive',
      });
      return;
    }
    if (!createdProductId) {
      toast({
        title: 'Missing product ID',
        description: 'Create the product before saving guided coverage.',
        variant: 'destructive',
      });
      return;
    }
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      const normalizedStreams = streams.map(stream => ({
        ...stream,
        name: stream.name.trim() || defaultEvidenceSourceName,
      }));
      setStreams(normalizedStreams);
      await saveProductStreams(createdProductId, normalizedStreams);

      const configuredStreams = normalizedStreams.filter(stream => stream.mappedDataComponents.length > 0);
      const summary = await saveWizardCoverage(
        createdProductId,
        selectedPlatformsList,
        configuredStreams
      );

      setGuidedSummary(summary);
      toast({
        title: 'Guided coverage saved',
        description: `Inferred ${summary.techniques} technique${summary.techniques === 1 ? '' : 's'} from guided telemetry.`,
      });
      setStep('guided-results');
    } catch (error) {
      console.error(error);
      toast({
        title: 'Failed to save guided coverage',
        description: error instanceof Error ? error.message : 'Unexpected error',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoMap = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStep('analyzing');
    let created: CreatedProduct | null = null;

    try {
      setProgressMessage('Creating product...');
      const vendorTrimmed = vendor.trim();
      const productTrimmed = product.trim();
      const finalVendor = vendorTrimmed || productTrimmed;
      const finalProduct = productTrimmed || vendorTrimmed;
      const productId = buildProductId(finalVendor, finalProduct);
      created = await createProduct({
        productId,
        vendor: finalVendor,
        productName: finalProduct,
        description: description.trim(),
        platforms: Array.from(selectedPlatforms),
        dataComponentIds: [],
        source: 'custom',
      });

      if (aliases.length > 0) {
        setProgressMessage('Saving aliases...');
        await Promise.all(aliases.map(alias => addAlias(created.id, alias)));
      }

      setProgressMessage('Saving evidence sources...');
      const normalizedStreams = streams.map(stream => ({
        ...stream,
        name: stream.name.trim() || defaultEvidenceSourceName,
      }));
      await saveProductStreams(created.productId, normalizedStreams);

      setProgressMessage('Running auto mapper...');
      await runAutoMapper(created.productId);
      setProgressMessage('Finalizing mapping...');
      const mappingResult = await waitForMapping(created.productId);

      setCreatedProductId(created.productId);
      setProgressMessage('Preparing evidence prompts...');
      const ssm = await fetchProductSsm(created.productId);
      setSsmCapabilities(ssm);

      const techniqueIds = Array.from(
        new Set(ssm.flatMap(cap => cap.mappings.map(mapping => mapping.techniqueId)))
      );
      const requirementsEntries = await Promise.all(
        techniqueIds.map(async (techId) => ({
          techId,
          requirements: await fetchTechniqueRequirements(techId),
        }))
      );
      const requirementsMap: Record<string, TechniqueRequirement[]> = {};
      requirementsEntries.forEach(entry => {
        requirementsMap[entry.techId] = entry.requirements;
      });
      setTechniqueRequirements(requirementsMap);

      const defaultEvidence: Record<string, TechniqueEvidenceEntry[]> = {};
      techniqueIds.forEach((techId) => {
        const firstRequirement = requirementsMap[techId]?.[0];
        defaultEvidence[techId] = [{
          name: '',
          channel: '',
          eventId: '',
          dataComponent: firstRequirement?.dataComponentName || '',
        }];
      });
      setEvidenceEntries(defaultEvidence);
      setMappingSummary({
        techniques: techniqueIds.length,
        analytics: mappingResult?.mapping?.analytics?.length || 0,
        dataComponents: mappingResult?.mapping?.dataComponents?.length || 0,
        sources: mappingResult?.sources || (mappingResult?.source ? [mappingResult.source] : []),
      });

      toast({
        title: 'Auto mapping complete',
        description: `${product} has been created and mapped.`,
      });

      if (techniqueIds.length < EVIDENCE_AUTO_THRESHOLD || wantsEvidence) {
        setStep('streams');
      } else {
        setStep('complete');
      }
    } catch (error) {
      console.error(error);
      if (created?.productId) {
        try {
          await deleteProduct(created.productId);
        } catch (cleanupError) {
          console.error('Failed to delete product after auto-map failure', cleanupError);
        }
      }
      toast({
        title: 'Auto mapping failed',
        description: error instanceof Error ? error.message : 'Unexpected error',
        variant: 'destructive',
      });
      setStep('review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const techniqueList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; mappingIds: number[] }>();
    ssmCapabilities.forEach(cap => {
      cap.mappings.forEach(mapping => {
        if (!mapping.id) return;
        const existing = map.get(mapping.techniqueId) || {
          id: mapping.techniqueId,
          name: mapping.techniqueName,
          mappingIds: [],
        };
        existing.mappingIds.push(mapping.id);
        map.set(mapping.techniqueId, existing);
      });
    });
    return Array.from(map.values());
  }, [ssmCapabilities]);

  const updateEvidenceEntry = (
    techniqueId: string,
    index: number,
    field: keyof TechniqueEvidenceEntry,
    value: string
  ) => {
    setEvidenceEntries(prev => {
      const next = { ...prev };
      const entries = [...(next[techniqueId] || [])];
      const target = { ...(entries[index] || { name: '', channel: '', eventId: '', dataComponent: '' }) };
      target[field] = value;
      entries[index] = target;
      next[techniqueId] = entries;
      return next;
    });
  };

  const addEvidenceEntry = (techniqueId: string) => {
    setEvidenceEntries(prev => {
      const next = { ...prev };
      const entries = [...(next[techniqueId] || [])];
      entries.push({ name: '', channel: '', eventId: '', dataComponent: '' });
      next[techniqueId] = entries;
      return next;
    });
  };

  const handleSaveEvidence = async () => {
    if (!createdProductId) return;
    try {
      setIsSubmitting(true);
      setProgressMessage('Saving evidence metadata...');
      const updates: Promise<unknown>[] = [];
      let savedTechniques = 0;

      techniqueList.forEach((technique) => {
        const entries = (evidenceEntries[technique.id] || []).filter(entry => entry.name.trim().length > 0);
        if (entries.length === 0) return;
        savedTechniques += 1;
        const metadata = {
          log_sources: entries.map(entry => ({
            name: entry.name,
            channel: entry.channel || undefined,
            event_id: entry.eventId || undefined,
            satisfies_data_component: entry.dataComponent || undefined,
            dataComponent: entry.dataComponent || undefined,
          })),
        };
        technique.mappingIds.forEach(mappingId => {
          updates.push(updateMappingMetadata(mappingId, metadata));
        });
      });

      if (updates.length === 0) {
        toast({
          title: 'No evidence provided',
          description: 'No log sources were added. You can add them later.',
        });
        setStep('complete');
        setTimeout(() => {
          onComplete(createdProductId);
        }, 300);
        return;
      }

      await Promise.all(updates);
      toast({
        title: 'Evidence saved',
        description: `Saved evidence for ${savedTechniques} technique${savedTechniques === 1 ? '' : 's'}.`,
      });
      setStep('complete');
      setTimeout(() => {
        onComplete(createdProductId);
      }, 300);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Failed to save evidence',
        description: error instanceof Error ? error.message : 'Unexpected error',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'details') {
    return (
      <>
        {renderStepper()}
        <Card className="bg-card/50 backdrop-blur border-border max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Product details</CardTitle>
            <CardDescription>
              Add the vendor, product, aliases, and description. If the vendor and product are the same, you can fill just one.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor</Label>
                <Input
                  id="vendor"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="e.g., Microsoft"
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product">Product</Label>
                <Input
                  id="product"
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  placeholder="e.g., Defender for Endpoint"
                  className="bg-background"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a short description of the product and telemetry."
                className="bg-background min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aliases">Aliases</Label>
              <div className="flex gap-2">
                <Input
                  id="aliases"
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  placeholder="Add alias and press plus"
                  className="bg-background"
                />
                <Button type="button" variant="secondary" onClick={handleAddAlias}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {aliases.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {aliases.map(alias => (
                    <Badge key={alias} variant="secondary" className="flex items-center gap-1">
                      {alias}
                      <button
                        type="button"
                        onClick={() => handleRemoveAlias(alias)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="secondary" onClick={onCancel} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleNextDetails} className="flex-1">
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  if (step === 'platforms') {
    return (
      <>
        {renderStepper()}
        <Card className="bg-card/50 backdrop-blur border-border max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Select MITRE platforms</CardTitle>
            <CardDescription>
              Choose the platforms this product applies to so the mapping is scoped correctly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {platformsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading platforms...
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {platforms.map(platform => {
                  const isSelected = selectedPlatforms.has(platform);
                  const description = PLATFORM_DESCRIPTIONS[platform] || 'General MITRE platform coverage.';
                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => handleTogglePlatform(platform)}
                      className={cn(
                        'rounded-lg border px-3 py-3 text-left text-sm transition-colors',
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background/60 text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <div className="text-sm font-semibold">{platform}</div>
                      <div className={cn(
                        'text-xs mt-1 leading-snug',
                        isSelected ? 'text-primary/80' : 'text-muted-foreground'
                      )}>
                        {description}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {suggestedPlatforms.length > 0 && (
              <div className="rounded-lg border border-dashed border-border/80 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Suggested based on your details:
                <div className="flex flex-wrap gap-2 mt-2">
                  {suggestedPlatforms.map(platform => (
                    <Badge key={platform} variant="secondary">
                      {platform}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{selectedPlatforms.size} selected</span>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="secondary" onClick={() => setStep('details')} className="flex-1">
                Back
              </Button>
              <Button onClick={handleNextPlatforms} className="flex-1">
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  if (step === 'streams') {
    return (
      <>
        {renderStepper()}
        <Card className="bg-card/50 backdrop-blur border-border max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>Guided questions</CardTitle>
            <CardDescription>
              Answer the questions below to map your telemetry to MITRE data components.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {mappingSummary && (
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Auto-Mapper Results
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {mappingSummary.techniques > 0
                      ? 'We found initial coverage. Answer questions below to expand telemetry mapping.'
                      : 'No automatic mappings found. Answer questions below to build coverage.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="text-center p-2 rounded bg-background/40">
                      <div className="text-lg font-semibold text-foreground">{mappingSummary.techniques}</div>
                      <div className="text-xs text-muted-foreground">Techniques</div>
                    </div>
                    <div className="text-center p-2 rounded bg-background/40">
                      <div className="text-lg font-semibold text-foreground">{mappingSummary.analytics}</div>
                      <div className="text-xs text-muted-foreground">Analytics</div>
                    </div>
                    <div className="text-center p-2 rounded bg-background/40">
                      <div className="text-lg font-semibold text-foreground">{mappingSummary.dataComponents}</div>
                      <div className="text-xs text-muted-foreground">Data Components</div>
                    </div>
                    <div className="text-center p-2 rounded bg-background/40">
                      <div className="text-xs text-muted-foreground mb-1">Sources</div>
                      <div className="text-xs text-foreground">
                        {mappingSummary.sources.length > 0 ? mappingSummary.sources.join(', ') : 'Custom'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground space-y-3">
              <p>
                Those fields come from combining what the MITRE Data Component definition explicitly says is being captured
                with the minimum who/what/when/where/outcome attributes needed to make telemetry usable for correlation and analytics.
              </p>
              <p>
                Use MITRE Data Components to define what capability the data source provides, then confirm a small, consistent
                field checklist to ensure the capability is actionable in detection engineering.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={includeEnrichment}
                onCheckedChange={(checked) => {
                  const next = checked === true;
                  setIncludeEnrichment(next);
                  resetStreamGuided();
                }}
              />
              <span>Include external threat intelligence</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={includeDatabaseQuestions}
                onCheckedChange={(checked) => {
                  const next = checked === true;
                  setIncludeDatabaseQuestions(next);
                  resetStreamGuided();
                }}
              />
              <span>Include database platform questions</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Recommended data components are highlighted for {dataComponentPlatform || 'your selected platform'}.
            </div>

            <div className="space-y-4">
              {streams.slice(0, 1).map((stream, index) => (
                <div key={`stream-${index}`} className="border border-border rounded-lg p-4 space-y-4 bg-background/40">
                  {wizardContextOptions.length > 0 ? (
                    <>
                      <div className="space-y-6">
                        {wizardContextOptions.map((context, contextIdx) => (
                          <div key={`${context}-${index}`}>
                            {contextIdx > 0 && <Separator className="my-6" />}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <div className="text-xs uppercase text-primary font-semibold tracking-wide">{context}</div>
                                <Badge variant="outline" className="text-xs">
                                  {WIZARD_QUESTION_SETS[context]?.categories.reduce((sum, cat) => sum + cat.questions.length, 0)} questions
                                </Badge>
                              </div>
                              <ScrollArea className="h-96 border border-border rounded-md p-3">
                                <div className="space-y-4">
                                  {WIZARD_QUESTION_SETS[context]?.categories.map(category => {
                                    const advancedQuestions = category.questions.filter(question => question.advanced);
                                    const coreQuestions = category.questions.filter(question => !question.advanced);
                                    const showAdvanced = stream.metadata?.[`show_advanced_${category.id}`] === true;

                                    return (
                                      <div key={`${category.id}-${index}-${context}`} className="space-y-2">
                                        <div className="text-sm font-semibold text-foreground">{category.label}</div>
                                        {category.description && (
                                          <div className="text-xs text-muted-foreground">{category.description}</div>
                                        )}
                                        <div className="space-y-3">
                                          {coreQuestions.map(question => {
                                            const isChecked = Boolean(stream.questionAnswers?.[question.id]);
                                            const displayText = question.text.replace(/^Does it/i, 'Does the data source');
                                            const { missing } = resolveComponentNames(question.dcNames);
                                            return (
                                              <label key={`${question.id}-${index}-${context}`} className="flex items-start gap-2 text-sm">
                                                <Checkbox
                                                  checked={isChecked}
                                                  onCheckedChange={(checked) => {
                                                    const nextAnswers = { ...(stream.questionAnswers || {}) };
                                                    if (checked === true) {
                                                      nextAnswers[question.id] = true;
                                                    } else {
                                                      delete nextAnswers[question.id];
                                                    }
                                                    updateStreamGuided(index, { questionAnswers: nextAnswers });
                                                    applyGuidedMapping(index, nextAnswers);
                                                  }}
                                                />
                                                <span className="flex-1">
                                                  <span className="text-foreground">{displayText}</span>
                                                  {question.dcNames.length > 0 && (
                                                    <span className="block text-xs text-muted-foreground mt-1">
                                                      Data components: {question.dcNames.join(', ')}
                                                    </span>
                                                  )}
                                                  {missing.length > 0 && (
                                                    <span className="block text-xs text-amber-500 mt-1">
                                                      Not in bundle/version: {missing.join(', ')}
                                                    </span>
                                                  )}
                                                  {isChecked && question.dcNames.length > 0 && (
                                                    <InlineRequirementHint dcNames={question.dcNames} />
                                                  )}
                                                </span>
                                              </label>
                                            );
                                          })}
                                        </div>
                                        {advancedQuestions.length > 0 && (
                                          <div className="pt-2">
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => {
                                                updateStreamGuided(index, {
                                                  metadata: {
                                                    ...(stream.metadata || {}),
                                                    [`show_advanced_${category.id}`]: !showAdvanced,
                                                  },
                                                });
                                              }}
                                              className="text-xs text-muted-foreground hover:text-foreground"
                                            >
                                          {showAdvanced ? 'Hide advanced' : 'Show advanced'}
                                        </Button>
                                        {showAdvanced && (
                                          <div className="mt-2 space-y-3">
                                            {advancedQuestions.map(question => {
                                              const isChecked = Boolean(stream.questionAnswers?.[question.id]);
                                              const displayText = question.text.replace(/^Does it/i, 'Does the data source');
                                              const { missing } = resolveComponentNames(question.dcNames);
                                              return (
                                                <label key={`${question.id}-${index}-${context}-advanced`} className="flex items-start gap-2 text-sm">
                                                  <Checkbox
                                                    checked={isChecked}
                                                    onCheckedChange={(checked) => {
                                                      const nextAnswers = { ...(stream.questionAnswers || {}) };
                                                      if (checked === true) {
                                                        nextAnswers[question.id] = true;
                                                      } else {
                                                        delete nextAnswers[question.id];
                                                      }
                                                      updateStreamGuided(index, { questionAnswers: nextAnswers });
                                                      applyGuidedMapping(index, nextAnswers);
                                                    }}
                                                  />
                                                  <span className="flex-1">
                                                    <span className="text-foreground">{displayText}</span>
                                                    {question.dcNames.length > 0 && (
                                                      <span className="block text-xs text-muted-foreground mt-1">
                                                        Data components: {question.dcNames.join(', ')}
                                                      </span>
                                                    )}
                                                    {missing.length > 0 && (
                                                      <span className="block text-xs text-amber-500 mt-1">
                                                        Not in bundle/version: {missing.join(', ')}
                                                      </span>
                                                    )}
                                                    {isChecked && question.dcNames.length > 0 && (
                                                      <InlineRequirementHint dcNames={question.dcNames} />
                                                    )}
                                                  </span>
                                                </label>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                                </div>
                              </ScrollArea>
                              {context === 'External Threat Intelligence' && (
                                <div className="text-xs text-muted-foreground">
                                  External threat intelligence sources add context but do not replace primary telemetry.
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      No guided question sets match the selected platforms yet.
                    </div>
                  )}

                  {stream.mappedDataComponents.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {stream.mappedDataComponents.map(component => (
                        <Badge key={`${component}-${index}`} variant="secondary">
                          {component}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Derived Analytic Requirements Panel */}
            {streams[0]?.mappedDataComponents.length > 0 && (
              <AnalyticRequirementsPanel
                selectedDCNames={streams[0].mappedDataComponents}
                platform={dataComponentPlatform}
              />
            )}

            <div className="flex gap-3 pt-4">
              <Button variant="secondary" onClick={() => setStep('review')} className="flex-1">
                Back
              </Button>
              <Button onClick={handleNextStreams} className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Continue'}
                {!isSubmitting && <ChevronRight className="w-4 h-4 ml-2" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  if (step === 'review') {
    return (
      <div className="space-y-6">
        {renderStepper()}
        <Card className="bg-card/50 backdrop-blur border-border max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Review details</CardTitle>
            <CardDescription>Confirm the details before running Auto Map.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Vendor</div>
              <div className="text-sm font-medium text-foreground">{vendor}</div>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Product</div>
              <div className="text-sm font-medium text-foreground">{product}</div>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Description</div>
              <div className="text-sm text-foreground whitespace-pre-wrap">{description}</div>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Aliases</div>
              <div className="flex flex-wrap gap-2">
                {aliases.length === 0 ? (
                  <span className="text-sm text-muted-foreground">None</span>
                ) : (
                  aliases.map(alias => (
                    <Badge key={alias} variant="secondary">
                      {alias}
                    </Badge>
                  ))
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Platforms</div>
              <div className="flex flex-wrap gap-2">
                {selectedPlatformsList.map(platform => (
                  <Badge key={platform} variant="secondary">
                    {platform}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Data components selected</div>
              <div className="text-sm text-foreground">
                {streams.reduce((total, stream) => total + stream.mappedDataComponents.length, 0)} total
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={wantsEvidence}
                onCheckedChange={(checked) => setWantsEvidence(checked === true)}
              />
              <span className="text-foreground">Run evidence review after Auto Map</span>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="secondary" onClick={() => setStep('platforms')} className="flex-1">
                Back
              </Button>
              <Button onClick={handleAutoMap} className="flex-1" disabled={isSubmitting}>
                Auto Map
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'analyzing') {
    return (
      <>
        {renderStepper()}
        <Card className="bg-card/50 backdrop-blur border-border max-w-2xl mx-auto">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Auto mapping {product}...</h3>
            <p className="text-muted-foreground text-sm">
              Building coverage from community resources and MITRE mappings.
            </p>
            <div className="text-xs text-muted-foreground mt-3">{progressMessage}</div>
          </CardContent>
        </Card>
      </>
    );
  }

  if (step === 'evidence') {
    return (
      <div className="space-y-6">
        {renderStepper()}
        <Card className="bg-card/50 backdrop-blur border-border max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>Evidence review</CardTitle>
            <CardDescription>
              Use MITRE recommendations as a guide and add product-specific evidence when needed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
              Add evidence sources that satisfy the required data components for each technique. Use the
              <span className="text-foreground font-medium"> Add Log Source </span>
              button to attach evidence. You can also skip this step and add evidence later from the product page.
            </div>
            {shouldRecommendEvidence && (
              <div className="rounded-lg border border-border bg-primary/10 px-3 py-2 text-xs text-foreground">
                Auto Mapper returned fewer than 5 techniques. We recommend completing evidence now for best results.
              </div>
            )}
            {mappingSummary && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-3 text-center">
                  <div className="text-lg font-semibold text-foreground">{mappingSummary.techniques}</div>
                  <div className="text-xs text-muted-foreground">Techniques</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-3 text-center">
                  <div className="text-lg font-semibold text-foreground">{mappingSummary.analytics}</div>
                  <div className="text-xs text-muted-foreground">Analytics</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-3 text-center">
                  <div className="text-lg font-semibold text-foreground">{mappingSummary.dataComponents}</div>
                  <div className="text-xs text-muted-foreground">Data Components</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-3 text-center">
                  <div className="text-xs text-muted-foreground">Sources</div>
                  <div className="text-sm text-foreground">
                    {mappingSummary.sources.length > 0 ? mappingSummary.sources.join(', ') : 'Unknown'}
                  </div>
                </div>
              </div>
            )}
            {techniqueList.length === 0 && (
              <div className="text-sm text-muted-foreground">
                No techniques were returned by Auto Mapper, so there is nothing to attach evidence to yet.
                You can skip for now and add evidence later after techniques are mapped.
              </div>
            )}
            {!evidenceFormExpanded && techniqueList.length > 0 && (
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                Evidence entry is optional when 5 or more techniques are mapped. You can start now or skip and add evidence later.
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => setEvidenceFormExpanded(true)} className="flex-1">
                    Start evidence entry
                  </Button>
                  <Button variant="outline" onClick={() => setStep('complete')} className="flex-1">
                    Skip for now
                  </Button>
                </div>
              </div>
            )}

            {evidenceFormExpanded && techniqueList.map((technique) => {
              const requirements = techniqueRequirements[technique.id] || [];
              const entries = evidenceEntries[technique.id] || [];
              return (
                <div key={technique.id} className="border border-border rounded-lg p-4 bg-background/60">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {technique.id} — {technique.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Recommended data components: {requirements.length > 0
                          ? Array.from(new Set(requirements.map(req => req.dataComponentName))).join(', ')
                          : 'None provided by MITRE'}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => addEvidenceEntry(technique.id)}
                    >
                      Add Log Source
                    </Button>
                  </div>

                  {entries.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {entries.map((entry, idx) => (
                        <div key={`${technique.id}-${idx}`} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <Input
                            value={entry.name}
                            onChange={(event) => updateEvidenceEntry(technique.id, idx, 'name', event.target.value)}
                            placeholder="Log source name"
                            className="bg-background"
                          />
                          <Input
                            value={entry.channel}
                            onChange={(event) => updateEvidenceEntry(technique.id, idx, 'channel', event.target.value)}
                            placeholder="Channel"
                            className="bg-background"
                          />
                          <Input
                            value={entry.eventId}
                            onChange={(event) => updateEvidenceEntry(technique.id, idx, 'eventId', event.target.value)}
                            placeholder="Event ID"
                            className="bg-background"
                          />
                          <Input
                            value={entry.dataComponent}
                            onChange={(event) => updateEvidenceEntry(technique.id, idx, 'dataComponent', event.target.value)}
                            placeholder="Data component"
                            className="bg-background"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {evidenceFormExpanded && (
              <div className="flex gap-3 pt-4">
                <Button variant="secondary" onClick={() => setStep('complete')} className="flex-1">
                  Skip for now
                </Button>
                <Button onClick={handleSaveEvidence} className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save & Continue'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'guided-results') {
    const summary = guidedSummary;
    return (
      <>
        {renderStepper()}
        <Card className="bg-card/50 backdrop-blur border-primary/30 max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Guided mapping results</CardTitle>
            <CardDescription>
              Telemetry coverage inferred from your guided question selections.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center p-3 rounded bg-background/40">
                <div className="text-xl font-semibold text-foreground">{summary?.techniques ?? 0}</div>
                <div className="text-xs text-muted-foreground">Techniques</div>
              </div>
              <div className="text-center p-3 rounded bg-background/40">
                <div className="text-xl font-semibold text-foreground">{summary?.dataComponents ?? 0}</div>
                <div className="text-xs text-muted-foreground">Data Components</div>
              </div>
              <div className="text-center p-3 rounded bg-background/40">
                <div className="text-xl font-semibold text-foreground">{summary?.streams ?? 0}</div>
                <div className="text-xs text-muted-foreground">Streams</div>
              </div>
              <div className="text-center p-3 rounded bg-background/40">
                <div className="text-xs text-muted-foreground mb-1">Sources</div>
                <div className="text-xs text-foreground">
                  {summary?.sources?.length ? summary.sources.join(', ') : 'Guided telemetry'}
                </div>
              </div>
            </div>

            {summary?.platforms?.length ? (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Platforms</div>
                <div className="flex flex-wrap gap-2">
                  {summary.platforms.map(platform => (
                    <Badge key={platform} variant="secondary">
                      {platform}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {summary?.missingDataComponents && summary.missingDataComponents.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
                Not in MITRE bundle: {summary.missingDataComponents.join(', ')}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={() => setStep('streams')} className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => createdProductId && onComplete(createdProductId)}
                className="flex-1"
                disabled={!createdProductId}
              >
                View product
              </Button>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  if (step === 'complete') {
    return (
      <>
        {renderStepper()}
        <Card className="bg-card/50 backdrop-blur border-green-500/30 max-w-2xl mx-auto">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Mapping ready</h3>
            <p className="text-muted-foreground text-sm">
              {product} has been created and is ready to review.
            </p>
            {createdProductId && (
              <div className="text-xs text-muted-foreground mt-2">{createdProductId}</div>
            )}
          </CardContent>
        </Card>
      </>
    );
  }

  return null;
}
