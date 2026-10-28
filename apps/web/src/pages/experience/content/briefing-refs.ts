import type { StageId } from '@poc-intel/shared'

/**
 * The references each Briefing cites, kept out of the locale files so an ID never differs between
 * languages. Names here are the frameworks' own (English); ref-names.<locale>.ts translates them.
 * Every entry is to be reviewed by the product owner before a customer sees it (plan, Q5).
 */
export type Framework = 'MITRE ATT&CK' | 'MITRE D3FEND' | 'NIST CSF 2.0' | 'CIS Controls v8' | 'PCI DSS v4.0' | 'ISO/IEC 27001:2022' | 'LGPD'

export interface FrameworkRef {
  framework: Framework
  ref: string
  name: string
}

export interface Technique {
  /** ATT&CK technique or tactic ID: T1021, T1071.004, TA0008. */
  id: string
  name: string
}

export interface BriefingRefs {
  frameworks: FrameworkRef[]
  techniques: Technique[]
}

const csf = (ref: string, name: string): FrameworkRef => ({ framework: 'NIST CSF 2.0', ref, name })
const cis = (ref: string, name: string): FrameworkRef => ({ framework: 'CIS Controls v8', ref, name })
const attack = (ref: string, name: string): FrameworkRef => ({ framework: 'MITRE ATT&CK', ref, name })
const d3f = (ref: string, name: string): FrameworkRef => ({ framework: 'MITRE D3FEND', ref, name })
const pci = (ref: string, name: string): FrameworkRef => ({ framework: 'PCI DSS v4.0', ref, name })
const iso = (ref: string, name: string): FrameworkRef => ({ framework: 'ISO/IEC 27001:2022', ref, name })
const t = (id: string, name: string): Technique => ({ id, name })

