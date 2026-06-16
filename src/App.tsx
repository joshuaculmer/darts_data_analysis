import { useState, useCallback, useMemo, useEffect, lazy, Suspense } from "react";
import {
  Routes,
  Route,
  Navigate,
  NavLink,
  useNavigate,
  useParams,
  useSearchParams,
  useLocation,
} from "react-router-dom";
import { loadGameSessions, loadSurveyResponses } from "./loaders/loadData";
import type {
  ParsedGameSession,
  ParsedSurveyResponse,
} from "./loaders/loadData";
import { fetchData, isSupabaseConfigured } from "./loaders/fetchSupabase";
import { loadBoards } from "./loaders/loadBoards";
import { loadEvGrids } from "./loaders/loadEvGrids";
import type { EvGrids } from "./loaders/loadEvGrids";
import type { RewardSurface } from "./types/dart";
import { getCompleteUserIds } from "./utils/stats";
import { joinSessionsWithSurvey } from "./utils/surveyStats";
import { getDimension } from "./utils/surveyScales";
import type { JoinedSessionSurvey } from "./utils/surveyStats";
import { buildSessionVariableRows, VARIABLE_KEYS } from "./utils/variables";
import { computeCorrelationMatrix } from "./utils/correlation";
import { KpiCards } from "./components/sanity/KpiCards";
import { SessionCalendar } from "./components/sanity/SessionCalendar";
import { ConditionDistribution } from "./components/sanity/ConditionDistribution";
import { Spinner } from "./components/Spinner";
import "./App.css";

// Heavy pages (Recharts subtrees, the Raw Data tables) are code-split so they
// only load when first visited. The Suspense fallback below shows the spinner.
const TrustGroup = lazy(() =>
  import("./components/trust/TrustGroup").then((m) => ({ default: m.TrustGroup })),
);
const PerformanceGroup = lazy(() =>
  import("./components/performance/PerformanceGroup").then((m) => ({ default: m.PerformanceGroup })),
);
const LuckGroup = lazy(() =>
  import("./components/luck/LuckGroup").then((m) => ({ default: m.LuckGroup })),
);
const RawDataPage = lazy(() =>
  import("./components/raw/RawDataPage").then((m) => ({ default: m.RawDataPage })),
);
const IndividualView = lazy(() =>
  import("./components/individual/IndividualView").then((m) => ({ default: m.IndividualView })),
);
const SessionView = lazy(() =>
  import("./components/session/SessionView").then((m) => ({ default: m.SessionView })),
);

const NAV_ITEMS: { path: string; label: string }[] = [
  { path: "/sanity", label: "Sanity Checks" },
  { path: "/performance", label: "Game Performance" },
  { path: "/trust", label: "Trust & Influence" },
  { path: "/luck", label: "Luck" },
  { path: "/individual", label: "Individual View" },
  { path: "/session", label: "Session View" },
  { path: "/raw", label: "Raw Data" },
];

// Route wrapper that reads :uuid / :sessionIndex from the URL. Defined at module
// scope (not inline) so SessionView keeps its internal state across renders.
function SessionRoute({
  sessions,
  boards,
  evGrids,
}: {
  sessions: ParsedGameSession[];
  boards: Map<number, RewardSurface>;
  evGrids: EvGrids;
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
        evGrids={evGrids}
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
}: {
  sessions: ParsedGameSession[];
  surveys: ParsedSurveyResponse[];
  joined: JoinedSessionSurvey[];
  trustQuestionId: string | null;
  surveyLoaded: boolean;
  boards: Map<number, RewardSurface>;
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
      />
    </section>
  );
}

