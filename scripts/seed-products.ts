import { db } from "../server/db";
import { products } from "../shared/schema";

const ctidMappedProducts = [
  {
    productId: 'CTID-AZURE-ENTRA',
    vendor: 'Microsoft',
    productName: 'Azure Entra ID',
    deployment: 'Cloud',
    description: 'Cloud-based identity and access management service. Provides authentication, conditional access, and identity protection.',
    platforms: ['Azure AD', 'Identity Provider'],
    dataComponentIds: ['DC001', 'DC002', 'DC003', 'DC004', 'DC009', 'DC012', 'DC013', 'DC014'],
    source: 'ctid',
  },
  {
    productId: 'CTID-MERAKI-MR',
    vendor: 'Cisco',
    productName: 'Meraki MR (Wireless)',
    deployment: 'Cloud-managed',
    description: 'Cloud-managed wireless access points with integrated security features.',
    platforms: ['Network'],
    dataComponentIds: ['DC005', 'DC006', 'DC010', 'DC015'],
    source: 'ctid',
  },
  {
    productId: 'CTID-AIRMARSHAL',
    vendor: 'Cisco',
    productName: 'Meraki Air Marshal',
    deployment: 'Cloud-managed',
    description: 'Wireless intrusion detection and prevention system (WIDS/WIPS) integrated into Meraki infrastructure.',
    platforms: ['Network'],
    dataComponentIds: ['DC010', 'DC015', 'DC016'],
    source: 'ctid',
  },
  {
    productId: 'CTID-WINDOWS',
    vendor: 'Microsoft',
    productName: 'Windows Event Logging',
    deployment: 'On-premises / Hybrid',
    description: 'Native Windows security event logging including Security, PowerShell, Sysmon, and application logs. Foundation for endpoint detection.',
    platforms: ['Windows'],
    dataComponentIds: ['DC001', 'DC002', 'DC003', 'DC004', 'DC007', 'DC008', 'DC014', 'DC017', 'DC018', 'DC019', 'DC020'],
    source: 'ctid',
  },
  {
    productId: 'CTID-SYSMON',
    vendor: 'Microsoft',
    productName: 'Sysmon (System Monitor)',
    deployment: 'On-premises',
    description: 'Windows system service that logs detailed system activity including process creation, network connections, and file changes.',
    platforms: ['Windows'],
    dataComponentIds: ['DC007', 'DC017', 'DC018', 'DC020'],
    source: 'ctid',
  },
];

async function seed() {
  console.log('Seeding products...');
  
  for (const product of ctidMappedProducts) {
    try {
      await db.insert(products).values(product).onConflictDoNothing();
      console.log(`  ✓ ${product.productName}`);
    } catch (error) {
      console.error(`  ✗ ${product.productName}:`, error);
    }
  }
  
  console.log('Done!');
  process.exit(0);
}

seed().catch(console.error);
