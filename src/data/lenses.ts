import type {
  LensArchitecture,
  OpticalPlaygroundPreset,
  PlaygroundElement,
  PlaygroundGroup,
  PlaygroundSurfaceShape,
  TechnicalPrescription,
  TechnicalSurface,
} from "../types/lens";

type ElementType = PlaygroundElement["elementType"];

function elementSurfaceShape(type: ElementType, power: number): PlaygroundSurfaceShape {
  if (type === "stop") {
    return "flat";
  }

  if (type === "cemented") {
    return "meniscus";
  }

  return power >= 0 ? "convex" : "concave";
}

function group(
  id: string,
  label: string,
  position: number,
  power: number,
  diameter: number,
  elementTypes: ElementType[] = [power >= 0 ? "positive" : "negative"],
): PlaygroundGroup {
  const elementCount = elementTypes.length;
  const spacing = Math.min(7, Math.max(3, diameter / 8));
  const start = -((elementCount - 1) * spacing) / 2;

  return {
    id,
    label,
    position,
    power,
    diameter,
    elements: elementTypes.map((type, index) => {
      const powerContribution = power / elementCount;
      const elementId = `${id}-e${index + 1}`;

      return {
        id: elementId,
        label: `${label} ${index + 1}`,
        groupId: id,
        baseX: start + index * spacing,
        powerContribution,
        elementType: type,
        defaultAxialShift: 0,
        defaultDecenter: 0,
        defaultTilt: 0,
        diameter: Math.max(24, diameter - index * 2),
        surfaces: [
          { id: `${elementId}-front`, shape: elementSurfaceShape(type, powerContribution), powerHint: powerContribution / 2 },
          { id: `${elementId}-rear`, shape: elementSurfaceShape(type, powerContribution), powerHint: powerContribution / 2 },
        ],
      };
    }),
  };
}

function playgroundPreset(
  groups: PlaygroundGroup[],
  options: Pick<
    OpticalPlaygroundPreset,
    "stopPosition" | "symmetryTendency" | "backFocusTendency" | "speedTendency"
  > &
    Partial<
      Pick<
        OpticalPlaygroundPreset,
        "defaultObjectDistance" | "defaultObjectHeight" | "defaultSensorPosition" | "defaultApertureSize"
      >
    >,
): OpticalPlaygroundPreset {
  return {
    groupCount: groups.length,
    effectivePowerDistribution: groups.map((item) => item.power),
    groups,
    defaultObjectDistance: options.defaultObjectDistance ?? 120,
    defaultObjectHeight: options.defaultObjectHeight ?? 18,
    defaultSensorPosition: options.defaultSensorPosition ?? 86,
    defaultApertureSize: options.defaultApertureSize ?? 22,
    stopPosition: options.stopPosition,
    symmetryTendency: options.symmetryTendency,
    backFocusTendency: options.backFocusTendency,
    speedTendency: options.speedTendency,
  };
}

function surface(
  id: string,
  radius: number,
  thicknessToNext: number,
  semiDiameter: number,
  refractiveIndexBefore: number,
  refractiveIndexAfter: number,
  options: Pick<TechnicalSurface, "label" | "glass" | "medium" | "isStop"> = {},
): TechnicalSurface {
  return {
    id,
    radius,
    thicknessToNext,
    semiDiameter,
    refractiveIndexBefore,
    refractiveIndexAfter,
    ...options,
  };
}

function technicalPrescription(
  id: string,
  label: string,
  imagePlaneZ: number,
  surfaces: TechnicalSurface[],
): TechnicalPrescription {
  return {
    id,
    label,
    surfaces,
    imagePlaneZ,
    defaultObjectDistance: 80,
    defaultObjectHeight: 12,
    defaultFieldHeight: 8,
  };
}

