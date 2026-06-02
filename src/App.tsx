import { useState, useCallback, useMemo, useEffect } from "react";
import {
  Routes,
  Route,
  Navigate,
  NavLink,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
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
  computeOptimalProximityVsScorePoints,
  computeScoreByCondition,
} from "./utils/scoreStats";
import { getCompleteUserIds } from "./utils/stats";
import {
  joinSessionsWithSurvey,
  computeTrustByCondition,
  computeTrustLikertByCondition,
  computeTrustBySession,
  computeTrustLikertBySession,
  computeTrustOverTime,
  computeTrustVsScorePoints,
  computeTrustVsTimePoints,
  computeTrustVsProximityPoints,
} from "./utils/surveyStats";
import { inferLikertScaleFromQuestionId } from "./utils/surveyScales";
import type { LikertScale } from "./utils/surveyScales";
import type { JoinedSessionSurvey } from "./utils/surveyStats";
import { KpiCards } from "./components/sanity/KpiCards";
import { SessionCalendar } from "./components/sanity/SessionCalendar";
import { ConditionDistribution } from "./components/sanity/ConditionDistribution";
import { ScoreVsSkillScatter } from "./components/performance/ScoreVsSkillScatter";
import { ScoreByCondition } from "./components/performance/ScoreByCondition";
import { TrustQuestionSelector } from "./components/trust/TrustQuestionSelector";
import { TrustByCondition } from "./components/trust/TrustByCondition";
import { TrustBySession } from "./components/trust/TrustBySession";
import { TrustOverTime } from "./components/trust/TrustOverTime";
import { TrustVsScore } from "./components/trust/TrustVsScore";
import { TrustVsTime } from "./components/trust/TrustVsTime";
import { TrustVsProximity } from "./components/trust/TrustVsProximity";
import { ProximityVsScore } from "./components/performance/ProximityVsScore";
import { OptimalProximityVsScore } from "./components/performance/OptimalProximityVsScore";
import { SessionsTable } from "./components/raw/SessionsTable";
import { SurveyTable } from "./components/raw/SurveyTable";
import { IndividualView } from "./components/individual/IndividualView";
import { SessionView } from "./components/session/SessionView";
import "./App.css";

const NAV_ITEMS: { path: string; label: string }[] = [
  { path: "/sanity", label: "Sanity Checks" },
  { path: "/performance", label: "Game Performance" },
  { path: "/trust", label: "Trust & Influence" },
  { path: "/luck", label: "Luck" },
  { path: "/individual", label: "Individual View" },
  { path: "/session", label: "Session View" },
  { path: "/raw", label: "Raw Data" },
];

type TrustSummaryGraphType = "dot_ci" | "median_iqr" | "stacked_likert";

// Route wrapper that reads :uuid / :sessionIndex from the URL. Defined at module
// scope (not inline) so SessionView keeps its internal state across renders.
function SessionRoute({
  sessions,
  boards,
}: {
  sessions: ParsedGameSession[];
  boards: Map<number, RewardSurface>;
}) {
  const { uuid, sessionIndex } = useParams();
  return (
    <section className="dash-section">
      <p className="section-note">
        Full details of each game session for the selected participant
      </p>
      <SessionView
        sessions={sessions}
        boards={boards}
        initialParticipant={uuid ?? null}
        initialSessionIndex={sessionIndex != null ? Number(sessionIndex) : null}
      />
    </section>
  );
}

// Individual View route: a single :uuid path param deep-links one participant;
// a ?users=a,b,c query (from the calendar day click) filters to several.
function IndividualRoute({
  sessions,
  surveys,
  joined,
  trustQuestionId,
  surveyLoaded,
  boards,
  likertScale,
}: {
  sessions: ParsedGameSession[];
  surveys: ParsedSurveyResponse[];
  joined: JoinedSessionSurvey[];
  trustQuestionId: string | null;
  surveyLoaded: boolean;
  boards: Map<number, RewardSurface>;
  likertScale: LikertScale;
}) {
  const { uuid } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const usersQuery = searchParams.get("users");
  const filterUuids = uuid
    ? [uuid]
    : usersQuery
      ? usersQuery.split(",").filter(Boolean)
      : undefined;
  return (
    <section className="dash-section">
      <p className="section-note">
        Select a participant to see the full story of their sessions, trust arc,
        and condition exposure.
      </p>
      <IndividualView
        sessions={sessions}
        surveys={surveys}
        joined={joined}
        trustQuestionId={trustQuestionId}
        surveyLoaded={surveyLoaded}
        boards={boards}
        filterUuids={filterUuids}
        onNavigateToSession={(u, idx) => navigate(`/session/${u}/${idx}`)}
        likertScale={likertScale}
      />
    </section>
  );
}