export const BRIEFING_REFS: Record<StageId, BriefingRefs> = {
  data_sources: {
    frameworks: [
      csf('ID.AM-03', 'Representations of authorized network communication and data flows are maintained'),
      csf('DE.CM-09', 'Computing hardware and software, runtime environments, and their data are monitored'),
      cis('8.2', 'Collect Audit Logs'),
      pci('10.2.1', 'Audit logs are enabled and active for all system components'),
    ],
    techniques: [t('T1078', 'Valid Accounts'), t('T1562.002', 'Impair Defenses: Disable Windows Event Logging'), t('T1070.001', 'Indicator Removal: Clear Windows Event Logs')],
  },
  collection: {
    frameworks: [
      csf('DE.CM-01', 'Networks and network services are monitored'),
      csf('DE.CM-09', 'Computing hardware and software, runtime environments, and their data are monitored'),
      cis('8.9', 'Centralize Audit Logs'),
      cis('13.6', 'Collect Network Traffic Flow Logs'),
    ],
    techniques: [t('T1078.004', 'Valid Accounts: Cloud Accounts'), t('T1562.008', 'Impair Defenses: Disable or Modify Cloud Logs'), t('T1530', 'Data from Cloud Storage')],
  },
  normalization: {
    frameworks: [csf('DE.AE-03', 'Information is correlated from multiple sources'), csf('PR.PS-04', 'Log records are generated and made available for continuous monitoring'), cis('8.11', 'Conduct Audit Log Reviews')],
    techniques: [t('T1110', 'Brute Force'), t('T1078', 'Valid Accounts'), t('T1133', 'External Remote Services')],
  },
  threat_intel: {
    frameworks: [
      csf('ID.RA-02', 'Cyber threat intelligence is received from information sharing forums and sources'),
      csf('DE.AE-07', 'Cyber threat intelligence and other contextual information are integrated into the analysis'),
      iso('A.5.7', 'Threat intelligence'),
    ],
    techniques: [
      t('T1566', 'Phishing'),
      t('T1071.001', 'Application Layer Protocol: Web Protocols'),
      t('T1071.004', 'Application Layer Protocol: DNS'),
      t('T1568.002', 'Dynamic Resolution: Domain Generation Algorithms'),
      t('T1583.001', 'Acquire Infrastructure: Domains'),
      t('T1105', 'Ingress Tool Transfer'),
    ],
  },
  enrichment: {
    frameworks: [
      csf('ID.AM-01', 'Inventories of hardware managed by the organization are maintained'),
      csf('DE.AE-07', 'Cyber threat intelligence and other contextual information are integrated into the analysis'),
      cis('1.1', 'Establish and Maintain Detailed Enterprise Asset Inventory'),
      cis('5.1', 'Establish and Maintain an Inventory of Accounts'),
    ],
    techniques: [t('T1078', 'Valid Accounts'), t('T1133', 'External Remote Services'), t('T1098', 'Account Manipulation')],
  },
  ingestion_filters: {
    frameworks: [
      csf('PR.PS-04', 'Log records are generated and made available for continuous monitoring'),
      cis('8.3', 'Ensure Adequate Audit Log Storage'),
      pci('10.2.1', 'Audit logs are enabled and active for all system components'),
    ],
    techniques: [t('T1562.002', 'Impair Defenses: Disable Windows Event Logging'), t('T1070.001', 'Indicator Removal: Clear Windows Event Logs')],
  },
  data_lake: {
    frameworks: [
      cis('8.10', 'Retain Audit Logs'),
      pci('10.5.1', 'Retain audit log history for at least 12 months, with at least the most recent three months immediately available'),
      iso('A.8.15', 'Logging'),
      { framework: 'LGPD', ref: 'Art. 46', name: 'Security and technical and administrative measures to protect personal data' },
    ],
    techniques: [t('T1505.003', 'Server Software Component: Web Shell'), t('T1053.005', 'Scheduled Task/Job: Scheduled Task'), t('T1070.001', 'Indicator Removal: Clear Windows Event Logs')],
  },
  ndr: {
    frameworks: [
      attack('TA0008', 'Lateral Movement'),
      attack('TA0011', 'Command and Control'),
      attack('TA0010', 'Exfiltration'),
      csf('DE.CM-01', 'Networks and network services are monitored'),
      cis('13.3', 'Deploy a Network Intrusion Detection Solution'),
      d3f('D3-NTA', 'Network Traffic Analysis'),
      pci('11.5.1', 'Intrusion-detection and/or intrusion-prevention techniques are used to detect and/or prevent intrusions into the network'),
    ],
    techniques: [
      t('T1021', 'Remote Services'),
      t('T1021.002', 'Remote Services: SMB/Windows Admin Shares'),
      t('T1210', 'Exploitation of Remote Services'),
      t('T1570', 'Lateral Tool Transfer'),
      t('T1046', 'Network Service Discovery'),
      t('T1071.004', 'Application Layer Protocol: DNS'),
      t('T1048', 'Exfiltration Over Alternative Protocol'),
      t('T1571', 'Non-Standard Port'),
    ],
  },
  sandbox: {
    frameworks: [d3f('D3-DA', 'Dynamic Analysis'), cis('10.7', 'Use Behavior-Based Anti-Malware Software'), cis('9.7', 'Deploy and Maintain Email Server Anti-Malware Protections'), iso('A.8.7', 'Protection against malware')],
    techniques: [
      t('T1566.001', 'Phishing: Spearphishing Attachment'),
      t('T1204.002', 'User Execution: Malicious File'),
      t('T1189', 'Drive-by Compromise'),
      t('T1105', 'Ingress Tool Transfer'),
      t('T1027', 'Obfuscated Files or Information'),
    ],
  },
  fim: {
    frameworks: [
      pci('11.5.2', 'A change-detection mechanism is deployed to alert personnel to unauthorized modification of critical files'),
      csf('DE.CM-09', 'Computing hardware and software, runtime environments, and their data are monitored'),
      cis('3.14', 'Log Sensitive Data Access'),
    ],
    techniques: [
      t('T1505.003', 'Server Software Component: Web Shell'),
      t('T1565.001', 'Data Manipulation: Stored Data Manipulation'),
      t('T1547.001', 'Boot or Logon Autostart Execution: Registry Run Keys / Startup Folder'),
      t('T1543', 'Create or Modify System Process'),
      t('T1222', 'File and Directory Permissions Modification'),
      t('T1486', 'Data Encrypted for Impact'),
    ],
  },
  itdr_ueba: {
    frameworks: [
      attack('TA0006', 'Credential Access'),
      attack('TA0004', 'Privilege Escalation'),
      csf('DE.CM-03', 'Personnel activity and technology usage are monitored'),
      d3f('D3-UBA', 'User Behavior Analysis'),
      cis('5.4', 'Restrict Administrator Privileges to Dedicated Administrator Accounts'),
    ],
    techniques: [
      t('T1078', 'Valid Accounts'),
      t('T1110.003', 'Brute Force: Password Spraying'),
      t('T1558.003', 'Steal or Forge Kerberos Tickets: Kerberoasting'),
      t('T1550.002', 'Use Alternate Authentication Material: Pass the Hash'),
      t('T1621', 'Multi-Factor Authentication Request Generation'),
      t('T1098', 'Account Manipulation'),
      t('T1567', 'Exfiltration Over Web Service'),
    ],
  },
  detection: {
    frameworks: [
      csf('DE.AE-02', 'Potentially adverse events are analyzed to better understand associated activities'),
      csf('DE.AE-08', 'Incidents are declared when adverse events meet the defined incident criteria'),
      cis('13.1', 'Centralize Security Event Alerting'),
      pci('10.4.1.1', 'Automated mechanisms are used to perform audit log reviews'),
      iso('A.8.16', 'Monitoring activities'),
    ],
    techniques: [
      t('T1059.001', 'Command and Scripting Interpreter: PowerShell'),
      t('T1027', 'Obfuscated Files or Information'),
      t('T1003.001', 'OS Credential Dumping: LSASS Memory'),
      t('T1190', 'Exploit Public-Facing Application'),
      t('T1486', 'Data Encrypted for Impact'),
    ],
  },
  correlation: {
    frameworks: [
      csf('DE.AE-03', 'Information is correlated from multiple sources'),
      csf('DE.AE-04', 'The estimated impact and scope of adverse events are understood'),
      csf('DE.AE-08', 'Incidents are declared when adverse events meet the defined incident criteria'),
    ],
    techniques: [t('T1566', 'Phishing'), t('T1059', 'Command and Scripting Interpreter'), t('T1021', 'Remote Services'), t('T1041', 'Exfiltration Over C2 Channel'), t('T1486', 'Data Encrypted for Impact')],
  },
  agentic_soc: {
    frameworks: [
      csf('RS.MA-02', 'Incident reports are triaged and validated'),
      csf('RS.AN-03', 'Analysis is performed to establish what has taken place during an incident and the root cause of the incident'),
      iso('A.5.25', 'Assessment and decision on information security events'),
    ],
    techniques: [t('T1078', 'Valid Accounts'), t('T1059.001', 'Command and Scripting Interpreter: PowerShell'), t('T1021', 'Remote Services')],
  },
  response: {
    frameworks: [
      csf('RS.MI-01', 'Incidents are contained'),
      csf('RS.MI-02', 'Incidents are eradicated'),
      d3f('D3-NI', 'Network Isolation'),
      d3f('D3-AL', 'Account Locking'),
      cis('17.4', 'Establish and Maintain an Incident Response Process'),
      iso('A.5.26', 'Response to information security incidents'),
    ],
    techniques: [t('T1486', 'Data Encrypted for Impact'), t('T1490', 'Inhibit System Recovery'), t('T1041', 'Exfiltration Over C2 Channel'), t('T1078', 'Valid Accounts'), t('T1566', 'Phishing')],
  },
  topology: {
    frameworks: [
      csf('ID.AM-03', 'Representations of authorized network communication and data flows are maintained'),
      csf('DE.CM-01', 'Networks and network services are monitored'),
      csf('DE.CM-09', 'Computing hardware and software, runtime environments, and their data are monitored'),
      cis('8.2', 'Collect Audit Logs'),
      cis('13.6', 'Collect Network Traffic Flow Logs'),
      iso('A.8.16', 'Monitoring activities'),
    ],
    techniques: [t('T1562.001', 'Impair Defenses: Disable or Modify Tools'), t('T1070', 'Indicator Removal'), t('T1021', 'Remote Services'), t('T1133', 'External Remote Services')],
  },
  // The lab's Caldera attack chain, step by step (Lab presentation, slide 3).
  lab: {
    frameworks: [
      csf('DE.AE-02', 'Potentially adverse events are analyzed to better understand associated activities'),
      csf('RS.MI-01', 'Incidents are contained'),
      d3f('D3-NI', 'Network Isolation'),
      d3f('D3-AL', 'Account Locking'),
    ],
    techniques: [
      t('T1046', 'Network Service Discovery'),
      t('T1110', 'Brute Force'),
      t('T1003', 'OS Credential Dumping'),
      t('T1490', 'Inhibit System Recovery'),
      t('T1082', 'System Information Discovery'),
      t('T1021.002', 'Remote Services: SMB/Windows Admin Shares'),
      t('T1570', 'Lateral Tool Transfer'),
    ],
  },
}

