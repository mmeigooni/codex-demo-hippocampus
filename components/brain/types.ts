export type BrainNodeType = "episode" | "rule";

export interface BrainNodeModel {
  id: string;
  type: BrainNodeType;
  label: string;
  salience: number;
  triggers: string[];
}

export interface BrainEdgeModel {
  id: string;
  source: string;
  target: string;
  weight: number;
}

export interface PositionedBrainNode extends BrainNodeModel {
  position: [number, number, number];
}
