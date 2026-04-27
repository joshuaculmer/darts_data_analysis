import { useState, useCallback, useMemo, useEffect } from "react";
import { loadGameSessions, loadSurveyResponses } from "./loaders/loadData";
import type {
  ParsedGameSession,
  ParsedSurveyResponse,
} from "./loaders/loadData";
import { fetchData, isSupabaseConfigured } from "./loaders/fetchSupabase";
import { loadBoards } from "./loaders/loadBoards";
import type { RewardSurface } from "./types/dart";
import {
  computeScoreVsSkillPoints,
  computeProximityVsScorePoints,
  computeScoreByCondition,
} from "./utils/scoreStats";
import { getCompleteUserIds } from "./utils/stats";
import {
  joinSessionsWithSurvey,
  computeTrustByCondition,
  computeTrustOverTime,
  computeTrustVsScorePoints,
  computeTrustVsTimePoints,
  computeTrustVsProximityPoints,
} from "./utils/surveyStats";
import { KpiCards } from "./components/sanity/KpiCards";
import { SessionCalendar } from "./components/sanity/SessionCalendar";
import { ConditionDistribution } from "./components/sanity/ConditionDistribution";
import { ScoreVsSkillScatter } from "./components/performance/ScoreVsSkillScatter";
import { ScoreByCondition } from "./components/performance/ScoreByCondition";
import { TrustQuestionSelector } from "./components/trust/TrustQuestionSelector";
import { TrustByCondition } from "./components/trust/TrustByCondition";
import { TrustOverTime } from "./components/trust/TrustOverTime";
import { TrustVsScore } from "./components/trust/TrustVsScore";
import { TrustVsTime } from "./components/trust/TrustVsTime";
import { TrustVsProximity } from "./components/trust/TrustVsProximity";
import { ProximityVsScore } from "./components/performance/ProximityVsScore";
import { SessionsTable } from "./components/raw/SessionsTable";
import { SurveyTable } from "./components/raw/SurveyTable";
import { IndividualView } from "./components/individual/IndividualView";
import { SessionView } from "./components/session/SessionView";
import "./App.css";

