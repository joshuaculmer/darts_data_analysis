export type QuestionType = "select" | "text" | "number" | "boolean";

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[];
  required: boolean;
}

export interface Answer {
  questionId: string;
  value: string | number | boolean;
}

export interface PostSessionSurveyResponseDTO {
  responses: Answer[];
  user_uuid: string;
  user_nickname: string | null;
}
