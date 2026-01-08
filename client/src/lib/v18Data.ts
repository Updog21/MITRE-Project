export interface Asset {
  id: string;
  vendor: string;
  productName: string;
  deployment?: string;
  description: string;
  dataComponents: string[];
  source: 'ctid' | 'custom' | 'ai-pending';
}

export interface DataComponent {
  id: string;
  name: string;
  description: string;
  dataSource: string;
}

export interface Analytic {
  id: string;
  name: string;
  description: string;
  requiredDataComponents: string[];
  detectsTechniques: string[];
  source: string;
}

export interface Technique {
  id: string;
  name: string;
  tactic: string;
  description: string;
  usedByGroups: string[];
}

export interface ProductMapping {
  asset: Asset;
  dataComponents: DataComponent[];
  analytics: Analytic[];
  techniques: Technique[];
  valueScore: number;
  gapsFilled: string[];
}

export interface MappingReview {
  techniqueId: string;
  status: 'approved' | 'rejected' | 'pending';
  confidence: number;
  feedback?: string;
}

export const dataComponents: DataComponent[] = [
  { id: 'DC001', name: 'User Account Authentication', description: 'Logs of user authentication attempts including success/failure', dataSource: 'Authentication Logs' },
  { id: 'DC002', name: 'User Account Creation', description: 'Logs of new user account creation events', dataSource: 'Directory Services' },
  { id: 'DC003', name: 'User Account Modification', description: 'Logs of user account attribute changes', dataSource: 'Directory Services' },
  { id: 'DC004', name: 'Logon Session Creation', description: 'Logs of new logon sessions being established', dataSource: 'Authentication Logs' },
  { id: 'DC005', name: 'Network Traffic Flow', description: 'Network connection metadata including source/dest IPs', dataSource: 'Network Logs' },
  { id: 'DC006', name: 'Network Connection Creation', description: 'New network connection establishment events', dataSource: 'Network Logs' },
  { id: 'DC007', name: 'Application Log', description: 'Application-level audit events', dataSource: 'Application Logs' },
  { id: 'DC008', name: 'Cloud Service Access', description: 'Access events to cloud resources and services', dataSource: 'Cloud Audit Logs' },
  { id: 'DC009', name: 'Wireless Network Connection', description: 'WiFi association and connection events', dataSource: 'Wireless Logs' },
  { id: 'DC010', name: 'Device Registration', description: 'Device enrollment and registration events', dataSource: 'Device Management' },
  { id: 'DC011', name: 'Conditional Access Evaluation', description: 'Policy evaluation for access decisions', dataSource: 'Identity Provider' },
  { id: 'DC012', name: 'Token Issuance', description: 'OAuth/SAML token generation events', dataSource: 'Identity Provider' },
  { id: 'DC013', name: 'Group Membership Change', description: 'Changes to group membership', dataSource: 'Directory Services' },
  { id: 'DC014', name: 'Rogue AP Detection', description: 'Detection of unauthorized wireless access points', dataSource: 'Wireless IDS' },
  { id: 'DC015', name: 'Client Isolation Events', description: 'Wireless client isolation and containment events', dataSource: 'Wireless Security' },
];

