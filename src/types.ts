export interface CalculationResult {
  soul: number;
  soulComposite: string;
  path: number;
  pathComposite: string;
  direction: number;
  directionComposite: string;
  expression: number;
  expressionComposite: string;
  result: number;
  resultComposite: string;
  baseMatrix: Record<string, number>;
  detailedMatrix: Record<string, number>;
}

export type FirstMirror = {
  title: string;
  subtitle: string;
  formula: {
    numbers: string;
    planets: string;
    positions: string;
  };
  blocks: {
    id: "main_pattern" | "strength" | "tension" | "step" | "resonance";
    title: string;
    text: string;
  }[];
  keyInsight: string;
  strengthTags: string[];
  tensionTags: string[];
  practicalStep: string;
  cta: {
    title: string;
    text: string;
    button: string;
  };
  disclaimer: string;
};

export interface StoryInputs {
  q1: string;
  q2: string;
  q3: string;
  q4: string;
}

export type PersonalMythMirror = {
  mainImage: string;
  innerTension: string;
  hiddenResource: string;
  newView: string;
};

export interface ApiResponse {
  mode: "code" | "story" | "compatibility";
  status: "ok" | "demo" | "error" | "crisis";
  code_result?: {
    mirror_text?: string;
    first_mirror?: FirstMirror;
  };
  compatibility_result?: {
    introduction: string;
    cards_summary: string;
    levels: {
      soul_to_soul: string;
      path_to_path: string;
      cross_dynamic: string;
      matrix_overlay: string;
      cycles_sync: string;
    };
    strength_point: string;
    tension_point: string;
    practice_or_parable: string;
  };
  story_result?: {
    title: string;
    story: string;
    mirror: PersonalMythMirror;
    meaning: string[];
    one_step: string;
    journal_question: string;
    disclaimer: string;
  };
  ui?: {
    safe_message?: string;
  };
}

export interface MeetingParallel {
  theme: string;
  codeAnchor: string;
  mythAnchor: string;
  synthesis: string;
}

export interface MeetingDivergence {
  theme: string;
  codeAspect: string;
  mythAspect: string;
  reflection: string;
}

export interface MeetingOfMirrorsResult {
  summary: string;
  hasStrongParallels: boolean;
  confidenceNote: string;
  parallels: MeetingParallel[];
  divergences: MeetingDivergence[];
  albertInsight: string;
  reflectiveQuestion: string;
  disclaimer: string;
}

export interface MeetingApiResponse {
  status: "ok" | "error" | "no_match";
  result?: MeetingOfMirrorsResult;
  ui?: {
    safe_message?: string;
  };
}

export interface TesterFeedback {
  id?: string;
  score: number; // 0-10
  recognizeMotifs?: string;
  helpedSeeDifferently?: string;
  feelsPersonalOrGeneric?: string;
  wantsContinuation?: string;
  comment?: string;
  createdAt?: string;
}

export interface ABModelOutput {
  id: string; // "A" or "B"
  actualModel?: string; // Revealed only when requested
  title: string;
  story: string;
  mirror: PersonalMythMirror;
  one_step: string;
  journal_question: string;
  latencyMs?: number;
  tokensEstimate?: number;
}

export interface ABComparisonResponse {
  status: "ok" | "error";
  fixtureId: string;
  fixtureTitle: string;
  inputs: StoryInputs;
  variantA: ABModelOutput;
  variantB: ABModelOutput;
  modelAName: string;
  modelBName: string;
}

export interface CodeV2CalculationStep {
  position: "soul" | "expression" | "path" | "direction" | "result";
  public_name: string;
  formula_label: string;
  calculation: string;
  rule: string;
}

export interface CodeV2Calculation {
  date: string;
  five_numbers: {
    soul: number;
    expression: number;
    path: number;
    direction: number;
    result: number;
  };
  compound_routes: {
    soul: string;
    expression: string;
    path: string;
    direction: string;
    result: string;
  };
  calculation_chain: CodeV2CalculationStep[];
}

export interface CodeV2MethodOrientation {
  summary: string;
  epistemic_frame: string;
  core_law: string;
  target_questions: Array<{
    position: string;
    question: string;
  }>;
}

export interface CodeV2PositionScene {
  title: string;
  description: string;
}

export interface CodeV2Position {
  position: "soul" | "expression" | "path" | "direction" | "result";
  public_name: string;
  role: string;
  role_question: string;
  energy: number;
  energy_name: string;
  compound_route: string;
  compound_title?: string | null;
  compound_nuance?: string | null;
  headline_mechanism: string;
  mechanism_names: string[];
  essence: string;
  tension: string;
  strong_form: string;
  shadow: string;
  life_scenes: CodeV2PositionScene[];
  verification_question: string;
  all_verification_questions?: string[];
  albert_hook: string;
  environment_parameters?: Record<string, string>;
}

export interface CodeV2Interaction {
  pair: [string, string];
  energies: [number, number];
  positions_label: string;
  heading: string;
  category: string;
  relation_question: string;
  meaning: string;
}

export interface CodeV2Synthesis {
  strongest_motif: string;
  environment: {
    title: string;
    energy_name: string;
    summary: string;
    parameters?: Record<string, string>;
  };
  mature_integration: {
    title: string;
    energy_name: string;
    summary: string;
  };
  full_synthesis_word_count: number;
  full_composed_portrait: string;
}

export interface CodeV2AlbertContext {
  calculated_map: {
    soul: number;
    expression: number;
    path: number;
    direction: number;
    result: number;
  };
  selected_interactions: CodeV2Interaction[];
  strongest_hypothesis: string;
  opening_statement: string;
  opening_question: string;
  albert_canonical_quote: string;
  provenance_status: string;
}

export interface CodeV2Payload {
  status: "ok";
  calculation: CodeV2Calculation;
  method_orientation: CodeV2MethodOrientation;
  positions: CodeV2Position[];
  interactions: CodeV2Interaction[];
  synthesis: CodeV2Synthesis;
  verification: string[];
  albert_context: CodeV2AlbertContext;
}