// Shows the loading spinner whenever the top-level section changes, then defers
// mounting the new page until the spinner has painted (double rAF). This makes
// the heavy synchronous render of a page (e.g. a Recharts group page) happen
// *behind* an already-visible spinner instead of freezing the UI. Keyed on the
// first path segment so navigating within a section (e.g. session pills under
// /session/:uuid/:idx) does NOT flash a spinner or remount the view.
function RouteSpinnerGate({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const section = pathname.split("/")[1] ?? "";
  const [renderedSection, setRenderedSection] = useState(section);
  const [ready, setReady] = useState(true);

  // Adjust-state-during-render: when the section changes, switch to the spinner
  // in this same render pass so it paints before the new page mounts.
  if (section !== renderedSection) {
    setRenderedSection(section);
    setReady(false);
  }

  useEffect(() => {
    if (ready) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [ready]);

  if (!ready) {
    return (
      <section className="dash-section" style={{ padding: "48px 0" }}>
        <Spinner label="Loading…" />
      </section>
    );
  }
  return <>{children}</>;
}

function App() {
  const [sessions, setSessions] = useState<ParsedGameSession[]>([]);
  const [surveyResponses, setSurveyResponses] = useState<
    ParsedSurveyResponse[]
  >([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [boards, setBoards] = useState<Map<number, RewardSurface>>(new Map());
  const [boardsLoaded, setBoardsLoaded] = useState(false);
  const [evGrids, setEvGrids] = useState<EvGrids>(new Map());
  const [trustQuestionId, setTrustQuestionId] = useState<string | null>(null);
  const [completeOnly, setCompleteOnly] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const navigate = useNavigate();
  const [passwordInput, setPasswordInput] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showSpinnerEgg, setShowSpinnerEgg] = useState(false);

  // Easter egg: typing "spinner" anywhere (outside a text field) overlays the
  // loading spinner on top of whatever is rendered; Escape dismisses it.
  useEffect(() => {
    let buffer = "";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowSpinnerEgg(false);
        return;
      }
      // Ignore typing inside inputs/textareas/selects so filters aren't hijacked.
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) {
        return;
      }
      if (e.key.length !== 1 || !/[a-z]/i.test(e.key)) return;
      buffer = (buffer + e.key.toLowerCase()).slice(-7);
      if (buffer === "spinner") {
        setShowSpinnerEgg(true);
        buffer = "";
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
    setEvGrids(new Map());
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
      (id) => getDimension(id)?.group === "trust",
    );
    const fallbackId = questionIds[0] ?? null;
    setTrustQuestionId(firstTrustId ?? fallbackId);
  }, [surveyResponses]);

  // Load board surfaces + EV grids once both CSVs are ready
  useEffect(() => {
    if (!sessionsLoaded || surveyResponses.length === 0) return;
    setBoardsLoaded(false);
    Promise.all([loadBoards(sessions), loadEvGrids(sessions)]).then(
      ([loadedBoards, loadedEvGrids]) => {
        setBoards(loadedBoards);
        setEvGrids(loadedEvGrids);
        setBoardsLoaded(true);
      },
    );
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

  const joinedData = useMemo(
    () => joinSessionsWithSurvey(filteredSessions, filteredSurveyResponses),
    [filteredSessions, filteredSurveyResponses],
  );
  // Unified session-level variable rows + the global Spearman correlation matrix,
  // computed once and shared across all three group pages (Trust/Performance/Luck).
  const variableRows = useMemo(
    () => buildSessionVariableRows(joinedData, boards, evGrids),
    [joinedData, boards, evGrids],
  );
  const correlationMatrix = useMemo(
    () => computeCorrelationMatrix(variableRows, VARIABLE_KEYS),
    [variableRows],
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

  const spinnerEgg = showSpinnerEgg && (
    <div
      className="modal-overlay"
      onClick={() => setShowSpinnerEgg(false)}
      style={{ cursor: "pointer" }}
    >
      <Spinner label="Press Esc to close" />
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
        {spinnerEgg}
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
        {spinnerEgg}
        {appHeader}
        <div className="upload-screen">
          <Spinner label="Loading board surfaces and EV grids…" />
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {spinnerEgg}
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
        <Suspense
          fallback={
            <section className="dash-section" style={{ padding: "48px 0" }}>
              <Spinner label="Loading…" />
            </section>
          }
        >
        <RouteSpinnerGate>
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
              <PerformanceGroup joined={joinedData} variableRows={variableRows} matrix={correlationMatrix} />
            }
          />

          <Route
            path="/trust"
            element={
              <TrustGroup joined={joinedData} variableRows={variableRows} matrix={correlationMatrix} />
            }
          />

          <Route
            path="/luck"
            element={
              <LuckGroup joined={joinedData} variableRows={variableRows} matrix={correlationMatrix} />
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
              />
            }
          />

          <Route
            path="/session/:uuid/:sessionIndex"
            element={<SessionRoute sessions={filteredSessions} boards={boards} evGrids={evGrids} />}
          />
          <Route
            path="/session"
            element={<SessionRoute sessions={filteredSessions} boards={boards} evGrids={evGrids} />}
          />

          <Route
            path="/raw"
            element={
              <RawDataPage
                sessions={filteredSessions}
                surveys={filteredSurveyResponses}
                boards={boards}
                evGrids={evGrids}
                variableRows={variableRows}
                completeOnly={completeOnly}
                onToggleCompleteOnly={() => setCompleteOnly((v) => !v)}
              />
            }
          />

          <Route path="*" element={<Navigate to="/sanity" replace />} />
        </Routes>
        </RouteSpinnerGate>
        </Suspense>
      </main>
    </div>
  );
}

export default App;

