export type LensCategory =
  | "Triplet family"
  | "Gauss family"
  | "High-speed anastigmat"
  | "Symmetrical wide-angle"
  | "Retrofocus wide-angle"
  | "Portrait classic";

export type LensSurface = "convex-left" | "convex-right" | "biconvex" | "biconcave" | "meniscus";

export interface DiagramElement {
  id: string;
  x: number;
  width: number;
  height: number;
  surface: LensSurface;
  group: number;
  tone?: "clear" | "warm" | "cool";
}

export interface ApertureStop {
  x: number;
  height: number;
}

export interface LensDiagramData {
  elements: DiagramElement[];
  stop?: ApertureStop;
}

export type PlaygroundSurfaceShape = "convex" | "concave" | "flat" | "meniscus";

export interface PlaygroundSurface {
  id: string;
  shape: PlaygroundSurfaceShape;
  powerHint: number;
}

export interface PlaygroundElement {
  id: string;
  label: string;
  groupId: string;
  baseX: number;
  powerContribution: number;
  elementType: "positive" | "negative" | "cemented" | "stop";
  defaultAxialShift: number;
  defaultDecenter: number;
  defaultTilt: number;
  diameter: number;
  surfaces: PlaygroundSurface[];
}

export interface PlaygroundGroup {
  id: string;
  label: string;
  position: number;
  power: number;
  diameter: number;
  elements: PlaygroundElement[];
}

export interface OpticalPlaygroundPreset {
  groupCount: number;
  effectivePowerDistribution: number[];
  stopPosition: number;
  symmetryTendency: "low" | "moderate" | "high";
  backFocusTendency: "short" | "balanced" | "long";
  speedTendency: "slow" | "moderate" | "fast";
  groups: PlaygroundGroup[];
  defaultObjectDistance: number;
  defaultObjectHeight: number;
  defaultSensorPosition: number;
  defaultApertureSize: number;
}

export interface TechnicalSurface {
  id: string;
  label?: string;
  radius: number;
  thicknessToNext: number;
  semiDiameter: number;
  refractiveIndexBefore: number;
  refractiveIndexAfter: number;
  medium?: string;
  glass?: string;
  isStop?: boolean;
}

export interface TechnicalPrescription {
  id: string;
  label: string;
  surfaces: TechnicalSurface[];
  imagePlaneZ: number;
  defaultObjectDistance: number;
  defaultObjectHeight: number;
  defaultFieldHeight: number;
}

export interface LensArchitecture {
  id: string;
  name: string;
  category: LensCategory;
  elements: number;
  groups: number;
  description: string;
  whyMatters: string;
  traits: string[];
  cameraTags: string[];
  typicalUse: string;
  representativeExamples: string[];
  diagram: LensDiagramData;
  playground: OpticalPlaygroundPreset;
  technicalPrescription?: TechnicalPrescription;
}
