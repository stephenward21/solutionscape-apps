/**
 * Industry vertical definitions and compliance framework metadata.
 *
 * Each vertical carries:
 *   - Human-readable label + icon
 *   - Sensitive data types specific to the industry
 *   - Default compliance frameworks to pre-select
 *   - A riskContext string injected verbatim into Claude's system prompt so the
 *     model reasons about risk from the right regulatory perspective, citing
 *     specific requirements (HIPAA §164.312, NERC CIP-007, etc.)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type IndustryVertical =
  | "energy_oil_gas"
  | "healthcare"
  | "chemicals_manufacturing"
  | "financial_services"
  | "maritime_logistics"
  | "legal_professional"
  | "government"
  | "aerospace_defense"
  | "construction_engineering"
  | "general";

export type ComplianceFramework =
  | "HIPAA"
  | "HITECH"
  | "FDA_21CFR"
  | "NERC_CIP"
  | "FERC"
  | "OSHA_PSM"
  | "EPA_RMP"
  | "CFATS"
  | "SOX"
  | "PCI_DSS"
  | "GDPR"
  | "CCPA"
  | "NIST_CSF"
  | "ISO_27001"
  | "SOC2"
  | "MTSA"
  | "CTPAT"
  | "ABA_RULES"
  | "FISMA"
  | "CMMC"
  | "GLBA"
  | "ITAR"
  | "EAR"
  | "AS9100"
  | "DFARS"
  | "OSHA_1926"
  | "FAR";

export interface OrgVerticalConfig {
  vertical: IndustryVertical;
  orgName?: string;
  frameworks: ComplianceFramework[];
  customNotes?: string;
}

// ─── Vertical definitions ─────────────────────────────────────────────────────

export interface VerticalDef {
  label: string;
  icon: string;
  description: string;
  sensitiveDataTypes: string[];
  defaultFrameworks: ComplianceFramework[];
  riskContext: string;
}

export const VERTICAL_DEFINITIONS: Record<IndustryVertical, VerticalDef> = {
  energy_oil_gas: {
    label: "Energy / Oil & Gas",
    icon: "⚡",
    description: "Upstream/downstream O&G, pipelines, power generation, utilities",
    sensitiveDataTypes: [
      "OT/SCADA operational data",
      "Exploration and production data",
      "Pipeline operational parameters",
      "Environmental compliance records",
      "Proprietary reservoir and geological data",
    ],
    defaultFrameworks: ["NERC_CIP", "FERC", "OSHA_PSM", "EPA_RMP"],
    riskContext: `This is an energy/oil & gas company. Apply the following vertical-specific risk guidance:

RISK ELEVATION RULES:
- Autonomous Agent tools = CRITICAL automatically. They can interact with operational systems without human review, violating NERC CIP-003-8 requirements for transient cyber assets.
- Any AI tool with email, file storage, or admin OAuth access = HIGH minimum. These scopes risk exposure of proprietary exploration data and could constitute unauthorized access to BES Cyber Systems (NERC CIP-007-6 R1).
- Code generation tools used by engineering = HIGH (risk of proprietary process code exfiltration).
- Meeting intelligence tools (audio/transcript AI) = HIGH. Production meeting recordings may contain SCADA configuration or operational parameters subject to NERC CIP-011.
- Tools lacking a signed data processing agreement or SOC 2 Type II report = HIGH minimum.

REGULATORY CITATIONS TO INCLUDE:
- NERC CIP-003: Cyber Security — Management Controls
- NERC CIP-007-6 R1: Ports and Services; R4: Security Patch Management
- NERC CIP-011: Information Protection
- OSHA PSM (29 CFR 1910.119): Process Safety Information protection
- EPA RMP (40 CFR Part 68): Risk Management Program
- FERC Order 887: Prohibition on unauthorized data access

Include specific standard/regulation citations in the riskFactors array for each tool. Frame recommendations in terms of regulatory compliance requirements, not just generic security best practice.`,
  },

  healthcare: {
    label: "Healthcare / Life Sciences",
    icon: "🏥",
    description: "Hospitals, health systems, physician groups, pharma, medical devices",
    sensitiveDataTypes: [
      "Protected Health Information (PHI/ePHI)",
      "Patient records and clinical data",
      "Prescription and medication data",
      "Medical imaging data",
      "Clinical trial data",
    ],
    defaultFrameworks: ["HIPAA", "HITECH", "FDA_21CFR"],
    riskContext: `This is a healthcare organization. Apply the following vertical-specific risk guidance:

RISK ELEVATION RULES:
- Any AI tool with email or calendar OAuth access = CRITICAL. Email is the most common channel for PHI transmission; email-integrated AI tools can inadvertently process ePHI, triggering HIPAA §164.312(a)(1) Access Control violations.
- Any AI tool with file storage access (Google Drive, OneDrive, SharePoint) = CRITICAL. Clinical documents and patient records stored in these systems constitute ePHI.
- LLM/chat tools = HIGH minimum, even without OAuth scopes. Employees frequently paste patient information into chat interfaces, creating an impermissible ePHI disclosure under HIPAA §164.502.
- Autonomous agent tools = CRITICAL. They can autonomously access and transmit PHI without workforce oversight, violating HIPAA's minimum necessary standard.
- Any AI vendor without a signed Business Associate Agreement (BAA) is automatically non-compliant under HIPAA §164.308(b)(1).
- Meeting intelligence/transcription tools = CRITICAL if used in clinical settings (patient conversations are PHI).
- Tools used in FDA-regulated clinical workflows require 21 CFR Part 11 validation (electronic records/signatures).

REGULATORY CITATIONS TO INCLUDE:
- HIPAA Security Rule §164.308(a)(1): Security Management Process
- HIPAA Security Rule §164.308(b)(1): Business Associate Contracts
- HIPAA Security Rule §164.312(a)(1): Access Control
- HIPAA Privacy Rule §164.502: Uses and Disclosures — Minimum Necessary
- HITECH Act §13401: HIPAA Security Provisions Apply to Business Associates
- FDA 21 CFR Part 11: Electronic Records; Electronic Signatures

Include specific HIPAA section citations in riskFactors. Recommend that each flagged vendor be evaluated for BAA availability. Frame recommendations for a compliance officer or healthcare CISO audience.`,
  },

  chemicals_manufacturing: {
    label: "Chemicals / Manufacturing",
    icon: "⚗️",
    description: "Chemical plants, refineries, industrial manufacturers, specialty chemicals",
    sensitiveDataTypes: [
      "Chemical process formulas and trade secrets",
      "Process Safety Information (PSI)",
      "Hazard analysis data (PHA/HAZOP)",
      "Regulatory compliance documentation",
      "Chemical inventory and handling procedures",
    ],
    defaultFrameworks: ["OSHA_PSM", "EPA_RMP", "CFATS"],
    riskContext: `This is a chemicals or industrial manufacturing company. Apply the following vertical-specific risk guidance:

RISK ELEVATION RULES:
- Autonomous agent tools = CRITICAL. The possibility of AI autonomously accessing or transmitting process safety data or chemical formulas represents an unacceptable risk under OSHA PSM Element 1 (Process Safety Information).
- AI tools with file storage access = CRITICAL. Process Safety Information (PSI), PHA/HAZOP studies, and chemical formulas stored in shared drives constitute Highly Protected Information; their exposure violates OSHA PSM (29 CFR 1910.119(d)) and potentially CFATS Appendix A requirements.
- AI tools used in engineering workflows = HIGH. Proprietary chemical processes are trade secrets; LLM prompts containing formula details may be retained by third-party vendors.
- Email AI tools = HIGH. RMP and PSM compliance documents frequently circulate via email.
- Code generation tools = HIGH if used by process control or DCS/PLC engineers.
- Meeting intelligence tools = HIGH if used in operations/safety reviews (PSI and PHA discussions are sensitive).

REGULATORY CITATIONS TO INCLUDE:
- OSHA PSM (29 CFR 1910.119(d)): Process Safety Information — must be maintained and protected
- OSHA PSM (29 CFR 1910.119(e)): Process Hazard Analysis — unauthorized disclosure concerns
- EPA RMP (40 CFR Part 68.48): Process Safety Information
- CFATS (6 CFR Part 27): Chemical Facility Anti-Terrorism Standards — Tier 1/2 facilities
- TSCA Section 14: CBI (Confidential Business Information) protection for chemical data

Include specific regulation citations in riskFactors. Frame recommendations for a plant safety manager or EHS compliance officer. Prioritize tools that touch process documentation, engineering data, or chemical inventory.`,
  },

  financial_services: {
    label: "Financial Services",
    icon: "🏦",
    description: "Banks, credit unions, insurance, investment firms, fintechs",
    sensitiveDataTypes: [
      "Non-public customer financial data (NPI)",
      "Account and transaction data",
      "Proprietary trading models and algorithms",
      "Material non-public information (MNPI)",
      "Audit and regulatory examination data",
    ],
    defaultFrameworks: ["SOX", "PCI_DSS", "GLBA", "NIST_CSF"],
    riskContext: `This is a financial services organization. Apply the following vertical-specific risk guidance:

RISK ELEVATION RULES:
- Autonomous agent tools = CRITICAL. AI agents with access to financial systems represent both data exfiltration and transaction integrity risks; unauthorized automated actions may violate SOX internal controls (Section 404).
- Email AI tools = HIGH minimum. Financial advisors and bankers routinely share NPI and MNPI via email; email-integrated AI tools risk GLBA violations (16 CFR Part 314 Safeguards Rule).
- LLM/chat tools in trading or M&A contexts = CRITICAL. Users may inadvertently input MNPI, creating potential securities law violations. SEC has signaled scrutiny of AI tool use by registered firms.
- Tools with admin/directory access = CRITICAL (SOX ITGC — IT General Controls require segregation of duties).
- Any tool without SOC 2 Type II report = HIGH (financial regulators expect documented vendor risk management).
- Code generation tools used by quantitative or technology teams = HIGH (proprietary algorithm exfiltration risk).

REGULATORY CITATIONS TO INCLUDE:
- SOX Section 302/404: Internal Controls over Financial Reporting
- GLBA Safeguards Rule (16 CFR Part 314): Customer financial data protection
- PCI DSS v4.0 Requirement 12.8: Third-party service provider management
- SEC Release 2023-209: AI use by registered investment advisors
- FFIEC IT Examination Handbook: Third-Party Risk Management

Include citations in riskFactors. Frame recommendations for a Chief Compliance Officer or bank CISO. Highlight tools that could intersect with regulatory examination or audit data.`,
  },

  maritime_logistics: {
    label: "Maritime / Port Logistics",
    icon: "⚓",
    description: "Port operators, shipping companies, freight logistics, customs brokers",
    sensitiveDataTypes: [
      "Cargo manifest and shipment data",
      "Import/export compliance records",
      "Terminal operating system data",
      "Vessel tracking and security plans",
      "C-TPAT supply chain security data",
    ],
    defaultFrameworks: ["MTSA", "CTPAT", "NIST_CSF"],
    riskContext: `This is a maritime or port logistics company. Apply the following vertical-specific risk guidance:

RISK ELEVATION RULES:
- Autonomous agent tools = CRITICAL. AI agents accessing terminal operating systems or cargo management platforms could trigger Maritime Transportation Security Act (MTSA) violations regarding unauthorized access to facility security systems.
- AI tools with file storage access = HIGH. Cargo manifests, vessel security plans, and port facility security plans are MTSA-sensitive documents.
- Email AI tools = HIGH. Trade compliance and customs documentation (CBP 7501, ISF filings) frequently traverse email; exposure risks AES filing penalties and C-TPAT standing.
- LLM tools = HIGH if used in operations with access to vessel/cargo tracking data.
- Meeting intelligence tools in security or operations meetings = HIGH (MTSA Facility Security Plans are sensitive).

REGULATORY CITATIONS TO INCLUDE:
- MTSA (33 CFR Parts 101–106): Maritime Transportation Security Act requirements
- C-TPAT Minimum Security Criteria: Supply chain partner requirements
- CBP 19 CFR Part 149: Importer Security Filing (ISF) data protection
- USCG Maritime Cyber Risk Management (NVIC 01-20)

Include citations in riskFactors. Frame recommendations for a Port Facility Security Officer (PFSO) or logistics compliance manager.`,
  },

  legal_professional: {
    label: "Legal / Professional Services",
    icon: "⚖️",
    description: "Law firms, consulting, accounting, advisory — client confidentiality-sensitive",
    sensitiveDataTypes: [
      "Privileged attorney-client communications",
      "Client confidential information",
      "Work product and litigation strategy",
      "Non-public deal and transaction data",
      "Audit workpapers and financial data",
    ],
    defaultFrameworks: ["ABA_RULES", "GDPR", "CCPA"],
    riskContext: `This is a legal or professional services firm. Apply the following vertical-specific risk guidance:

RISK ELEVATION RULES:
- Any AI tool with email access = CRITICAL. Attorney-client privileged communications are the most sensitive asset in a law firm; email-integrated AI tools risk privilege waiver and bar discipline (ABA Model Rule 1.6 — Confidentiality).
- AI tools with document/file access = CRITICAL. Client files, deal documents, and litigation strategy materials are confidential; disclosure could constitute malpractice or breach of fiduciary duty.
- LLM/chat tools = HIGH minimum. Lawyers and consultants may input client confidential information into AI prompts; most major AI vendors do not offer BAA equivalents for legal confidentiality.
- Autonomous agent tools = CRITICAL. Competence requirements (ABA Rule 1.1) require attorneys to supervise AI work; autonomous agents acting without review create unauthorized practice concerns.
- AI tools lacking data residency commitments or adequate data processing terms = HIGH (GDPR/CCPA obligations to client data subjects).
- AI legal research tools used without attorney review = HIGH (ABA Rule 5.3 — supervision of non-lawyer assistance).

REGULATORY CITATIONS TO INCLUDE:
- ABA Model Rule 1.1: Competence (duty to understand technology implications)
- ABA Model Rule 1.6(c): Confidentiality — reasonable safeguards for electronic communications
- ABA Model Rule 5.3: Responsibilities Regarding Non-Lawyer Assistance
- ABA Formal Opinion 512 (2023): Generative AI use by lawyers
- GDPR Article 28: Processor obligations for client personal data
- CCPA §1798.100: Consumer rights regarding personal information

Include citations in riskFactors. Frame recommendations for a law firm General Counsel or Chief Risk Officer. Prioritize tools that have access to client communication channels.`,
  },

  government: {
    label: "Government / Public Sector",
    icon: "🏛️",
    description: "Federal, state/local agencies, defense contractors, public institutions",
    sensitiveDataTypes: [
      "Controlled Unclassified Information (CUI)",
      "PII of citizens and government employees",
      "Law enforcement sensitive (LES) data",
      "Government contract and procurement data",
      "Critical infrastructure information",
    ],
    defaultFrameworks: ["NIST_CSF", "FISMA", "CMMC"],
    riskContext: `This is a government agency or public sector organization. Apply the following vertical-specific risk guidance:

RISK ELEVATION RULES:
- Any AI tool without FedRAMP authorization = HIGH minimum for federal agencies. Unauthorized cloud services violate FISMA (44 USC §3554) cloud security policy requirements.
- AI tools accessing CUI (Controlled Unclassified Information) without CMMC Level 2+ compliance = CRITICAL for DoD contractors (32 CFR Part 170).
- Autonomous agent tools = CRITICAL. Government ATO (Authority to Operate) processes require defined and tested system behaviors; autonomous AI agents change system behavior without re-authorization.
- Email AI tools = HIGH. Government email frequently contains CUI, LES data, and pre-decisional information; unauthorized processing violates FISMA and may trigger Privacy Act concerns.
- LLM tools = HIGH minimum. Employees may input sensitive government information into prompts; most commercial AI vendors do not meet FedRAMP requirements.
- Code generation tools used by agency developers = HIGH (risk of CUI or government source code exposure).

REGULATORY CITATIONS TO INCLUDE:
- FISMA (44 USC §3554): Federal Information Security Modernization Act
- NIST SP 800-53 Rev 5: Security and Privacy Controls (AC-2, AC-17, SA-9)
- CMMC Level 2 (32 CFR Part 170): Cybersecurity Maturity Model Certification
- OMB M-24-10: Advancing Governance, Innovation, and Risk Management for Federal AI
- EO 13556: Controlled Unclassified Information Program
- Privacy Act of 1974 (5 USC §552a): PII protection requirements

Include citations in riskFactors. Frame recommendations for an Agency CISO or Contracting Officer. Emphasize ATO implications and FedRAMP authorization status of flagged tools.`,
  },

  aerospace_defense: {
    label: "Aerospace & Defense",
    icon: "🚀",
    description: "Defense contractors, aerospace manufacturers, SpaceX suppliers, satellite systems",
    sensitiveDataTypes: [
      "ITAR-controlled technical data (USML categories)",
      "EAR-controlled technology and source code",
      "Controlled Unclassified Information (CUI)",
      "Proprietary design, CAD, and simulation data",
      "Defense contract deliverables (CDRLs)",
    ],
    defaultFrameworks: ["ITAR", "EAR", "CMMC", "DFARS", "AS9100"],
    riskContext: `This is an aerospace and defense company (or supplier/subcontractor). Apply the following vertical-specific risk guidance — this is the highest-stakes AI governance context that exists:

RISK ELEVATION RULES:
- ITAR is the primary framework. Under 22 CFR §120.17, disclosing controlled technical data to a foreign person — including a foreign national employee of an AI vendor's cloud infrastructure team — constitutes an "export" even if that person is physically located in the United States. This is a federal criminal offense carrying penalties up to $1M per violation and 20 years imprisonment. No BAA or DPA cures this after the fact.
- Any AI tool with file storage (Drive, SharePoint, OneDrive) access = CRITICAL. Engineering drawings, CAD/CAM files, test data, and specifications for USML items stored in consumer cloud = active ITAR violation risk.
- Any LLM/chat tool used by engineering or program teams = CRITICAL. Employees pasting design parameters, materials specifications, performance data, or manufacturing processes into an AI prompt constitutes a potential export of controlled technical data under 22 CFR §121.1 (USML) or 15 CFR §734.13 (EAR).
- Autonomous agent tools = CRITICAL. They autonomously access, read, and potentially exfiltrate export-controlled technical data across system boundaries with no human checkpoint — violating DFARS 252.204-7012 safeguarding requirements and CMMC Level 2 AC.3.018.
- Code generation tools = CRITICAL if used on export-controlled software, encryption implementations, or defense article simulations. Software with cryptographic functionality may be EAR-controlled (ECCN 5D002/5E002) and cannot be transmitted to foreign persons.
- Email AI tools = HIGH. Program communication, contract deliverables, and CDRL items traverse email; ITAR-controlled data in email integrated with a commercial AI tool = unlicensed export risk.
- Meeting intelligence / transcription tools = HIGH. Technical Interchange Meetings (TIMs), design reviews, and CDR/PDR briefings discuss ITAR-controlled technical data; AI transcription services with foreign-national data access = export risk.
- Tools without FedRAMP authorization, ITAR-compliant data residency, or explicit US-person-only data handling commitments = HIGH minimum even if scopes appear benign.

REGULATORY CITATIONS TO INCLUDE:
- ITAR 22 CFR §120.17: Definition of "export" — includes disclosure to foreign persons in the US
- ITAR 22 CFR §121.1: US Munitions List (USML) — controlled defense articles and technical data
- ITAR 22 CFR §127.1: Criminal penalties — up to $1M/violation, 20 years imprisonment
- EAR 15 CFR §734.13: Technology and source code subject to EAR
- EAR 15 CFR §742.6/742.7: Commerce Control List (CCL) munitions and regional stability controls
- DFARS 252.204-7012: Safeguarding Covered Defense Information and Cyber Incident Reporting
- CMMC Level 2 (32 CFR Part 170): Required for CUI handling — 110 NIST SP 800-171 controls
- NIST SP 800-171 §3.1.3: Control CUI flow — prohibits routing through unauthorized systems
- AS9100 Rev D §8.4: Control of externally provided processes — supply chain data security

Frame all findings for a VP of Contracts, Export Compliance Officer, or Program Security Officer (PSO). Treat the presence of any AI tool that could touch ITAR or EAR data as a potential federal criminal exposure, not a best-practice gap. Every CRITICAL finding should note that voluntary disclosure to the DDTC/BIS is the standard remediation path post-violation.`,
  },

  construction_engineering: {
    label: "Construction & Engineering",
    icon: "🏗️",
    description: "EPC firms, general contractors, civil/structural engineers, data center builders",
    sensitiveDataTypes: [
      "BIM models and engineering drawings",
      "Proprietary cost estimates and bid data",
      "Government contract deliverables (federal projects)",
      "Subcontractor and supplier pricing data",
      "Site security and access plans",
    ],
    defaultFrameworks: ["FAR", "OSHA_1926", "NIST_CSF"],
    riskContext: `This is a construction and engineering company (EPC contractor, general contractor, civil/structural engineering firm, or specialty subcontractor). Apply the following vertical-specific risk guidance:

RISK ELEVATION RULES:
- AI tools with file storage access on government-funded projects = HIGH. BIM models, engineering drawings, cost estimates, and contract deliverables for federal projects may constitute "covered contractor information" under FAR 52.204-21, requiring adequate safeguarding on all contractor systems.
- For data center, defense facility, or critical infrastructure projects: AI tools with file access = CRITICAL. Physical security plans, site layouts, infrastructure topology, and access control designs for these facilities are sensitive; exposure risks both competitive harm and national security implications under DFARS 252.204-7012 for DoD projects.
- LLM/chat tools = MEDIUM minimum. Estimators, project engineers, and PMs routinely input sensitive project financials, subcontractor pricing, owner's requirements, and proprietary bid strategies into AI tools, creating competitive liability and potential breach of NDA.
- Autonomous agent tools = HIGH. For projects involving data centers, power infrastructure, or occupied facilities, autonomous AI with broad system access creates safety risk and potential OSHA 29 CFR Part 1926 liability.
- Email AI tools = MEDIUM. RFI responses, submittals, RFQ packages, and change order negotiations traverse email; AI integration with email risks exposure of time-sensitive bid data to third parties.
- Meeting intelligence tools = MEDIUM. OAC (Owner-Architect-Contractor) meetings, subcontractor bids, and claim negotiations contain commercially sensitive data and privileged communications.
- Code generation / automation tools used by IT = HIGH if used to build or maintain systems that touch federal contract data, safety systems, or access control.

REGULATORY CITATIONS TO INCLUDE:
- FAR 52.204-21: Basic Safeguarding of Covered Contractor Information Systems (applies to all federal contracts regardless of value)
- FAR 52.239-1: Privacy or Security Safeguards (IT systems on federal contracts)
- DFARS 252.204-7012: Safeguarding Covered Defense Information (DoD projects)
- OSHA 29 CFR Part 1926: Construction industry safety standards — AI tools used in safety-critical workflows must maintain human oversight
- OSHA 29 CFR §1926.16: Contractor obligations — owner cannot delegate safety responsibility to AI
- Davis-Bacon Act (40 USC §3141): Federal construction wage compliance — payroll data processed by AI tools
- NIST SP 800-171 §3.1.1: For contractors handling CUI on government construction projects

Frame recommendations for a VP of Operations, Contracts Manager, or Project Executive. Prioritize risks tied to competitive intelligence exposure (bid data, estimates), government contract compliance obligations, and safety-critical workflows where AI-generated errors carry physical safety consequences.`,
  },

  general: {
    label: "General / Cross-Industry",
    icon: "🏢",
    description: "Not industry-specific, or spanning multiple sectors",
    sensitiveDataTypes: [
      "Employee PII",
      "Customer data",
      "Intellectual property",
      "Financial records",
      "Internal communications",
    ],
    defaultFrameworks: ["SOC2", "NIST_CSF", "GDPR"],
    riskContext: `Apply general AI governance best practices. Focus on: data sensitivity by OAuth scope, vendor accountability (SOC 2 Type II compliance, DPA availability), appropriate use policies, and shadow IT risk. Recommend the organization establish a formal AI acceptable use policy as a priority.`,
  },
};

// ─── Framework definitions ────────────────────────────────────────────────────

export interface FrameworkDef {
  label: string;
  icon: string;
  description: string;
  verticals: IndustryVertical[];
}

export const FRAMEWORK_DEFINITIONS: Record<ComplianceFramework, FrameworkDef> = {
  HIPAA:     { label: "HIPAA",           icon: "🏥", description: "Health Insurance Portability & Accountability Act — PHI/ePHI protection",           verticals: ["healthcare"] },
  HITECH:    { label: "HITECH",          icon: "🔒", description: "Health IT for Economic and Clinical Health Act — extends HIPAA to business associates", verticals: ["healthcare"] },
  FDA_21CFR: { label: "FDA 21 CFR Pt 11",icon: "💊", description: "Electronic records and signatures in FDA-regulated clinical environments",             verticals: ["healthcare"] },
  NERC_CIP:  { label: "NERC CIP",        icon: "⚡", description: "Critical Infrastructure Protection standards for the bulk electric system",           verticals: ["energy_oil_gas"] },
  FERC:      { label: "FERC",            icon: "⚡", description: "Federal Energy Regulatory Commission — energy market and grid data rules",            verticals: ["energy_oil_gas"] },
  OSHA_PSM:  { label: "OSHA PSM",        icon: "⚗️", description: "Process Safety Management standard (29 CFR 1910.119)",                              verticals: ["chemicals_manufacturing", "energy_oil_gas"] },
  EPA_RMP:   { label: "EPA RMP",         icon: "🌿", description: "Risk Management Program (40 CFR Part 68) — chemical release prevention",             verticals: ["chemicals_manufacturing", "energy_oil_gas"] },
  CFATS:     { label: "CFATS",           icon: "🏭", description: "Chemical Facility Anti-Terrorism Standards (6 CFR Part 27)",                         verticals: ["chemicals_manufacturing"] },
  SOX:       { label: "SOX",             icon: "📊", description: "Sarbanes-Oxley Act — financial reporting internal controls",                         verticals: ["financial_services"] },
  PCI_DSS:   { label: "PCI DSS",         icon: "💳", description: "Payment Card Industry Data Security Standard v4.0",                                  verticals: ["financial_services"] },
  GLBA:      { label: "GLBA",            icon: "🏦", description: "Gramm-Leach-Bliley Act Safeguards Rule — non-public customer financial data",        verticals: ["financial_services"] },
  GDPR:      { label: "GDPR",            icon: "🇪🇺", description: "General Data Protection Regulation — EU data privacy and processing",               verticals: ["general", "legal_professional", "healthcare", "financial_services"] },
  CCPA:      { label: "CCPA",            icon: "🌴", description: "California Consumer Privacy Act — consumer data rights",                             verticals: ["general", "legal_professional"] },
  NIST_CSF:  { label: "NIST CSF",        icon: "🔐", description: "NIST Cybersecurity Framework v2.0 — identify, protect, detect, respond, recover",   verticals: ["general", "government", "energy_oil_gas"] },
  ISO_27001: { label: "ISO 27001",       icon: "🔏", description: "Information Security Management Systems — international standard",                   verticals: ["general"] },
  SOC2:      { label: "SOC 2",           icon: "☁️", description: "Service Organization Control 2 — trust service criteria for cloud vendors",          verticals: ["general", "financial_services"] },
  MTSA:      { label: "MTSA",            icon: "⚓", description: "Maritime Transportation Security Act (33 CFR Parts 101–106)",                         verticals: ["maritime_logistics"] },
  CTPAT:     { label: "C-TPAT",          icon: "🚢", description: "Customs-Trade Partnership Against Terrorism — supply chain security",                 verticals: ["maritime_logistics"] },
  ABA_RULES: { label: "ABA Model Rules", icon: "⚖️", description: "American Bar Association Rules of Professional Conduct — attorney ethics",           verticals: ["legal_professional"] },
  FISMA:     { label: "FISMA",           icon: "🏛️", description: "Federal Information Security Modernization Act (44 USC §3554)",                             verticals: ["government"] },
  CMMC:      { label: "CMMC",            icon: "🛡️", description: "Cybersecurity Maturity Model Certification — DoD contractor requirements",                   verticals: ["government", "aerospace_defense"] },
  ITAR:      { label: "ITAR",            icon: "🚀", description: "International Traffic in Arms Regulations (22 CFR Parts 120–130) — USML export controls",    verticals: ["aerospace_defense"] },
  EAR:       { label: "EAR",             icon: "📦", description: "Export Administration Regulations (15 CFR Parts 730–774) — dual-use technology controls",    verticals: ["aerospace_defense"] },
  AS9100:    { label: "AS9100 Rev D",    icon: "✈️", description: "Aerospace quality management system standard — supply chain and process controls",           verticals: ["aerospace_defense"] },
  DFARS:     { label: "DFARS",           icon: "🔒", description: "Defense Federal Acquisition Regulation Supplement — safeguarding covered defense information", verticals: ["aerospace_defense", "construction_engineering"] },
  OSHA_1926: { label: "OSHA 1926",       icon: "🏗️", description: "OSHA Construction Standards (29 CFR Part 1926) — worker safety in construction environments", verticals: ["construction_engineering"] },
  FAR:       { label: "FAR",             icon: "📋", description: "Federal Acquisition Regulation — information safeguarding on all federal contracts",           verticals: ["construction_engineering", "government"] },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the frameworks most relevant for a given vertical (subset + universal ones). */
