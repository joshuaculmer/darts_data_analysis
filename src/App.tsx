import { useState, useCallback, useMemo, useEffect } from "react";
import { loadGameSessions, loadSurveyResponses } from "./loaders/loadData";
import type {
  ParsedGameSession,
  ParsedSurveyResponse,
} from "./loaders/loadData";
import { loadBoards } from "./loaders/loadBoards";
import type { RewardSurface } from "./types/dart";
import {
  computeScoreVsSkillPoints,
  computeAllSessionScores,
  computeParticipantTotalScores,
} from "./utils/scoreStats";
import { getCompleteUserIds } from "./utils/stats";
import {
  joinSessionsWithSurvey,
  computeTrustByCondition,
  computeTrustOverTime,
  computeTrustVsScorePoints,
} from "./utils/surveyStats";
import { KpiCards } from "./components/sanity/KpiCards";
import { SessionCalendar } from "./components/sanity/SessionCalendar";
import { ConditionDistribution } from "./components/sanity/ConditionDistribution";
import { ScoreVsSkillScatter } from "./components/performance/ScoreVsSkillScatter";
import { TrustQuestionSelector } from "./components/trust/TrustQuestionSelector";
import { TrustByCondition } from "./components/trust/TrustByCondition";
import { TrustOverTime } from "./components/trust/TrustOverTime";
import { TrustVsScore } from "./components/trust/TrustVsScore";
import { IndividualView } from "./components/individual/IndividualView";
import { SessionView } from "./components/session/SessionView";
import "./App.css";

type NavSection = "sanity" | "performance" | "trust" | "individual" | "session" | "raw";

const NAV_ITEMS: { id: NavSection; label: string }[] = [
  { id: "sanity", label: "Sanity Checks" },
  { id: "performance", label: "Game Performance" },
  { id: "trust", label: "Trust & Influence" },
  { id: "individual", label: "Individual View" },
  { id: "session", label: "Session View" },
  { id: "raw", label: "Raw Data" },
];

