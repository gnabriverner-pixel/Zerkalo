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
    id: "main_pattern" | "strength" | "tension" | "step";
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

export interface ApiResponse {
  mode: "code" | "story";
  status: "ok" | "demo" | "error" | "crisis";
  code_result?: {
    mirror_text?: string;
    first_mirror?: FirstMirror;
  };
  story_result?: {
    title: string;
    story: string;
    meaning: string[];
    one_step: string;
    journal_question: string;
  };
  ui?: {
    safe_message?: string;
  };
}
