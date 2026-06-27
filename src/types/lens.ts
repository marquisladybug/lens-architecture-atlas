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
}
