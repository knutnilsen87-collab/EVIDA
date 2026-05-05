export interface TimelineItem {
  id: string;
  date: string;
  event: string;
  sourceId: string;
  status: string;
  uncertainty: string;
}

export interface EvidenceRow {
  id: string;
  claim: string;
  supporting: string[];
  weakening: string[];
  strength: string;
  status: string;
}

export interface ArgumentRow {
  id: string;
  argument: string;
  factualBasis: string;
  legalBasis: string;
  evidenceIds: string[];
  status: string;
}

export interface ConflictRow {
  id: string;
  topic: string;
  sourceA: string;
  sourceB: string;
  conflict: string;
  significance: string;
  status: string;
}

export interface RiskRow {
  id: string;
  risk: string;
  severity: string;
  affectedArguments: string;
  sourceBasis: string;
  recommendedAction: string;
}
