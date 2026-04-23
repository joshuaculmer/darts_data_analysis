import { UUID } from "crypto";
import { Answer } from "../components/survey";
import { Game_SessionDTO } from "../model/game_session";
import { printAPIResponse } from "./APIHelper";
import { Darts_Dao } from "./Darts_Dao";
import { supabase } from "./SupabaseClient";

export class Supabase_Dao implements Darts_Dao {
  async insertGameSessionDto(input: Game_SessionDTO, user_uuid: UUID): Promise<void> {
    if (supabase != null) {
      const { data, error } = await supabase
        .from("game_sessions")
        .insert({
          execution_skill: input.execution_skill,
          games_played: input.games_played,
          ai_advice: input.ai_advice,
          games: input.games,
          user_uuid: user_uuid,
          user_nickname: input.user_nickname,
        })
        .select();
      printAPIResponse(data, error?.message, "inserting game session");
    }
  }

  async insertPostSessionSurveyAnswers(
    answers: Answer[],
    user_uuid: UUID,
    user_nickname: string | null,
  ): Promise<void> {
    if (supabase != null) {
      const { data, error } = await supabase
        .from("post_session_survey_responses")
        .insert({
          responses: answers,
          user_uuid: user_uuid,
          user_nickname,
        })
        .select();
      printAPIResponse(data, error?.message, "inserting post session survey");
    }
  }
}