function App() {
  const [sessions, setSessions] = useState<ParsedGameSession[]>([]);
  const [surveyResponses, setSurveyResponses] = useState<
    ParsedSurveyResponse[]
  >([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [boards, setBoards] = useState<Map<number, RewardSurface>>(new Map());
  const [boardsLoaded, setBoardsLoaded] = useState(false);
  const [trustQuestionId, setTrustQuestionId] = useState<string | null>(null);
  const [completeOnly, setCompleteOnly] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const navigate = useNavigate();
  const [passwordInput, setPasswordInput] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [trustSummaryGraphType, setTrustSummaryGraphType] = useState<TrustSummaryGraphType>(() => {
    const saved = localStorage.getItem("darts:trust_summary_graph_type");
    if (saved === "median_iqr") return "median_iqr";
    return saved === "stacked_likert" ? "stacked_likert" : "dot_ci";
  });

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
    setTrustQuestionId(null);
    setFetchError(null);
    navigate("/sanity");
  }, [navigate]);

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

  // Auto-select a default trust/performance metric question whenever survey data loads.
  // Prefer trust if available, otherwise fall back to the first available question ID.
  useEffect(() => {
    if (surveyResponses.length === 0) return;
    const questionIds = Array.from(
      new Set(surveyResponses.flatMap((s) => s.responses.map((r) => r.questionId))),
    );
    const firstTrustId = questionIds.find(
      (id) => inferLikertScaleFromQuestionId(id) === "trust",
    );
    const fallbackId = questionIds[0] ?? null;
    setTrustQuestionId(firstTrustId ?? fallbackId);
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
  const trustLikertByCondition = useMemo(
    () =>
      trustQuestionId
        ? computeTrustLikertByCondition(joinedData, trustQuestionId)
        : [],
    [joinedData, trustQuestionId],
  );
  const trustOverTime = useMemo(
    () =>
      trustQuestionId ? computeTrustOverTime(joinedData, trustQuestionId) : [],
    [joinedData, trustQuestionId],
  );
  const trustBySession = useMemo(
    () =>
      trustQuestionId ? computeTrustBySession(joinedData, trustQuestionId) : [],
    [joinedData, trustQuestionId],
  );
  const trustLikertBySession = useMemo(
    () =>
      trustQuestionId ? computeTrustLikertBySession(joinedData, trustQuestionId) : [],
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
  const optimalProximityVsScorePoints = useMemo(
    () => computeOptimalProximityVsScorePoints(filteredSessions, boards),
    [filteredSessions, boards],
  );

  const matchedSurveyCount = useMemo(
    () => joinedData.filter((j) => j.survey !== null).length,
    [joinedData],
  );
  const hasAnyTrustData = trustByCondition.some((s) => s.count > 0);
  const selectedLikertScale = useMemo(
    () => inferLikertScaleFromQuestionId(trustQuestionId),
    [trustQuestionId],
  );

  // Finds the first raw answer value for the selected question across matched surveys.
  // Used to surface what the data actually looks like when trust charts are empty.
  const trustQuestionSampleValue = useMemo(() => {
    if (!trustQuestionId) return undefined;
    for (const { survey } of joinedData) {
      if (!survey) continue;
      const answer = survey.responses.find((r) => r.questionId === trustQuestionId);
      if (answer !== undefined) return answer.value;
    }
    return undefined;
  }, [joinedData, trustQuestionId]);

  const surveyLoaded = surveyResponses.length > 0;
  const anyDataLoaded = sessionsLoaded || surveyLoaded;

  useEffect(() => {
    localStorage.setItem("darts:trust_summary_graph_type", trustSummaryGraphType);
  }, [trustSummaryGraphType]);

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
      <h1>Darts Analysis</h1>
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
          <p style={{ color: "#6b7280", fontSize: 14 }}>
            Loading board surfaces…
          </p>
        </div>
      </div>
    );
  }

  const goToSession = (user_uuid: string, sessionIndex: number) =>
    navigate(`/session/${user_uuid}/${sessionIndex}`);

  return (
    <div className="app">
      {passwordModal}
      <header className="app-header">
        <h1>Darts Analysis</h1>
        {NAV_ITEMS.map(({ path, label }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `nav-tab${isActive ? " nav-tab--active" : ""}`
            }
          >
            {label}
          </NavLink>
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
        <Routes>
          <Route path="/" element={<Navigate to="/sanity" replace />} />

          <Route
            path="/sanity"
            element={
              <section className="dash-section">
                <KpiCards
                  sessions={filteredSessions}
                  surveyResponses={filteredSurveyResponses}
                  completeOnly={completeOnly}
                  onToggleCompleteOnly={() => setCompleteOnly((v) => !v)}
                />
                <div className="chart-row">
                  <SessionCalendar
                    sessions={filteredSessions}
                    onDayClick={(uuids) =>
                      navigate(`/individual?users=${uuids.join(",")}`)
                    }
                  />
                  <ConditionDistribution sessions={filteredSessions} />
                </div>
              </section>
            }
          />

          <Route
            path="/performance"
            element={
              <section className="dash-section">
                <p className="section-note">
                  How game scores vary by AI condition and player trust.
                </p>
                <ScoreByCondition stats={scoreByConditionStats} />
                <ScoreVsSkillScatter
                  points={scoreVsSkillPoints}
                  onSessionClick={goToSession}
                />
                {trustQuestionId && (
                  <TrustVsScore
                    points={trustVsScorePoints}
                    boards={boards}
                    likertScale={selectedLikertScale}
                    onSessionClick={goToSession}
                  />
                )}
                <ProximityVsScore
                  points={proximityVsScorePoints}
                  boards={boards}
                  onSessionClick={goToSession}
                />
                <OptimalProximityVsScore
                  points={optimalProximityVsScorePoints}
                  boards={boards}
                  onSessionClick={goToSession}
                />
              </section>
            }
          />

          <Route
            path="/trust"
            element={
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
                {trustQuestionId && matchedSurveyCount === 0 && joinedData.length > 0 && (
                  <p className="section-note" style={{ color: "#b45309" }}>
                    Sessions loaded but none matched to survey responses. Charts will be empty. Check that both datasets share the same participant IDs.
                  </p>
                )}
                {trustQuestionId && matchedSurveyCount > 0 && !hasAnyTrustData && (
                  <p className="section-note" style={{ color: "#b45309" }}>
                    {matchedSurveyCount} session{matchedSurveyCount !== 1 ? "s" : ""} matched to surveys, but &ldquo;{trustQuestionId}&rdquo; returned no numeric values.
                    {trustQuestionSampleValue === undefined
                      ? " Question ID not found in any matched survey response — the ID in the selector may come from a different survey than the matched ones."
                      : ` First stored value: ${JSON.stringify(trustQuestionSampleValue)} (type: ${typeof trustQuestionSampleValue}). Only numbers, numeric strings, and standard Likert labels are supported.`}
                  </p>
                )}
                {trustQuestionId ? (
                  <>
                    <TrustByCondition
                      stats={trustByCondition}
                      likertStats={trustLikertByCondition}
                      likertScale={selectedLikertScale}
                      graphType={trustSummaryGraphType}
                      onGraphTypeChange={setTrustSummaryGraphType}
                    />
                    <TrustBySession
                      stats={trustBySession}
                      likertStats={trustLikertBySession}
                      likertScale={selectedLikertScale}
                      graphType={trustSummaryGraphType}
                      onGraphTypeChange={setTrustSummaryGraphType}
                    />
                    <div className="chart-row">
                      <TrustOverTime points={trustOverTime} likertScale={selectedLikertScale} />
                      <TrustVsScore points={trustVsScorePoints} boards={boards} likertScale={selectedLikertScale} />
                    </div>
                    <TrustVsTime points={trustVsTimePoints} likertScale={selectedLikertScale} />
                    <TrustVsProximity points={trustVsProximityPoints} likertScale={selectedLikertScale} />
                  </>
                ) : (
                  <p className="section-note">
                    Select Trust or Performance Perception above to load the charts.
                  </p>
                )}
              </section>
            }
          />

          <Route
            path="/luck"
            element={
              <section className="dash-section">
                <p className="section-note">
                  Luck attribution, hit dispersion, and EV gap — charts arrive in
                  the next phase of the survey restructure.
                </p>
              </section>
            }
          />

          <Route
            path="/individual/:uuid?"
            element={
              <IndividualRoute
                sessions={filteredSessions}
                surveys={filteredSurveyResponses}
                joined={joinedData}
                trustQuestionId={trustQuestionId}
                surveyLoaded={surveyLoaded}
                boards={boards}
                likertScale={selectedLikertScale}
              />
            }
          />

          <Route
            path="/session/:uuid/:sessionIndex"
            element={<SessionRoute sessions={filteredSessions} boards={boards} />}
          />
          <Route
            path="/session"
            element={<SessionRoute sessions={filteredSessions} boards={boards} />}
          />

          <Route
            path="/raw"
            element={
              <section className="dash-section">
                <p className="section-note">
                  All sessions and survey responses — unfiltered regardless of the
                  Complete Participants toggle. Click any column header to sort.
                </p>
                <SessionsTable sessions={sessions} boards={boards} />
                <SurveyTable surveys={surveyResponses} />
              </section>
            }
          />

          <Route path="*" element={<Navigate to="/sanity" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;