export const analytics: Analytic[] = [
  { id: 'CAR-2021-01-001', name: 'Successful Login from Multiple Geolocations', description: 'Detects when a user logs in from geographically distant locations in a short time', requiredDataComponents: ['DC001', 'DC004'], detectsTechniques: ['T1078'], source: 'MITRE CAR' },
  { id: 'CAR-2021-01-002', name: 'Impossible Travel Detection', description: 'Identifies authentication from locations impossible to travel between', requiredDataComponents: ['DC001', 'DC004', 'DC011'], detectsTechniques: ['T1078', 'T1550'], source: 'MITRE CAR' },
  { id: 'CAR-2021-02-001', name: 'Suspicious Account Creation', description: 'Detects creation of accounts with admin privileges', requiredDataComponents: ['DC002', 'DC013'], detectsTechniques: ['T1136'], source: 'MITRE CAR' },
  { id: 'CAR-2021-02-002', name: 'Privilege Escalation via Group Change', description: 'Detects addition of users to privileged groups', requiredDataComponents: ['DC003', 'DC013'], detectsTechniques: ['T1078', 'T1098'], source: 'MITRE CAR' },
  { id: 'CAR-2021-03-001', name: 'Suspicious Token Usage', description: 'Detects OAuth token abuse patterns', requiredDataComponents: ['DC012', 'DC008'], detectsTechniques: ['T1550', 'T1528'], source: 'MITRE CAR' },
  { id: 'CAR-2021-04-001', name: 'External Remote Service Access', description: 'Detects access via external remote services', requiredDataComponents: ['DC005', 'DC006', 'DC004'], detectsTechniques: ['T1133'], source: 'MITRE CAR' },
  { id: 'SIGMA-NET-001', name: 'Rogue Access Point Detection', description: 'Identifies unauthorized wireless access points', requiredDataComponents: ['DC014', 'DC009'], detectsTechniques: ['T1557', 'T1200'], source: 'Sigma' },
  { id: 'SIGMA-NET-002', name: 'Anomalous Wireless Client Behavior', description: 'Detects unusual wireless client connection patterns', requiredDataComponents: ['DC009', 'DC015'], detectsTechniques: ['T1557', 'T1040'], source: 'Sigma' },
  { id: 'CAR-2021-05-001', name: 'MFA Fatigue Attack', description: 'Detects repeated MFA push notifications indicative of fatigue attack', requiredDataComponents: ['DC001', 'DC011'], detectsTechniques: ['T1621'], source: 'MITRE CAR' },
  { id: 'CAR-2021-05-002', name: 'Conditional Access Bypass Attempt', description: 'Detects attempts to bypass conditional access policies', requiredDataComponents: ['DC011', 'DC004'], detectsTechniques: ['T1556'], source: 'MITRE CAR' },
];

export const techniques: Technique[] = [
  { id: 'T1078', name: 'Valid Accounts', tactic: 'Defense Evasion, Persistence, Privilege Escalation, Initial Access', description: 'Adversaries may obtain and abuse credentials of existing accounts', usedByGroups: ['APT29', 'APT28', 'Lazarus'] },
  { id: 'T1550', name: 'Use Alternate Authentication Material', tactic: 'Defense Evasion, Lateral Movement', description: 'Adversaries may use alternate authentication material such as tokens', usedByGroups: ['APT29', 'APT28'] },
  { id: 'T1136', name: 'Create Account', tactic: 'Persistence', description: 'Adversaries may create accounts to maintain access', usedByGroups: ['APT29', 'Lazarus'] },
  { id: 'T1098', name: 'Account Manipulation', tactic: 'Persistence', description: 'Adversaries may manipulate accounts to maintain access', usedByGroups: ['APT29', 'APT28'] },
  { id: 'T1528', name: 'Steal Application Access Token', tactic: 'Credential Access', description: 'Adversaries can steal application access tokens', usedByGroups: ['APT29'] },
  { id: 'T1133', name: 'External Remote Services', tactic: 'Persistence, Initial Access', description: 'Adversaries may leverage external-facing remote services', usedByGroups: ['APT28', 'Lazarus'] },
  { id: 'T1557', name: 'Adversary-in-the-Middle', tactic: 'Credential Access, Collection', description: 'Adversaries may attempt to position themselves between endpoints', usedByGroups: ['APT28'] },
  { id: 'T1200', name: 'Hardware Additions', tactic: 'Initial Access', description: 'Adversaries may introduce hardware devices to gain access', usedByGroups: ['APT28'] },
  { id: 'T1040', name: 'Network Sniffing', tactic: 'Credential Access, Discovery', description: 'Adversaries may sniff network traffic to capture credentials', usedByGroups: ['APT28', 'APT29'] },
  { id: 'T1621', name: 'Multi-Factor Authentication Request Generation', tactic: 'Credential Access', description: 'Adversaries may generate MFA requests to gain access (MFA fatigue)', usedByGroups: ['APT29', 'Lazarus'] },
  { id: 'T1556', name: 'Modify Authentication Process', tactic: 'Credential Access, Defense Evasion, Persistence', description: 'Adversaries may modify authentication mechanisms', usedByGroups: ['APT29'] },
];

