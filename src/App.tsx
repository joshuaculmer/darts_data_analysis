import { useState, useCallback, useMemo } from "react";
import { loadGameSessions, loadSurveyResponses } from "./loaders/loadData";
import type {
  ParsedGameSession,
  ParsedSurveyResponse,
} from "./loaders/loadData";
// import {
//   computeConditionStats,
//   computeScatterPoints,
//   computeUserConditionAverages,
// } from "./utils/stats";
import { computeScoreVsSkillPoints } from "./utils/scoreStats";
import {
  joinSessionsWithSurvey,
  computeTrustByCondition,
  computeTrustOverTime,
  computeTrustVsScorePoints,
} from "./utils/surveyStats";
import { KpiCards } from "./components/phase1/KpiCards";
import { SessionCalendar } from "./components/phase1/SessionCalendar";
import { ConditionDistribution } from "./components/phase1/ConditionDistribution";
// import { ConditionBoxPlot } from "./components/phase2/ConditionBoxPlot";
// import { ConditionMeanBar } from "./components/phase2/ConditionMeanBar";
// import { ExecutionSkillScatter } from "./components/phase2/ExecutionSkillScatter";
// import { PairedSlopeChart } from "./components/phase2/PairedSlopeChart";
import { ScoreVsSkillScatter } from "./components/performance/ScoreVsSkillScatter";
import { TrustQuestionSelector } from "./components/trust/TrustQuestionSelector";
import { TrustByCondition } from "./components/trust/TrustByCondition";
import { TrustOverTime } from "./components/trust/TrustOverTime";
import { TrustVsScore } from "./components/trust/TrustVsScore";
import { IndividualView } from "./components/individual/IndividualView";
import "./App.css";

type NavSection = "sanity" | "performance" | "trust" | "individual" | "raw";

const NAV_ITEMS: { id: NavSection; label: string }[] = [
  { id: "sanity", label: "Sanity Checks" },
  { id: "performance", label: "Game Performance" },
  { id: "trust", label: "Trust & Influence" },
  { id: "individual", label: "Individual View" },
  { id: "raw", label: "Raw Data" },
];

function SurveyRequiredPlaceholder({
  onLoad,
}: {
  onLoad: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="survey-placeholder">
      <p>This chart requires the post-session survey CSV.</p>
      <label className="upload-btn upload-btn--small">
        Load survey CSV
        <input type="file" accept=".csv" onChange={onLoad} hidden />
      </label>
    </div>
  );
}

function App() {
  const [sessions, setSessions] = useState<ParsedGameSession[]>([]);
  const [surveyResponses, setSurveyResponses] = useState<
    ParsedSurveyResponse[]
  >([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [activeSection, setActiveSection] = useState<NavSection>("sanity");
  const [trustQuestionId, setTrustQuestionId] = useState<string | null>(null);

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

  // const conditionStats = useMemo(
  //   () => computeConditionStats(sessions),
  //   [sessions],
  // );
  // const scatterPoints = useMemo(
  //   () => computeScatterPoints(sessions),
  //   [sessions],
  // );
  // const userConditionRows = useMemo(
  //   () => computeUserConditionAverages(sessions),
  //   [sessions],
  // );
  const scoreVsSkillPoints = useMemo(
    () => computeScoreVsSkillPoints(sessions),
    [sessions],
  );
  const joinedData = useMemo(
    () => joinSessionsWithSurvey(sessions, surveyResponses),
    [sessions, surveyResponses],
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
        ? computeTrustVsScorePoints(joinedData, trustQuestionId)
        : [],
    [joinedData, trustQuestionId],
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
            <p className="section-note">
              Balance and administration checks — verify the study ran as
              expected. These are not research findings.
            </p>
            <KpiCards sessions={sessions} />
            <div className="chart-row">
              <SessionCalendar sessions={sessions} />
              <ConditionDistribution sessions={sessions} />
            </div>
          </section>
        )}

        {activeSection === "performance" && (
          <section className="dash-section">
            <p className="section-note">
              How game scores vary by AI condition and player trust.
            </p>
            {/* <ConditionBoxPlot stats={conditionStats} />
            <ConditionMeanBar stats={conditionStats} />
            <div className="chart-row">
              <ExecutionSkillScatter points={scatterPoints} />
              <PairedSlopeChart rows={userConditionRows} />
            </div> */}
            <ScoreVsSkillScatter points={scoreVsSkillPoints} />
            {surveyLoaded && trustQuestionId && (
              <TrustVsScore points={trustVsScorePoints} />
            )}
            {!surveyLoaded && (
              <SurveyRequiredPlaceholder onLoad={handleSurveyFile} />
            )}
          </section>
        )}

        {activeSection === "trust" && (
          <section className="dash-section">
            <p className="section-note">
              How much participants trusted the AI, how condition shaped that
              trust, and whether trust translated into better scores.
            </p>
            {surveyLoaded ? (
              <>
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
              </>
            ) : (
              <SurveyRequiredPlaceholder onLoad={handleSurveyFile} />
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
              sessions={sessions}
              joined={joinedData}
              trustQuestionId={trustQuestionId}
              surveyLoaded={surveyLoaded}
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
            {surveyLoaded ? (
              <div className="chart-card">
                <h2>Survey Responses Table</h2>
                <p className="coming-soon">Coming soon</p>
              </div>
            ) : (
              <SurveyRequiredPlaceholder onLoad={handleSurveyFile} />
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;

