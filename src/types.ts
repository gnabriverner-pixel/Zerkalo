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

export type PersonalMythMirror = {
  mainImage: string;
  innerTension: string;
  hiddenResource: string;
  newView: string;
};

export type PersonalMythAnswerEcho = {
  answer_key: keyof StoryInputs;
  source_phrase: string;
  story_image: string;
};

export interface ApiResponse {
  mode: "code" | "story" | "compatibility";
  status: "ok" | "demo" | "error" | "crisis" | "unavailable";
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
    meaning?: string[];
    answer_echoes?: PersonalMythAnswerEcho[];
    one_step: string;
    journal_question: string;
    visual_key?: "threshold" | "forest_path" | "quiet_room" | "river_crossing" | "night_window" | "open_field";
    disclaimer: string;
  };
  request_id?: string;
  qa?: {
    passed: boolean;
    word_count: number;
    answer_coverage: Array<keyof StoryInputs>;
    repaired: boolean;
  };
  ui?: {
    safe_message?: string;
  };
}
