export interface ReplayChainCommand {
  kind: "replay-chain";
  id: string;
  episodeNodeIds: string[];
  staggerDelayMs: number;
  holdMs: number;
}

export interface RulePromotionCommand {
  kind: "rule-promotion";
  id: string;
  sourceEpisodeNodeIds: string[];
  ruleNodeId: string;
  rulePatternKey: string;
}

export interface SalienceShiftCommand {
  kind: "salience-shift";
  id: string;
  episodeNodeId: string;
  newSalience: number;
}

export interface ContradictionFlashCommand {
  kind: "contradiction-flash";
  id: string;
  leftNodeId: string;
  rightNodeId: string;
}

export type ConsolidationVisualCommand =
  | ReplayChainCommand
  | RulePromotionCommand
  | SalienceShiftCommand
  | ContradictionFlashCommand;

export interface ConsolidationVisualState {
  isConsolidating: boolean;
  activeCommand: ConsolidationVisualCommand | null;
  commandEpoch: number;
}