export const lenses: LensArchitecture[] = [
  {
    id: "cooke-triplet",
    name: "Cooke Triplet",
    category: "Triplet family",
    elements: 3,
    groups: 3,
    description: "A foundational three-element anastigmat that balances simplicity, compactness, and correction.",
    whyMatters: "The triplet shows how much character and usable sharpness can come from very few elements, which is why many small cameras and vintage lenses still feel so direct.",
    traits: ["simple construction", "classic rendering", "moderate speed", "good central sharpness stopped down"],
    cameraTags: ["compact", "low air-glass surfaces", "long back focus"],
    typicalUse: "Compact cameras, enlarging lenses, and historical general-purpose photography.",
    representativeExamples: ["Taylor-Hobson Cooke Triplet", "Meyer Trioplan", "Voigtlander Vaskar"],
    diagram: {
      stop: { x: 48, height: 64 },
      elements: [
        { id: "ct-1", x: 20, width: 12, height: 82, surface: "biconvex", group: 1, tone: "warm" },
        { id: "ct-2", x: 43, width: 10, height: 66, surface: "biconcave", group: 2, tone: "clear" },
        { id: "ct-3", x: 68, width: 12, height: 78, surface: "biconvex", group: 3, tone: "warm" },
      ],
    },
    playground: playgroundPreset(
      [group("ct-g1", "positive front", -18, 0.012, 42), group("ct-g2", "negative middle", 0, -0.008, 34), group("ct-g3", "positive rear", 24, 0.013, 40)],
      { stopPosition: 4, symmetryTendency: "moderate", backFocusTendency: "long", speedTendency: "slow", defaultSensorPosition: 96, defaultApertureSize: 16 },
    ),
    technicalPrescription: technicalPrescription("cooke-triplet-tech", "Cooke Triplet approximate paraxial prescription", 78, [
      surface("ct-s1", 34, 5, 18, 1, 1.52, { label: "front crown", glass: "crown" }),
      surface("ct-s2", -42, 8, 17, 1.52, 1),
      surface("ct-stop", Infinity, 4, 8.5, 1, 1, { label: "stop", isStop: true }),
      surface("ct-s3", -24, 3, 13, 1, 1.62, { label: "negative flint", glass: "flint" }),
      surface("ct-s4", 28, 10, 13, 1.62, 1),
      surface("ct-s5", 42, 4, 17, 1, 1.52, { label: "rear crown", glass: "crown" }),
      surface("ct-s6", -36, 38, 17, 1.52, 1),
    ]),
  },
  {
    id: "tessar",
    name: "Tessar",
    category: "Triplet family",
    elements: 4,
    groups: 3,
    description: "A compact four-element derivative of the triplet, famous for practical sharpness and small size.",
    whyMatters: "The Tessar became a benchmark for pocketable, reliable image quality, making it a useful reference point for judging compact standard lenses.",
    traits: ["compact", "high contrast", "efficient correction", "often crisp when stopped down"],
    cameraTags: ["compact", "low air-glass surfaces", "long back focus"],
    typicalUse: "Everyday standard lenses, folding cameras, and compact fixed-lens cameras.",
    representativeExamples: ["Zeiss Tessar 50mm f/2.8", "Leitz Elmar 50mm f/3.5", "Nikon 45mm f/2.8P"],
    diagram: {
      stop: { x: 44, height: 62 },
      elements: [
        { id: "te-1", x: 18, width: 12, height: 80, surface: "biconvex", group: 1, tone: "warm" },
        { id: "te-2", x: 39, width: 10, height: 66, surface: "biconcave", group: 2, tone: "clear" },
        { id: "te-3", x: 64, width: 10, height: 75, surface: "convex-left", group: 3, tone: "cool" },
        { id: "te-4", x: 73, width: 10, height: 75, surface: "convex-right", group: 3, tone: "warm" },
      ],
    },
    playground: playgroundPreset(
      [group("te-g1", "front positive", -20, 0.013, 42), group("te-g2", "middle negative", -2, -0.006, 34), group("te-g3", "cemented rear", 28, 0.014, 38, ["cemented", "positive"])],
      { stopPosition: -4, symmetryTendency: "moderate", backFocusTendency: "long", speedTendency: "moderate", defaultSensorPosition: 92, defaultApertureSize: 18 },
    ),
    technicalPrescription: technicalPrescription("tessar-tech", "Tessar approximate paraxial prescription", 76, [
      surface("te-s1", 30, 5, 18, 1, 1.52, { label: "front positive", glass: "crown" }),
      surface("te-s2", -52, 7, 17, 1.52, 1),
      surface("te-stop", Infinity, 4, 8, 1, 1, { label: "stop", isStop: true }),
      surface("te-s3", -26, 3, 13, 1, 1.62, { label: "negative", glass: "flint" }),
      surface("te-s4", 32, 9, 13, 1.62, 1),
      surface("te-s5", 46, 4, 16, 1, 1.60, { label: "cemented rear", glass: "dense crown" }),
      surface("te-s6", -24, 2, 15, 1.60, 1.68, { label: "cemented interface", glass: "flint" }),
      surface("te-s7", -62, 34, 16, 1.68, 1),
    ]),
  },
  {
    id: "planar-double-gauss",
    name: "Planar / Double Gauss",
    category: "Gauss family",
    elements: 6,
    groups: 4,
    description: "A near-symmetrical normal-lens archetype known for balanced correction and broad influence.",
    whyMatters: "Double Gauss designs shaped the fast normal lens: small enough for everyday cameras, bright enough for low light, and balanced enough to become a system-lens staple.",
    traits: ["balanced aberration control", "normal focal lengths", "good speed potential", "smooth transition zones"],
    cameraTags: ["fast normal", "symmetric", "SLR friendly", "rangefinder friendly"],
    typicalUse: "Standard lenses for rangefinder and SLR systems.",
    representativeExamples: ["Zeiss Planar 50mm f/1.4", "Canon FD 50mm f/1.4", "Nikon Nikkor 50mm f/1.4"],
    diagram: {
      stop: { x: 50, height: 70 },
      elements: [
        { id: "pl-1", x: 15, width: 10, height: 78, surface: "convex-left", group: 1, tone: "warm" },
        { id: "pl-2", x: 26, width: 11, height: 78, surface: "convex-right", group: 1, tone: "cool" },
        { id: "pl-3", x: 39, width: 10, height: 64, surface: "biconcave", group: 2, tone: "clear" },
        { id: "pl-4", x: 61, width: 10, height: 64, surface: "biconcave", group: 3, tone: "clear" },
        { id: "pl-5", x: 73, width: 11, height: 78, surface: "convex-left", group: 4, tone: "cool" },
        { id: "pl-6", x: 84, width: 10, height: 78, surface: "convex-right", group: 4, tone: "warm" },
      ],
    },
    playground: playgroundPreset(
      [group("pl-g1", "front doublet", -28, 0.011, 46, ["positive", "cemented"]), group("pl-g2", "front negative", -8, -0.007, 34), group("pl-g3", "rear negative", 8, -0.007, 34), group("pl-g4", "rear doublet", 28, 0.011, 46, ["cemented", "positive"])],
      { stopPosition: 0, symmetryTendency: "high", backFocusTendency: "balanced", speedTendency: "fast", defaultSensorPosition: 82, defaultApertureSize: 28 },
    ),
    technicalPrescription: technicalPrescription("planar-tech", "Double Gauss approximate paraxial prescription", 72, [
      surface("pl-s1", 38, 4, 21, 1, 1.62, { label: "front positive", glass: "dense crown" }),
      surface("pl-s2", -30, 2, 20, 1.62, 1.70, { label: "cemented interface", glass: "flint" }),
      surface("pl-s3", -72, 7, 19, 1.70, 1),
      surface("pl-s4", -28, 3, 15, 1, 1.68, { label: "front negative", glass: "flint" }),
      surface("pl-s5", 36, 5, 14, 1.68, 1),
      surface("pl-stop", Infinity, 4, 11, 1, 1, { label: "stop", isStop: true }),
      surface("pl-s6", -36, 3, 14, 1, 1.68, { label: "rear negative", glass: "flint" }),
      surface("pl-s7", 28, 7, 15, 1.68, 1),
      surface("pl-s8", 72, 2, 19, 1, 1.70, { label: "rear doublet", glass: "flint" }),
      surface("pl-s9", 30, 4, 20, 1.70, 1.62, { label: "cemented interface", glass: "dense crown" }),
      surface("pl-s10", -38, 28, 21, 1.62, 1),
    ]),
  },
  {
    id: "biotar",
    name: "Biotar",
    category: "Gauss family",
    elements: 6,
    groups: 4,
    description: "A faster Double Gauss variant associated with energetic rendering and strong subject separation.",
    whyMatters: "Biotar-type lenses are a reminder that optical design is not only correction; their speed and off-axis behavior are a big part of classic portrait taste.",
    traits: ["fast aperture", "swirly off-axis character in some examples", "classic portrait look", "Gauss-derived"],
    cameraTags: ["fast normal", "symmetric", "SLR friendly"],
    typicalUse: "Fast normal lenses and portrait-oriented adaptations.",
    representativeExamples: ["Zeiss Biotar 58mm f/2", "Helios-44 58mm f/2", "Zeiss Biotar 75mm f/1.5"],
    diagram: {
      stop: { x: 51, height: 76 },
      elements: [
        { id: "bt-1", x: 12, width: 12, height: 84, surface: "convex-left", group: 1, tone: "warm" },
        { id: "bt-2", x: 25, width: 12, height: 82, surface: "convex-right", group: 1, tone: "cool" },
        { id: "bt-3", x: 40, width: 11, height: 67, surface: "biconcave", group: 2, tone: "clear" },
        { id: "bt-4", x: 62, width: 11, height: 67, surface: "biconcave", group: 3, tone: "clear" },
        { id: "bt-5", x: 76, width: 12, height: 82, surface: "convex-left", group: 4, tone: "cool" },
        { id: "bt-6", x: 88, width: 12, height: 84, surface: "convex-right", group: 4, tone: "warm" },
      ],
    },
    playground: playgroundPreset(
      [group("bt-g1", "strong front", -30, 0.013, 50, ["positive", "cemented"]), group("bt-g2", "front negative", -8, -0.008, 36), group("bt-g3", "rear negative", 9, -0.007, 36), group("bt-g4", "strong rear", 30, 0.012, 48, ["cemented", "positive"])],
      { stopPosition: 1, symmetryTendency: "high", backFocusTendency: "balanced", speedTendency: "fast", defaultSensorPosition: 80, defaultApertureSize: 30 },
    ),
  },
  {
    id: "sonnar",
    name: "Sonnar",
    category: "High-speed anastigmat",
    elements: 7,
    groups: 3,
    description: "A compact high-speed family using cemented groups to reduce air-glass surfaces.",
    whyMatters: "The Sonnar matters because it delivered speed and contrast before modern coatings made many air-glass surfaces easy to manage.",
    traits: ["compact for speed", "high contrast", "fewer air-glass surfaces", "distinctive classic rendering"],
    cameraTags: ["compact", "fast normal", "rangefinder friendly", "low air-glass surfaces", "short back focus"],
    typicalUse: "Fast normal and short telephoto lenses, especially rangefinder-era designs.",
    representativeExamples: ["Zeiss Sonnar 50mm f/1.5", "Zeiss Sonnar 85mm f/2", "Nikon S.C 50mm f/1.4"],
    diagram: {
      stop: { x: 42, height: 72 },
      elements: [
        { id: "so-1", x: 14, width: 12, height: 84, surface: "biconvex", group: 1, tone: "warm" },
        { id: "so-2", x: 31, width: 9, height: 73, surface: "convex-left", group: 2, tone: "cool" },
        { id: "so-3", x: 39, width: 9, height: 70, surface: "biconcave", group: 2, tone: "clear" },
        { id: "so-4", x: 47, width: 9, height: 73, surface: "convex-right", group: 2, tone: "warm" },
        { id: "so-5", x: 66, width: 9, height: 80, surface: "convex-left", group: 3, tone: "cool" },
        { id: "so-6", x: 74, width: 9, height: 78, surface: "biconcave", group: 3, tone: "clear" },
        { id: "so-7", x: 82, width: 10, height: 81, surface: "convex-right", group: 3, tone: "warm" },
      ],
    },
    playground: playgroundPreset(
      [group("so-g1", "front positive", -24, 0.015, 46), group("so-g2", "thick middle", 0, 0.006, 40, ["positive", "cemented", "negative"]), group("so-g3", "cemented rear", 24, 0.009, 38, ["cemented", "negative", "positive"])],
      { stopPosition: -6, symmetryTendency: "low", backFocusTendency: "short", speedTendency: "fast", defaultSensorPosition: 72, defaultApertureSize: 30 },
    ),
    technicalPrescription: technicalPrescription("sonnar-tech", "Sonnar approximate paraxial prescription", 62, [
      surface("so-s1", 32, 5, 22, 1, 1.62, { label: "large front", glass: "dense crown" }),
      surface("so-s2", -58, 4, 21, 1.62, 1),
      surface("so-stop", Infinity, 4, 12, 1, 1, { label: "stop", isStop: true }),
      surface("so-s3", 42, 3, 18, 1, 1.60, { label: "middle cemented", glass: "crown" }),
      surface("so-s4", -24, 2, 17, 1.60, 1.72, { label: "cemented interface", glass: "flint" }),
      surface("so-s5", 30, 8, 17, 1.72, 1.62, { label: "cemented interface", glass: "dense crown" }),
      surface("so-s6", -48, 8, 18, 1.62, 1),
      surface("so-s7", 46, 3, 17, 1, 1.64, { label: "rear cemented", glass: "dense crown" }),
      surface("so-s8", -30, 2, 16, 1.64, 1.72, { label: "cemented interface", glass: "flint" }),
      surface("so-s9", -82, 22, 16, 1.72, 1),
    ]),
  },
  {
    id: "ernostar",
    name: "Ernostar",
    category: "High-speed anastigmat",
    elements: 6,
    groups: 4,
    description: "A historically important high-speed design that influenced later Sonnar-type thinking.",
    whyMatters: "Ernostar designs pushed available-light photography forward, showing photographers that fast lenses could change what was practical to shoot.",
    traits: ["very fast for its era", "large front group", "compact rear grouping", "early available-light emphasis"],
    cameraTags: ["fast normal", "compact", "low air-glass surfaces"],
    typicalUse: "Early fast still-camera lenses and available-light photography.",
    representativeExamples: ["Ernemann Ernostar 100mm f/2", "Zeiss Ernostar-derived designs", "Early fast press-camera lenses"],
    diagram: {
      stop: { x: 57, height: 68 },
      elements: [
        { id: "er-1", x: 12, width: 14, height: 88, surface: "biconvex", group: 1, tone: "warm" },
        { id: "er-2", x: 28, width: 11, height: 78, surface: "convex-left", group: 2, tone: "cool" },
        { id: "er-3", x: 38, width: 10, height: 70, surface: "biconcave", group: 2, tone: "clear" },
        { id: "er-4", x: 67, width: 10, height: 76, surface: "convex-left", group: 3, tone: "warm" },
        { id: "er-5", x: 78, width: 9, height: 70, surface: "meniscus", group: 4, tone: "clear" },
        { id: "er-6", x: 87, width: 10, height: 76, surface: "convex-right", group: 4, tone: "cool" },
      ],
    },
    playground: playgroundPreset(
      [group("er-g1", "large front", -30, 0.017, 54, ["positive", "cemented"]), group("er-g2", "corrector", -10, -0.005, 38), group("er-g3", "rear positive", 18, 0.009, 38), group("er-g4", "rear corrector", 32, 0.004, 34, ["cemented", "positive"])],
      { stopPosition: 12, symmetryTendency: "low", backFocusTendency: "balanced", speedTendency: "fast", defaultSensorPosition: 76, defaultApertureSize: 32 },
    ),
  },
  {
    id: "biogon",
    name: "Biogon",
    category: "Symmetrical wide-angle",
    elements: 8,
    groups: 5,
    description: "A wide-angle archetype with strong symmetry, short back focus, and excellent correction potential.",
    whyMatters: "Biogon-style wide angles are prized because they can keep distortion low and packages compact, especially when a mirror box does not need clearance.",
    traits: ["wide-angle coverage", "low distortion tendency", "short back focus", "rangefinder-friendly heritage"],
    cameraTags: ["rangefinder friendly", "symmetric", "short back focus", "compact"],
    typicalUse: "Rangefinder wide-angle lenses and compact architectural photography lenses.",
    representativeExamples: ["Zeiss Biogon 21mm f/4.5", "Zeiss Biogon 35mm f/2.8", "Hasselblad SWC Biogon 38mm f/4.5"],
    diagram: {
      stop: { x: 50, height: 58 },
      elements: [
        { id: "bi-1", x: 9, width: 9, height: 68, surface: "meniscus", group: 1, tone: "cool" },
        { id: "bi-2", x: 21, width: 10, height: 78, surface: "convex-left", group: 2, tone: "warm" },
        { id: "bi-3", x: 31, width: 9, height: 70, surface: "biconcave", group: 2, tone: "clear" },
        { id: "bi-4", x: 41, width: 9, height: 62, surface: "convex-right", group: 3, tone: "warm" },
        { id: "bi-5", x: 60, width: 9, height: 62, surface: "convex-left", group: 3, tone: "warm" },
        { id: "bi-6", x: 70, width: 9, height: 70, surface: "biconcave", group: 4, tone: "clear" },
        { id: "bi-7", x: 79, width: 10, height: 78, surface: "convex-right", group: 4, tone: "warm" },
        { id: "bi-8", x: 92, width: 9, height: 68, surface: "meniscus", group: 5, tone: "cool" },
      ],
    },
    playground: playgroundPreset(
      [
        group("bi-g1", "front meniscus", -52, 0.006, 46),
        group("bi-g2", "front cell", -26, 0.011, 48, ["positive", "cemented"]),
        group("bi-g3", "central cell", 0, -0.003, 34),
        group("bi-g4", "rear cell", 26, 0.011, 48, ["cemented", "positive"]),
        group("bi-g5", "rear meniscus", 52, 0.006, 46, ["cemented", "positive"]),
      ],
      { stopPosition: 0, symmetryTendency: "high", backFocusTendency: "short", speedTendency: "moderate", defaultSensorPosition: 74, defaultApertureSize: 20 },
    ),
  },
  {
    id: "topogon",
    name: "Topogon",
    category: "Symmetrical wide-angle",
    elements: 4,
    groups: 4,
    description: "A highly symmetrical wide-angle form known for compactness and restrained distortion.",
    whyMatters: "The Topogon is important as a clean wide-angle idea: strong symmetry, modest speed, and geometry that suits careful mapping or architecture-minded work.",
    traits: ["strong symmetry", "compact layout", "wide field", "limited speed"],
    cameraTags: ["compact", "symmetric", "short back focus", "rangefinder friendly"],
    typicalUse: "Aerial, mapping, and compact wide-angle photography.",
    representativeExamples: ["Zeiss Topogon 25mm f/4", "Russar MR-2 inspired by similar ideas", "Survey-camera wide-angle lenses"],
    diagram: {
      stop: { x: 50, height: 56 },
      elements: [
        { id: "to-1", x: 16, width: 10, height: 65, surface: "meniscus", group: 1, tone: "cool" },
        { id: "to-2", x: 35, width: 11, height: 78, surface: "convex-right", group: 2, tone: "warm" },
        { id: "to-3", x: 55, width: 11, height: 78, surface: "convex-left", group: 3, tone: "warm" },
        { id: "to-4", x: 74, width: 10, height: 65, surface: "meniscus", group: 4, tone: "cool" },
      ],
    },
    playground: playgroundPreset(
      [group("to-g1", "front meniscus", -30, 0.007, 36), group("to-g2", "front positive", -10, 0.009, 40), group("to-g3", "rear positive", 10, 0.009, 40), group("to-g4", "rear meniscus", 30, 0.007, 36)],
      { stopPosition: 0, symmetryTendency: "high", backFocusTendency: "short", speedTendency: "slow", defaultSensorPosition: 62, defaultApertureSize: 16 },
    ),
  },
  {
    id: "distagon-retrofocus",
    name: "Distagon / Retrofocus",
    category: "Retrofocus wide-angle",
    elements: 8,
    groups: 5,
    description: "A wide-angle SLR-friendly archetype using a negative front group to increase back focus.",
    whyMatters: "Retrofocus lenses made practical wide-angle photography possible on SLRs by leaving room for the mirror while keeping a wide field of view.",
    traits: ["long back focus", "large front negative group", "SLR mirror clearance", "wide-angle perspective"],
    cameraTags: ["retrofocus", "SLR friendly", "long back focus"],
    typicalUse: "SLR and mirrorless wide-angle lenses where mechanical clearance matters.",
    representativeExamples: ["Zeiss Distagon 28mm f/2.8", "Angenieux Retrofocus 35mm f/2.5", "Nikon 24mm f/2.8"],
    diagram: {
      stop: { x: 55, height: 66 },
      elements: [
        { id: "di-1", x: 8, width: 12, height: 88, surface: "biconcave", group: 1, tone: "clear" },
        { id: "di-2", x: 24, width: 11, height: 78, surface: "meniscus", group: 2, tone: "cool" },
        { id: "di-3", x: 38, width: 10, height: 72, surface: "convex-left", group: 3, tone: "warm" },
        { id: "di-4", x: 48, width: 9, height: 66, surface: "biconcave", group: 3, tone: "clear" },
        { id: "di-5", x: 66, width: 10, height: 74, surface: "biconvex", group: 4, tone: "warm" },
        { id: "di-6", x: 78, width: 9, height: 70, surface: "meniscus", group: 5, tone: "cool" },
        { id: "di-7", x: 88, width: 9, height: 64, surface: "convex-right", group: 6, tone: "warm" },
        { id: "di-8", x: 98, width: 8, height: 58, surface: "meniscus", group: 7, tone: "clear" },
      ],
    },
    playground: playgroundPreset(
      [
        group("di-g1", "front negative group", -50, -0.026, 68, ["negative", "negative"]),
        group("di-g2", "positive corrector", -22, 0.01, 48),
        group("di-g3", "main correcting group", -4, 0.012, 44, ["positive", "cemented"]),
        group("di-g4", "rear positive group", 22, 0.018, 42, ["positive", "cemented"]),
        group("di-g5", "field positive", 44, 0.006, 34),
      ],
      { stopPosition: 6, symmetryTendency: "low", backFocusTendency: "long", speedTendency: "moderate", defaultSensorPosition: 126, defaultApertureSize: 22 },
    ),
    technicalPrescription: technicalPrescription("distagon-retrofocus-tech", "Distagon / Retrofocus approximate paraxial prescription", 126, [
      surface("di-s1", -40, 5, 34, 1, 1.62, { label: "front negative group", glass: "flint" }),
      surface("di-s2", 72, 12, 33, 1.62, 1),
      surface("di-s3", 58, 4, 25, 1, 1.58, { label: "positive corrector", glass: "crown" }),
      surface("di-s4", -45, 6, 24, 1.58, 1),
      surface("di-s5", 42, 3, 22, 1, 1.62, { label: "main correcting group", glass: "dense crown" }),
      surface("di-s6", -32, 2, 21, 1.62, 1.72, { label: "cemented interface", glass: "flint" }),
      surface("di-s7", -64, 7, 21, 1.72, 1),
      surface("di-stop", Infinity, 7, 11, 1, 1, { label: "stop", isStop: true }),
      surface("di-s8", 34, 5, 20, 1, 1.64, { label: "rear positive group", glass: "dense crown" }),
      surface("di-s9", -48, 3, 19, 1.64, 1.72, { label: "cemented interface", glass: "flint" }),
      surface("di-s10", 72, 8, 19, 1.72, 1),
      surface("di-s11", 58, 4, 17, 1, 1.58, { label: "field positive", glass: "crown" }),
      surface("di-s12", -72, 60, 17, 1.58, 1),
    ]),
  },
  {
    id: "petzval",
    name: "Petzval",
    category: "Portrait classic",
    elements: 4,
    groups: 2,
    description: "A bright portrait formula with separated front and rear doublets, prized for historical character.",
    whyMatters: "The Petzval matters because it is one of the classic examples where speed, field curvature, and rendering character become part of the photographic signature.",
    traits: ["fast portrait heritage", "curved field character", "strong center emphasis", "distinctive background rendering"],
    cameraTags: ["fast normal", "long back focus", "low air-glass surfaces"],
    typicalUse: "Portrait lenses, projection lenses, and modern character-lens revivals.",
    representativeExamples: ["Voigtlander Petzval Portrait Lens", "Dallmeyer 3B", "Lomography New Petzval"],
    diagram: {
      stop: { x: 50, height: 74 },
      elements: [
        { id: "pe-1", x: 19, width: 12, height: 84, surface: "convex-left", group: 1, tone: "warm" },
        { id: "pe-2", x: 30, width: 10, height: 78, surface: "convex-right", group: 1, tone: "cool" },
        { id: "pe-3", x: 68, width: 10, height: 70, surface: "biconcave", group: 2, tone: "clear" },
        { id: "pe-4", x: 78, width: 12, height: 82, surface: "convex-right", group: 2, tone: "warm" },
      ],
    },
    playground: playgroundPreset(
      [group("pe-g1", "front doublet", -24, 0.018, 50, ["positive", "cemented"]), group("pe-g2", "rear doublet", 28, 0.008, 42, ["negative", "positive"])],
      { stopPosition: 2, symmetryTendency: "low", backFocusTendency: "long", speedTendency: "fast", defaultSensorPosition: 88, defaultApertureSize: 30 },
    ),
  },
];

export const categories = Array.from(new Set(lenses.map((lens) => lens.category)));
