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