export function frameworksForVertical(vertical: IndustryVertical): ComplianceFramework[] {
  return (Object.entries(FRAMEWORK_DEFINITIONS) as [ComplianceFramework, FrameworkDef][])
    .filter(([, def]) => def.verticals.includes(vertical) || def.verticals.includes("general"))
    .map(([id]) => id);
}

/** Builds the vertical-specific context block to inject into the Claude prompt. */
export function buildVerticalPromptContext(config: OrgVerticalConfig): string {
  const vDef = VERTICAL_DEFINITIONS[config.vertical];
  const frameworkLines = config.frameworks
    .map((f) => {
      const def = FRAMEWORK_DEFINITIONS[f];
      return def ? `- ${def.label}: ${def.description}` : `- ${f}`;
    })
    .join("\n");

  return `
ORGANIZATION PROFILE:
- Organization: ${config.orgName ?? "Not specified"}
- Industry Vertical: ${vDef.label}
- Active Compliance Frameworks:
${frameworkLines || "  (none specified — apply general best practices)"}
- Sensitive Data Categories for this Vertical:
${vDef.sensitiveDataTypes.map((d) => `  · ${d}`).join("\n")}
${config.customNotes ? `- Additional Compliance Notes from Organization:\n  ${config.customNotes}` : ""}

VERTICAL-SPECIFIC RISK GUIDANCE (apply to all tool assessments below):
${vDef.riskContext}
`.trim();
}