type NavSection =
  | "sanity"
  | "performance"
  | "trust"
  | "individual"
  | "session"
  | "raw";

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
  const [sessionViewParticipant, setSessionViewParticipant] = useState<
    string | null
  >(null);
  const [sessionViewIndex, setSessionViewIndex] = useState<number | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Restore persisted data on mount — JSON (fetched) takes priority over CSV (uploaded)
  useEffect(() => {
    const savedSessionsJson = localStorage.getItem("darts:sessions_json");
    const savedSurveyJson = localStorage.getItem("darts:survey_json");
    const savedSessionsCsv = localStorage.getItem("darts:sessions_csv");
    const savedSurveyCsv = localStorage.getItem("darts:survey_csv");

    if (savedSessionsJson) {
      const parsed = JSON.parse(savedSessionsJson) as ParsedGameSession[];
      setSessions(parsed);
      setSessionsLoaded(true);
    } else if (savedSessionsCsv) {
      loadGameSessions(savedSessionsCsv).then((parsed) => {
        setSessions(parsed);
        setSessionsLoaded(true);
      });
    }

    if (savedSurveyJson) {
      const parsed = JSON.parse(savedSurveyJson) as ParsedSurveyResponse[];
      setSurveyResponses(parsed);
    } else if (savedSurveyCsv) {
      loadSurveyResponses(savedSurveyCsv).then((parsed) => {
        setSurveyResponses(parsed);
      });
    }
  }, []);

  const handleSessionsFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      localStorage.setItem("darts:sessions_csv", text);
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
      localStorage.setItem("darts:survey_csv", text);
      const parsed = await loadSurveyResponses(text);
      setSurveyResponses(parsed);
    },
    [],
  );

  const handleClearData = useCallback(() => {
    localStorage.removeItem("darts:sessions_csv");
    localStorage.removeItem("darts:survey_csv");
    localStorage.removeItem("darts:sessions_json");
    localStorage.removeItem("darts:survey_json");
    setSessions([]);
    setSurveyResponses([]);
    setSessionsLoaded(false);
    setBoardsLoaded(false);
    setBoards(new Map());
    setActiveSection("sanity");
    setTrustQuestionId(null);
    setSessionViewParticipant(null);
    setSessionViewIndex(null);
    setFetchError(null);
  }, []);

  const doFetch = useCallback(async (password: string) => {
    setIsFetching(true);
    setFetchError(null);
    try {
      const { sessions: fetchedSessions, survey: fetchedSurvey } =
        await fetchData(password);
      localStorage.setItem(
        "darts:sessions_json",
        JSON.stringify(fetchedSessions),
      );
      localStorage.setItem("darts:survey_json", JSON.stringify(fetchedSurvey));
      setSessions(fetchedSessions);
      setSurveyResponses(fetchedSurvey);
      setSessionsLoaded(true);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsFetching(false);
    }
  }, []);

  const handleFetchClick = useCallback(() => {
    setPasswordInput("");
    setFetchError(null);
    setShowPasswordModal(true);
  }, []);

  const handlePasswordSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setShowPasswordModal(false);
      void doFetch(passwordInput);
    },
    [passwordInput, doFetch],
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
    () =>
      completeOnly
        ? sessions.filter((s) => completeUserIds.has(s.user_uuid))
        : sessions,
    [sessions, completeOnly, completeUserIds],
  );

  const filteredSurveyResponses = useMemo(
    () =>
      completeOnly
        ? surveyResponses.filter((r) => completeUserIds.has(r.user_uuid))
        : surveyResponses,
    [surveyResponses, completeOnly, completeUserIds],
  );

  const scoreVsSkillPoints = useMemo(
    () => computeScoreVsSkillPoints(filteredSessions, boards),
    [filteredSessions, boards],
  );
  const scoreByConditionStats = useMemo(
    () => computeScoreByCondition(filteredSessions, boards),
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
  const trustVsTimePoints = useMemo(
    () =>
      trustQuestionId
        ? computeTrustVsTimePoints(joinedData, trustQuestionId)
        : [],
    [joinedData, trustQuestionId],
  );
  const trustVsProximityPoints = useMemo(
    () =>
      trustQuestionId
        ? computeTrustVsProximityPoints(joinedData, trustQuestionId)
        : [],
    [joinedData, trustQuestionId],
  );
  const proximityVsScorePoints = useMemo(
    () => computeProximityVsScorePoints(filteredSessions, boards),
    [filteredSessions, boards],
  );

  const surveyLoaded = surveyResponses.length > 0;
  const anyDataLoaded = sessionsLoaded || surveyLoaded;

  const passwordModal = showPasswordModal && (
    <div className="modal-overlay">
      <div className="modal-card">
        <h2 className="modal-title">Fetch from Supabase</h2>
        <form onSubmit={handlePasswordSubmit}>
          <label className="modal-label">
            Password
            <input
              className="modal-input"
              type="password"
              autoFocus
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
            />
          </label>
          {fetchError && <p className="modal-error">{fetchError}</p>}
          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowPasswordModal(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Fetch
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const fetchBtn = isSupabaseConfigured() && (
    <button
      className="btn-primary"
      onClick={handleFetchClick}
      disabled={isFetching}
      style={{ alignSelf: "center" }}
    >
      {isFetching ? "Fetching…" : "Fetch Data"}
    </button>
  );

  const appHeader = (
    <header className="app-header">
      <h1>Darts Research — Data Analysis</h1>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
        {fetchBtn}
        {anyDataLoaded && (
          <button className="btn-danger" onClick={handleClearData}>
            Clear Data
          </button>
        )}
      </div>
    </header>
  );

  if (!sessionsLoaded || !surveyLoaded) {
    return (
      <div className="app">
        {passwordModal}
        {appHeader}
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
          {fetchError && !showPasswordModal && (
            <p className="fetch-error">{fetchError}</p>
          )}
        </div>
      </div>
    );
  }

  if (!boardsLoaded) {
    return (
      <div className="app">
        {appHeader}
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
      {passwordModal}
      <header className="app-header">
        <h1>Darts Analysis</h1>
        {NAV_ITEMS.map(({ id, label }) => (
          <button
            key={id}
            className={`nav-tab${activeSection === id ? " nav-tab--active" : ""}`}
            onClick={() => setActiveSection(id)}
          >
            {label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          className="btn-danger"
          onClick={handleClearData}
          style={{ alignSelf: "center" }}
        >
          Clear Data
        </button>
      </header>

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
            <ScoreByCondition stats={scoreByConditionStats} />
            <ScoreVsSkillScatter
              points={scoreVsSkillPoints}
              onSessionClick={(user_uuid, sessionIndex) => {
                setSessionViewParticipant(user_uuid);
                setSessionViewIndex(sessionIndex);
                setActiveSection("session");
              }}
            />
            {trustQuestionId && (
              <TrustVsScore points={trustVsScorePoints} boards={boards} />
            )}
            <ProximityVsScore points={proximityVsScorePoints} boards={boards} />
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
                  <TrustVsScore points={trustVsScorePoints} boards={boards} />
                </div>
                <TrustVsTime points={trustVsTimePoints} />
                <TrustVsProximity points={trustVsProximityPoints} />
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
              Full details of each game session for the selected participant
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
              All sessions and survey responses — unfiltered regardless of the
              Complete Participants toggle. Click any column header to sort.
            </p>
            <SessionsTable sessions={sessions} boards={boards} />
            <SurveyTable surveys={surveyResponses} />
          </section>
        )}
      </main>
    </div>
  );
}

export default App;