export const ctidMappedProducts: Asset[] = [
  {
    id: 'CTID-AZURE-ENTRA',
    vendor: 'Microsoft',
    productName: 'Azure Entra ID',
    deployment: 'Cloud',
    description: 'Cloud-based identity and access management service. Provides authentication, conditional access, and identity protection.',
    dataComponents: ['DC001', 'DC002', 'DC003', 'DC004', 'DC008', 'DC011', 'DC012', 'DC013'],
    source: 'ctid',
  },
  {
    id: 'CTID-MERAKI-MR',
    vendor: 'Cisco',
    productName: 'Meraki MR (Wireless)',
    deployment: 'Cloud-managed',
    description: 'Cloud-managed wireless access points with integrated security features.',
    dataComponents: ['DC005', 'DC006', 'DC009', 'DC014'],
    source: 'ctid',
  },
  {
    id: 'CTID-AIRMARSHAL',
    vendor: 'Cisco',
    productName: 'Meraki Air Marshal',
    deployment: 'Cloud-managed',
    description: 'Wireless intrusion detection and prevention system (WIDS/WIPS) integrated into Meraki infrastructure.',
    dataComponents: ['DC009', 'DC014', 'DC015'],
    source: 'ctid',
  },
];

export function searchProducts(query: string): Asset[] {
  const lowerQuery = query.toLowerCase();
  return ctidMappedProducts.filter(p => 
    p.vendor.toLowerCase().includes(lowerQuery) ||
    p.productName.toLowerCase().includes(lowerQuery) ||
    p.description.toLowerCase().includes(lowerQuery)
  );
}

export function getProductMapping(assetId: string): ProductMapping | null {
  const asset = ctidMappedProducts.find(p => p.id === assetId);
  if (!asset) return null;

  const productDataComponents = dataComponents.filter(dc => 
    asset.dataComponents.includes(dc.id)
  );

  const productAnalytics = analytics.filter(a => 
    a.requiredDataComponents.some(dc => asset.dataComponents.includes(dc))
  );

  const techniqueIds = new Set<string>();
  productAnalytics.forEach(a => a.detectsTechniques.forEach(t => techniqueIds.add(t)));
  
  const productTechniques = techniques.filter(t => techniqueIds.has(t.id));

  const valueScore = Math.min(100, productAnalytics.length * 10 + productDataComponents.length * 5);

  return {
    asset,
    dataComponents: productDataComponents,
    analytics: productAnalytics,
    techniques: productTechniques,
    valueScore,
    gapsFilled: productTechniques.map(t => t.id),
  };
}

export function generateAIMapping(vendor: string, product: string, details: string): ProductMapping {
  const mockDataComponents = dataComponents.slice(0, 3);
  const mockAnalytics = analytics.slice(0, 2);
  const mockTechniqueIds = new Set<string>();
  mockAnalytics.forEach(a => a.detectsTechniques.forEach(t => mockTechniqueIds.add(t)));
  const mockTechniques = techniques.filter(t => mockTechniqueIds.has(t.id));

  return {
    asset: {
      id: `AI-${Date.now()}`,
      vendor,
      productName: product,
      deployment: details,
      description: `AI-analyzed mapping for ${vendor} ${product}`,
      dataComponents: mockDataComponents.map(dc => dc.id),
      source: 'ai-pending',
    },
    dataComponents: mockDataComponents,
    analytics: mockAnalytics,
    techniques: mockTechniques,
    valueScore: 65,
    gapsFilled: mockTechniques.map(t => t.id),
  };
}

export interface CustomMapping extends ProductMapping {
  reviews: MappingReview[];
  createdAt: Date;
  updatedAt: Date;
  status: 'draft' | 'approved';
}

let customMappings: CustomMapping[] = [];

export function saveCustomMapping(mapping: ProductMapping, reviews: MappingReview[]): CustomMapping {
  const custom: CustomMapping = {
    ...mapping,
    asset: { ...mapping.asset, source: 'custom' },
    reviews,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'approved',
  };
  customMappings.push(custom);
  return custom;
}

export function getCustomMappings(): CustomMapping[] {
  return customMappings;
}

export function getAllProducts(): Asset[] {
  return [...ctidMappedProducts, ...customMappings.map(m => m.asset)];
}