function App() {
  const [sessions, setSessions] = useState<ParsedGameSession[]>([]);
  const [surveyResponses, setSurveyResponses] = useState<
    ParsedSurveyResponse[]
  >([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [boards, setBoards] = useState<Map<number, RewardSurface>>(new Map());
  const [boardsLoaded, setBoardsLoaded] = useState(false);
  const [activeSection, setActiveSection] = useState<NavSection>("sanity");
  const [trustQuestionId, setTrustQuestionId] = useState<string | null>(null);
  const [completeOnly, setCompleteOnly] = useState(true);
  const [sessionViewParticipant, setSessionViewParticipant] = useState<string | null>(null);
  const [sessionViewIndex, setSessionViewIndex] = useState<number | null>(null);

  const handleSessionsFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const parsed = await loadGameSessions(text);
      setSessions(parsed);
      setSessionsLoaded(true);
    },
    [],
  );

  const handleSurveyFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const parsed = await loadSurveyResponses(text);
      setSurveyResponses(parsed);
    },
    [],
  );

  // Auto-select the first available trust question whenever survey data loads
  useEffect(() => {
    if (surveyResponses.length === 0) return;
    const firstId = surveyResponses[0]?.responses[0]?.questionId ?? null;
    if (firstId) setTrustQuestionId(firstId);
  }, [surveyResponses]);

  // Load board surfaces once both CSVs are ready
  useEffect(() => {
    if (!sessionsLoaded || surveyResponses.length === 0) return;
    setBoardsLoaded(false);
    loadBoards(sessions).then((loaded) => {
      setBoards(loaded);
      setBoardsLoaded(true);
    });
  }, [sessions, surveyResponses, sessionsLoaded]);

  const completeUserIds = useMemo(
    () => getCompleteUserIds(sessions, surveyResponses),
    [sessions, surveyResponses],
  );

  const filteredSessions = useMemo(
    () => (completeOnly ? sessions.filter((s) => completeUserIds.has(s.user_uuid)) : sessions),
    [sessions, completeOnly, completeUserIds],
  );

  const filteredSurveyResponses = useMemo(
    () => (completeOnly ? surveyResponses.filter((r) => completeUserIds.has(r.user_uuid)) : surveyResponses),
    [surveyResponses, completeOnly, completeUserIds],
  );

  const scoreVsSkillPoints = useMemo(
    () => computeScoreVsSkillPoints(filteredSessions, boards),
    [filteredSessions, boards],
  );
  const sessionScores = useMemo(
    () => computeAllSessionScores(filteredSessions, boards),
    [filteredSessions, boards],
  );
  const participantTotalScores = useMemo(
    () => computeParticipantTotalScores(filteredSessions, boards),
    [filteredSessions, boards],
  );
  const joinedData = useMemo(
    () => joinSessionsWithSurvey(filteredSessions, filteredSurveyResponses),
    [filteredSessions, filteredSurveyResponses],
  );
  const trustByCondition = useMemo(
    () =>
      trustQuestionId
        ? computeTrustByCondition(joinedData, trustQuestionId)
        : [],
    [joinedData, trustQuestionId],
  );
  const trustOverTime = useMemo(
    () =>
      trustQuestionId ? computeTrustOverTime(joinedData, trustQuestionId) : [],
    [joinedData, trustQuestionId],
  );
  const trustVsScorePoints = useMemo(
    () =>
      trustQuestionId
        ? computeTrustVsScorePoints(joinedData, trustQuestionId, boards)
        : [],
    [joinedData, trustQuestionId, boards],
  );

  const surveyLoaded = surveyResponses.length > 0;

  if (!sessionsLoaded || !surveyLoaded) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Darts Research — Data Analysis</h1>
        </header>
        <div className="upload-screen">
          <div className="upload-group">
            <div className="upload-item upload-item--required">
              <span className="upload-label">
                Game Sessions CSV{" "}
                <span className="upload-required">required</span>
              </span>
              <p className="upload-hint">
                Export of <code>game_sessions</code> from Supabase
              </p>
              <label className="upload-btn">
                Choose game_sessions.csv
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleSessionsFile}
                  hidden
                />
              </label>
              {sessionsLoaded && <span className="upload-loaded">Loaded</span>}
            </div>
            <div className="upload-item upload-item--required">
              <span className="upload-label">
                Post-Session Survey CSV{" "}
                <span className="upload-required">required</span>
              </span>
              <p className="upload-hint">
                Export of <code>post_session_survey_responses</code> from
                Supabase
              </p>
              <label className="upload-btn">
                Choose survey.csv
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleSurveyFile}
                  hidden
                />
              </label>
              {surveyLoaded && <span className="upload-loaded">Loaded</span>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!boardsLoaded) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Darts Research — Data Analysis</h1>
        </header>
        <div className="upload-screen">
          <p style={{ color: "#64748b", fontSize: 14 }}>
            Loading board surfaces…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Darts Research — Data Analysis</h1>
      </header>

      <nav className="app-nav">
        {NAV_ITEMS.map(({ id, label }) => (
          <button
            key={id}
            className={`nav-tab${activeSection === id ? " nav-tab--active" : ""}`}
            onClick={() => setActiveSection(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="dashboard">
        {activeSection === "sanity" && (
          <section className="dash-section">
            <KpiCards
              sessions={filteredSessions}
              surveyResponses={filteredSurveyResponses}
              completeOnly={completeOnly}
              onToggleCompleteOnly={() => setCompleteOnly((v) => !v)}
            />
            <div className="chart-row">
              <SessionCalendar sessions={filteredSessions} />
              <ConditionDistribution sessions={filteredSessions} />
            </div>
          </section>
        )}

        {activeSection === "performance" && (
          <section className="dash-section">
            <p className="section-note">
              How game scores vary by AI condition and player trust.
            </p>
            <ScoreVsSkillScatter
              points={scoreVsSkillPoints}
              onSessionClick={(user_uuid, sessionIndex) => {
                setSessionViewParticipant(user_uuid);
                setSessionViewIndex(sessionIndex);
                setActiveSection("session");
              }}
            />
            {trustQuestionId && <TrustVsScore points={trustVsScorePoints} />}
          </section>
        )}

        {activeSection === "trust" && (
          <section className="dash-section">
            <p className="section-note">
              How much participants trusted the AI, how condition shaped that
              trust, and whether trust translated into better scores.
            </p>
            <TrustQuestionSelector
              surveys={surveyResponses}
              trustQuestionId={trustQuestionId}
              onChange={setTrustQuestionId}
            />
            {trustQuestionId ? (
              <>
                <TrustByCondition stats={trustByCondition} />
                <div className="chart-row">
                  <TrustOverTime points={trustOverTime} />
                  <TrustVsScore points={trustVsScorePoints} />
                </div>
              </>
            ) : (
              <p className="section-note">
                Select a trust question above to load the charts.
              </p>
            )}
          </section>
        )}

        {activeSection === "individual" && (
          <section className="dash-section">
            <p className="section-note">
              Select a participant to see the full story of their sessions,
              trust arc, and condition exposure.
            </p>
            <IndividualView
              sessions={filteredSessions}
              joined={joinedData}
              trustQuestionId={trustQuestionId}
              surveyLoaded={surveyLoaded}
              boards={boards}
            />
          </section>
        )}

        {activeSection === "session" && (
          <section className="dash-section">
            <p className="section-note">
              Raw data for a single session. Click any point in the Score vs Execution Skill chart to jump here.
            </p>
            <SessionView
              sessions={filteredSessions}
              boards={boards}
              initialParticipant={sessionViewParticipant}
              initialSessionIndex={sessionViewIndex}
            />
          </section>
        )}

        {activeSection === "raw" && (
          <section className="dash-section">
            <p className="section-note">
              Filterable, sortable tables with CSV export.
            </p>
            <div className="chart-card">
              <h2>Sessions Table</h2>
              <p className="coming-soon">Coming soon</p>
            </div>
            <div className="chart-card">
              <h2>Survey Responses Table</h2>
              <p className="coming-soon">Coming soon</p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;

