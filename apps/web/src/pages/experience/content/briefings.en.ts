import type { Briefings } from './types'

export const briefingsEn: Briefings = {
  data_sources: {
    how: [
      'Each source enters through one of three paths: logs sent by syslog (RFC 3164/5424, CEF, LEEF, JSON), telemetry collected by a sensor (network and servers), or an API queried by a Connector (cloud, SaaS, EDR, identity).',
      'The platform recognizes the source by the parser tied to the port or to the configured Connector, and each record arrives already labeled with its origin, tenant, and time of receipt.',
      'Sources outside the catalog can be ingested through a custom parser, without discarding the raw data.',
    ],
    value: [
      'The SOC no longer depends on one console per tool: firewall, EDR, identity, and cloud answer in the same investigation.',
      'Visibility gaps become explicit: you can see which assets and which stages of an attack no source covers.',
    ],
    objectives: ['Visibility coverage', 'Log source inventory', 'Foundation for audit compliance', 'Fewer blind spots'],
    techniquesLead: 'Without the right source, these techniques pass through the SOC without a trace:',
  },
  collection: {
    how: [
      'Modular Sensor: a physical or virtual appliance that receives logs (log forwarder), collects flows (NetFlow/IPFIX/sFlow), and performs DPI on SPAN/TAP ports.',
      'Server Sensor: a lightweight agent for Windows and Linux that collects system events, processes, connections, and file changes.',
      'Cloud Connectors: API integrations with AWS, Azure, Google Cloud, Microsoft 365, and other SaaS, including cloud detection and response (CDR) sources and EDRs.',
      'The sensor compresses what it collects and sends it to the platform Data Processor over an encrypted channel.',
    ],
    value: [
      'A single collection model for on-premises, cloud, and OT, without a different collector for each vendor.',
      'Collecting close to the source reduces bandwidth use and event loss on branch office links.',
    ],
    objectives: ['Log centralization', 'Cloud and SaaS visibility', 'East-west network telemetry', 'Scale to new branches without redesign'],
    techniquesLead: 'Cloud and identity collection is what exposes techniques such as:',
  },
  normalization: {
    how: [
      'Each raw record goes through the parser for its source and becomes Interflow: a single record with the same field names for source and destination address, ports, protocol, application, user, and host, wherever it comes from.',
      'The record keeps a reference to the original data, so nothing from the raw log is lost in the conversion.',
      'Because the fields are common, a rule or query written once applies to all sources, with no per-vendor version.',
    ],
    value: [
      'Analysts no longer need to know the format of each vendor to investigate.',
      'Correlation across sources becomes a join on a field, not manual translation work.',
    ],
    objectives: ['Shorter investigation time', 'Vendor-independent queries and rules', 'A single base for correlation'],
    techniquesLead: 'Normalization is what allows weak signals from different sources to add up, as in:',
  },
  threat_intel: {
    how: [
      'Threat intelligence feeds (commercial, open source, MISP, and STIX/TAXII) provide indicators: IPs, domains, URLs, and file hashes, with type and reputation.',
      'Each record is compared against these indicators at ingestion, and the result is stored in the Interflow record itself, without waiting for a manual search.',
      'Indicators tied to the same campaign bring together events that would look like noise on their own.',
    ],
    value: [
      'Helps detect campaigns: the same domain or infrastructure appearing in different sources becomes a single signal.',
      'The analyst sees the indicator reputation and context in the alert itself, without consulting another tool.',
    ],
    objectives: ['Detection of campaigns and known infrastructure', 'Prioritization by reputation', 'Less manual IoC research'],
    techniquesLead: 'Indicators of malicious infrastructure help catch:',
  },
  enrichment: {
    how: [
      'Before storage, Interflow gains context: geolocation and ASN of IPs, asset name and owner, operating system, and the user behind an IP (resolved from authentication logs and the directory).',
      'The criticality you assign to assets and users feeds the risk calculation for each alert.',
    ],
    value: [
      'The alert already says who, where, and which asset: the analyst does not start the investigation by building context.',
      'An event on a critical server or an administrator account rises in priority on its own.',
    ],
    objectives: ['Prioritization by business risk', 'Attribution to user and asset', 'Shorter triage time'],
    techniquesLead: 'User, asset, and geography context exposes abuses such as:',
  },
  ingestion_filters: {
    how: [
      'Filters applied at collection drop or reduce records before they reach the Data Lake, by source, event type, field, or expression.',
      'Dropping removes the record; reducing keeps only what matters for detection, for example by aggregating repeated events.',
      'Security and authentication events must keep flowing in: filters are for operational noise, such as debug and status messages.',
    ],
    value: [
      'The stored volume, and therefore the license, stays focused on what produces detections.',
      'Less noise in the Data Lake makes searches and hunts faster.',
    ],
    objectives: ['Control of licensed volume', 'Signal-to-noise ratio', 'Predictable storage cost'],
    techniquesLead: 'Poorly designed filters create the blind spots that these techniques exploit, so the rule is to never filter security events:',
  },
  data_lake: {
    how: [
      'Normalized and enriched Interflow is indexed in a single Data Lake, searchable across all sources at once.',
      'Retention is set by policy, to meet the regulatory requirements of each organization.',
      'The same queries serve investigation, threat hunting, and compliance reports.',
    ],
    value: [
      'Retroactive investigations: when a new indicator appears, you can search months back.',
      'A single source of truth for audit and incident response.',
    ],
    objectives: ['Retention for compliance', 'Retroactive threat hunting', 'Forensic investigation'],
    techniquesLead: 'Threats with a long dwell time only show up with enough retention:',
  },
  ndr: {
    how: [
      'The Modular Sensor receives a copy of the traffic (SPAN, TAP, or vTAP) and performs Deep Packet Inspection: it identifies the application regardless of port and extracts session metadata, such as volumes, duration, DNS, HTTP, and TLS.',
      'This metadata becomes Interflow and feeds models that detect scans, anomalous use of administrative protocols, C2 beaconing, DNS tunneling, and exfiltration.',
      'Files that cross the network can be extracted and sent to the Sandbox.',
    ],
    value: [
      'Detects lateral movement (MITRE TA0008), which does not cross the perimeter and often leaves no server log.',
      'Covers what cannot run an agent: OT, IoT, appliances, and unmanaged machines.',
    ],
    objectives: ['East-west visibility', 'Detection of lateral movement and C2', 'Agentless asset coverage'],
    techniquesLead: 'Network traffic is the best evidence for:',
  },
  sandbox: {
    how: [
      'Suspicious files, whether from traffic, from email, or submitted by the analyst, are executed in an isolated environment.',
      'Dynamic analysis records what the file does: processes created, registry and file system changes, network connections, and files it downloads.',
      'The verdict and the extracted indicators return to the platform and are searched for across all sources.',
    ],
    value: [
      'Catches new or obfuscated malware by behavior, not by signature.',
      'Turns a detection into reusable indicators to hunt for the same artifact on other hosts.',
    ],
    objectives: ['Detection of unknown malware', 'Generation of your own IoCs', 'Fast validation of attachments and downloads'],
    techniquesLead: 'Dynamic analysis covers the delivery and execution of:',
  },
  fim: {
    how: [
      'The Server Sensor monitors files, folders, and registry keys defined as critical and records creation, modification, deletion, and permission changes, with hash, user, and responsible process.',
      'The changes become Interflow and can raise an alert when they happen outside the expected process, for example a new file in a web application directory.',
    ],
    value: [
      'Detects tampering with critical systems and persistence that does not appear in application logs.',
      'Meets the PCI DSS integrity monitoring requirement without a separate tool.',
    ],
    objectives: ['Integrity of critical systems', 'PCI DSS compliance', 'Detection of persistence and tampering'],
    techniquesLead: 'A file change is the trace left by these techniques:',
  },
  itdr_ueba: {
    how: [
      'Unsupervised models learn the baseline of each user, host, and process: hours, origins, volumes, applications, and privileges used.',
      'Deviations receive a score that is also compared with the peer group, which separates the unusual from the merely rare.',
      'Identity signals, such as logons, MFA, Kerberos, and privileged group changes, come from the directory and the identity provider.',
    ],
    value: [
      'Detects the attacker who already has a valid credential, when no signature rule fires.',
      'Covers insider threats and service accounts used outside their normal pattern.',
    ],
    objectives: ['Detection of compromised credentials', 'Insider threat', 'Privilege abuse'],
    techniquesLead: 'Identity behavior is what reveals:',
  },
  detection: {
    how: [
      'Three layers run on the same Interflow: rules, supervised machine learning trained on known malicious patterns, and unsupervised machine learning that detects anomalies.',
      'Each alert is mapped to MITRE ATT&CK tactics and techniques and to the XDR Kill Chain, and receives a risk score.',
      'Collection, triage, and correlation, which today consume analyst time, are performed by the platform.',
    ],
    value: [
      'Reduces MTTD: detection happens at ingestion, not when someone goes looking.',
      'Coverage becomes measurable: you can show which ATT&CK techniques are covered and by which sources.',
    ],
    objectives: ['Lower MTTD', 'Measurable MITRE ATT&CK coverage', 'Fewer false positives'],
    techniquesLead: 'Examples of techniques detected by the combined layers:',
  },
  correlation: {
    how: [
      'Graph ML links alerts that share entities, such as user, host, IP, file, or domain, and are close in time, building the incident graph.',
      'The graph becomes a Case, scored by the severity of the alerts and by progress along the kill chain.',
      'New related alerts join the same Case instead of opening another one.',
    ],
    value: [
      'Dozens or hundreds of alerts become a few Cases: the analyst works incidents, not a queue of events.',
      'The Case shows the full story of the attack, from entry to exfiltration.',
    ],
    objectives: ['Reduce alert fatigue', 'Understand scope and impact', 'Prioritize by real risk'],
    techniquesLead: 'A multi-stage attack like this one becomes a single Case:',
  },
  agentic_soc: {
    how: [
      'The AI Investigator answers in natural language about a Case: what happened, which assets were affected, and which evidence supports the conclusion.',
      'Auto Triage assigns a verdict to each Case (True Positive, False Positive, Benign, or Inconclusive), with the rationale. It is a separately licensed add-on.',
      'The analyst confirms or corrects: the final decision remains human.',
    ],
    value: [
      'The analyst starts from a reasoned conclusion, not from a queue.',
      'The same team handles more Cases, with consistent triage quality across shifts.',
    ],
    objectives: ['Shorter triage time', 'Scale the SOC without growing the team', 'Consistent analysis'],
    techniquesLead: 'Examples of Cases that automatic triage speeds up:',
  },
  response: {
    how: [
      'Playbooks trigger actions in the tools you already have, through Connectors: block an IP on the firewall, isolate a host in the EDR, disable an account in the directory, quarantine an email, open a ticket.',
      'Each playbook has conditions (alert type, severity, asset) and can require human approval before acting.',
      'Actions and their results are recorded in the Case as an audit trail.',
    ],
    value: [
      'Containment in seconds for the defined scenarios, including outside business hours.',
      'Reduces MTTR and exposure during an attack in progress.',
    ],
    objectives: ['Lower MTTR', 'Automatic containment', 'Audit trail of the response'],
    techniquesLead: 'Automatic response limits the impact of:',
  },
}