/**
 * The official Stellar Cyber documentation page of each Stage, relative to the version root of the
 * Data Source Catalog (docs.stellarcyber.ai/prod-docs/<version>/). Each page was fetched and checked against
 * its Stage on 2026-10-17 (7.0.xs).
 */
export const BRIEFING_DOCS: Record<StageId, { path: string; title: string }[]> = {
  data_sources: [
    { path: 'Configure/Ports/Firewall-Ports-for-Parsers.htm', title: 'Log Parser Ports' },
    { path: 'Configure/Connectors/4-Connectors-Integrations.htm', title: 'Connectors and Integrations Reference' },
  ],
  collection: [
    { path: 'Common/Stellar-Architecture.htm', title: 'Stellar Cyber Architecture' },
    { path: 'Configure/Overview-Connectors.htm', title: 'Configuring Connectors' },
  ],
  normalization: [
    { path: 'Common/Understanding-Interflow.htm', title: 'Understanding Interflow' },
    { path: 'Common/Understanding-Indices.htm', title: 'Index Definitions & Details' },
  ],
  threat_intel: [{ path: 'Configure/Threat-Intelligence-Platform-Feeds.htm', title: 'Configuring Feeds in the Threat Intelligence Platform' }],
  enrichment: [
    { path: 'Configure/Data-Enrichment.htm', title: 'Configuring Data Enrichment' },
    { path: 'Using/Investigate/Asset-Analytics-Main.htm', title: 'Analyzing Assets' },
  ],
  ingestion_filters: [{ path: 'Configure/Filters/Filters-Log.htm', title: 'Managing Log Filters' }],
  // No 7.0.xs page covers Data Lake retention; the architecture page shows where the Data Lake sits.
  data_lake: [{ path: 'Common/Stellar-Architecture.htm', title: 'Stellar Cyber Architecture' }],
  ndr: [
    { path: 'Using/Visualizer/Dashboard-Network-Visibility.htm', title: 'Network Visibility' },
    { path: 'Using/Visualizer/Dashboard-ML-IDS.htm', title: 'Intrusion Signatures Dashboard' },
  ],
  sandbox: [{ path: 'Using/Visualizer/Dashboard-Malware-Sandbox.htm', title: 'Malware Sandbox' }],
  fim: [{ path: 'Using/Guides/BestPractices-FIM.htm', title: 'Tuning File Integrity Monitoring on Stellar Cyber Server Sensors' }],
  itdr_ueba: [{ path: 'Using/Investigate/User-Behavior-Analytics.htm', title: 'User Behavior Analytics in Stellar Cyber' }],
  detection: [
    { path: 'Common/Home-XDR-Kill-Chain-Understanding.htm', title: 'Understanding the XDR Kill Chain' },
    { path: 'Using/ML/Machine-Learning-Intro.htm', title: 'Machine Learning and Analytics Overview' },
  ],
  correlation: [{ path: 'Using/Cases/Cases-Understanding.htm', title: 'How Stellar Cyber Correlates Alerts into Cases' }],
  agentic_soc: [
    { path: 'Using/AI-Inv/AI-Investigator.htm', title: 'Using AI Investigator' },
    { path: 'Using/Auto-Triage/alert-auto-triage.htm', title: 'Alert Auto Triage in Stellar Cyber' },
  ],
  response: [{ path: 'Using/Respond/Automation-Main.htm', title: 'Automated Threat Hunting (ATH) in Stellar Cyber' }],
  topology: [
    { path: 'Common/Stellar-Architecture.htm', title: 'Stellar Cyber Architecture' },
    { path: 'Configure/Overview-Connectors.htm', title: 'Configuring Connectors' },
  ],
  // The lab is reached at coe.stellarcyber.cloud; it has no documentation page of its own.
  lab: [],
}
