import { describe, it, expect } from "vitest";
import type { ParsedSurveyResponse } from "../../loaders/loadData";
import { sortSurveyRows } from "./SurveyTable";

function survey(overrides: Partial<ParsedSurveyResponse>): ParsedSurveyResponse {
  return {
    id: "survey-1",
    created_at: "2024-01-01T00:00:00Z",
    user_uuid: "u",
    user_nickname: "N",
    responses: [],
    ...overrides,
  };
}

describe("sortSurveyRows", () => {
  it("default participant sort groups by participant, then created_at ascending", () => {
    const rows = [
      survey({ user_uuid: "u-bob", user_nickname: "Bob", created_at: "2024-01-10T00:00:00Z" }),
      survey({ user_uuid: "u-alice", user_nickname: "Alice", created_at: "2024-01-15T12:00:00Z" }),
      survey({ user_uuid: "u-alice", user_nickname: "Alice", created_at: "2024-01-15T10:00:00Z" }),
    ];
    const sorted = sortSurveyRows(rows, "participant", "asc");
    expect(sorted.map((s) => [s.user_nickname, s.created_at.slice(11, 16)])).toEqual([
      ["Alice", "10:00"],
      ["Alice", "12:00"],
      ["Bob", "00:00"],
    ]);
  });

  it("uses created_at ascending as the tiebreaker under any column sort", () => {
    const rows = [
      survey({ user_uuid: "u-x", user_nickname: "X", created_at: "2024-01-15T12:00:00Z" }),
      survey({ user_uuid: "u-x", user_nickname: "X", created_at: "2024-01-15T10:00:00Z" }),
    ];
    // Equal uuid → tiebreak is chronological ascending even when sorting desc.
    const sorted = sortSurveyRows(rows, "uuid", "desc");
    expect(sorted.map((s) => s.created_at.slice(11, 16))).toEqual(["10:00", "12:00"]);
  });
});
