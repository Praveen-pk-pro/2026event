import React, { useState, useEffect, useRef } from 'react';
import { TargetStrikeEngine, STORY_CHAPTERS } from '../game/engine';
import { sound } from '../utils/sound';
import { api } from '../services/api';
import { Crosshair, Zap, Play, Trophy, RotateCcw, AlertTriangle, CheckCircle2, ShieldCheck, Flame, KeyRound, Clock, BookOpen, Layers } from 'lucide-react';

const STATES = {
  VERIFY: 'VERIFY',         // Team ID & Access Code entry
  READY: 'READY',           // Briefing & Pre-Game Instructions
  COUNTDOWN: 'COUNTDOWN',   // 3-2-1 match countdown
  PLAYING: 'PLAYING',       // Official 7-minute match active
  SUBMITTING: 'SUBMITTING', // Authoritative server result ingestion
  GAME_OVER: 'GAME_OVER',   // Final score & ranking summary
  ERROR: 'ERROR'
};

export default function GameStation() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  const [gameState, setGameState] = useState(STATES.VERIFY);
  const [countdown, setCountdown] = useState(3);

  // Access inputs
  const [inputTeamCode, setInputTeamCode] = useState('');
  const [inputAccessCode, setInputAccessCode] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('MEDIUM');

  // Active Session info
  const [activeSession, setActiveSession] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loadingVerify, setLoadingVerify] = useState(false);

  // Live HUD
  const [hudStats, setHudStats] = useState({
    score: 0,
    hits: 0,
    misses: 0,
    totalShots: 0,
    combo: 0,
    bestCombo: 0,
    targetsDestroyed: 0,
    accuracy: 0,
    remainingSeconds: 420,
    currentChapter: STORY_CHAPTERS[0]
  });

  // Final Result
  const [finalResult, setFinalResult] = useState(null);

  // Queue pool for operator convenience
  const [queueTeams, setQueueTeams] = useState([]);

  // Check for existing active session on mount (Browser Refresh Recovery)
  useEffect(() => {
    checkCachedSession();
    loadQueue();
    const qInterval = setInterval(loadQueue, 5000);
    return () => clearInterval(qInterval);
  }, []);

  const loadQueue = async () => {
    try {
      const res = await api.getPublicQueue();
      if (res.success && res.data) {
        const pool = [];
        if (res.data.called_team) pool.push(res.data.called_team);
        if (res.data.next_team) pool.push(res.data.next_team);
        if (res.data.upcoming) {
          res.data.upcoming.forEach(t => {
            if (!pool.some(p => p.id === t.id)) pool.push(t);
          });
        }
        setQueueTeams(pool);
      }
    } catch (err) {
      console.warn("Could not poll queue:", err.message);
    }
  };

  const checkCachedSession = async () => {
    const cachedToken = sessionStorage.getItem('active_game_session_token');
    if (!cachedToken) return;

    try {
      const res = await api.getGameSessionStatus(cachedToken);
      if (res.success && res.status === 'PLAYING' && res.remaining_seconds > 0) {
        setSessionToken(cachedToken);
        setActiveSession({
          team_code: res.team_code,
          team_name: res.team_name,
          difficulty: res.difficulty,
          duration_seconds: 420,
          remaining_seconds: res.remaining_seconds
        });
        setHudStats(prev => ({
          ...prev,
          score: res.total_score || 0,
          hits: res.total_hits || 0,
          misses: res.total_misses || 0,
          remainingSeconds: res.remaining_seconds
        }));
        setGameState(STATES.READY);
      } else {
        sessionStorage.removeItem('active_game_session_token');
      }
    } catch (err) {
      sessionStorage.removeItem('active_game_session_token');
    }
  };

  // Verify Team ID & Game Access Code Handshake
  const handleVerifyAndStart = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    const teamCode = inputTeamCode.trim().toUpperCase();
    const accessCode = inputAccessCode.trim().toUpperCase();

    if (!teamCode || !accessCode) {
      setErrorMsg("Please provide both Team ID and Secret Game Access Code.");
      return;
    }

    setLoadingVerify(true);

    try {
      const res = await api.verifyGameAccess(teamCode, accessCode, selectedDifficulty);
      if (res.success) {
        setSessionToken(res.session_token);
        sessionStorage.setItem('active_game_session_token', res.session_token);
        setActiveSession(res);
        setHudStats(prev => ({
          ...prev,
          remainingSeconds: res.remaining_seconds || 420,
          score: res.current_score || 0,
          hits: res.current_hits || 0,
          misses: res.current_misses || 0
        }));
        setGameState(STATES.READY);
      } else {
        setErrorMsg(res.error || "Verification failed.");
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to verify game access credentials.");
    } finally {
      setLoadingVerify(false);
    }
  };

  // Start 3-2-1 Countdown
  const launchCountdown = () => {
    setGameState(STATES.COUNTDOWN);
    setCountdown(3);
    sound.playCountdown();

    let count = 3;
    const timer = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
        sound.playCountdown();
      } else if (count === 0) {
        setCountdown("STRIKE!");
        sound.playLaser();
      } else {
        clearInterval(timer);
        startOfficialGame();
      }
    }, 1000);
  };

  // Start Official 7-Minute Game Loop
  const startOfficialGame = () => {
    setGameState(STATES.PLAYING);

    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = canvas.parentElement.clientWidth || 960;
    canvas.height = Math.min(580, window.innerHeight - 240);

    const engine = new TargetStrikeEngine(canvas, {
      difficulty: activeSession?.difficulty || selectedDifficulty,
      durationSeconds: 420, // Official 7-minute match
      remainingSeconds: activeSession?.remaining_seconds !== undefined ? activeSession.remaining_seconds : 420,
      initialScore: activeSession?.current_score || 0,
      initialHits: activeSession?.current_hits || 0,
      initialMisses: activeSession?.current_misses || 0,
      onScoreUpdate: (stats) => {
        setHudStats(stats);
      },
      onGameOver: (telemetry) => {
        handleOfficialGameEnd(telemetry);
      }
    });

    engineRef.current = engine;
    engine.start();
  };

  // Handle Game End & Submit Telemetry to Server
  const handleOfficialGameEnd = async (telemetry) => {
    setGameState(STATES.SUBMITTING);

    try {
      const payload = {
        session_token: sessionToken,
        ...telemetry
      };

      const res = await api.submitGameSession(payload);
      if (res.success) {
        setFinalResult(res);
        sessionStorage.removeItem('active_game_session_token');
        setGameState(STATES.GAME_OVER);
      } else {
        setErrorMsg(res.error || "Server validation rejected submission.");
        setGameState(STATES.ERROR);
      }
    } catch (err) {
      setErrorMsg(err.message || "Network error occurred during result submission.");
      setGameState(STATES.ERROR);
    }
  };

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-5xl w-full">

        {/* 1. VERIFICATION VIEW (Team ID & Game Access Code) */}
        {gameState === STATES.VERIFY && (
          <div className="max-w-xl mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono uppercase tracking-widest mb-3">
                <Crosshair className="w-3.5 h-3.5" />
                <span>AI Target Strike Game Station</span>
              </div>
              <h1 className="text-3xl font-black font-display tracking-tight text-white mb-1">
                GAME ACCESS VERIFICATION
              </h1>
              <p className="text-slate-400 text-xs">
                Enter your official Team ID and secret Game Access Code to authorize your 7-minute competition session.
              </p>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Quick-Pick Called Team (Operator Convenience) */}
            {queueTeams.length > 0 && (
              <div className="mb-5 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="text-[10px] font-mono uppercase text-slate-400 tracking-wider mb-2">
                  Live Queue Quick-Select:
                </div>
                <div className="flex flex-wrap gap-2">
                  {queueTeams.slice(0, 4).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setInputTeamCode(t.team_code)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition ${
                        inputTeamCode === t.team_code
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                          : 'bg-slate-900 border-slate-700/80 hover:border-slate-600 text-slate-300'
                      }`}
                    >
                      {t.team_code} • {t.team_name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleVerifyAndStart} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-300 mb-1.5">
                  Official Team ID *
                </label>
                <input
                  type="text"
                  value={inputTeamCode}
                  onChange={(e) => setInputTeamCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ATS-0001"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-base placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition tracking-wider"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-300 mb-1.5">
                  Secret Game Access Code *
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={inputAccessCode}
                    onChange={(e) => setInputAccessCode(e.target.value.toUpperCase())}
                    placeholder="e.g. ATS-K7M9-P2QX"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-base placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition tracking-widest"
                  />
                  <KeyRound className="w-4 h-4 text-slate-500 absolute right-4 top-3.5" />
                </div>
              </div>

              {/* Difficulty Selection */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-300 mb-1.5">
                  Competition Difficulty
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['EASY', 'MEDIUM', 'HARD'].map((diff) => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setSelectedDifficulty(diff)}
                      className={`py-2 rounded-xl text-xs font-mono font-bold transition border ${
                        selectedDifficulty === diff
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm shadow-cyan-500/20'
                          : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loadingVerify}
                className="w-full mt-3 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-cyan-500/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loadingVerify ? (
                  <span>AUTHENTICATING ACCESS CODE...</span>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>VERIFY CODE & OPEN GAME BRIEFING</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* 2. READY & BRIEFING SCREEN */}
        {gameState === STATES.READY && activeSession && (
          <div className="max-w-2xl mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            <div className="text-center mb-6">
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono uppercase font-bold tracking-wider">
                ACCESS AUTHORIZED
              </span>
              <h2 className="text-3xl font-black font-display tracking-tight text-white mt-2 mb-1">
                {activeSession.team_name}
              </h2>
              <div className="text-cyan-400 font-mono text-sm">
                TEAM ID: {activeSession.team_code} • {activeSession.difficulty} DIFFICULTY
              </div>
            </div>

            {/* Match Information */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" /> Official Session
                </div>
                <div className="text-2xl font-black text-white font-mono">
                  {formatTime(activeSession.remaining_seconds || 420)}
                </div>
                <div className="text-[10px] text-slate-400">7 Minutes Duration</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-400" /> Story Mode
                </div>
                <div className="text-2xl font-black text-indigo-300 font-mono">
                  3 CHAPTERS
                </div>
                <div className="text-[10px] text-slate-400">Dynamic Multi-Target Spawns</div>
              </div>
            </div>

            {/* 2-Player Controls Guide */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 mb-6 space-y-3">
              <div className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold border-b border-slate-800 pb-2">
                Simultaneous 2-Player Controller Assignment:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-900 border border-cyan-500/30">
                  <div className="text-xs font-bold text-cyan-400 flex items-center gap-1.5 mb-1">
                    <Crosshair className="w-4 h-4" />
                    <span>PLAYER 1: AIM CONTROL</span>
                  </div>
                  <div className="text-xs text-slate-300 font-mono">
                    Keys: <span className="text-cyan-300 font-bold">W A S D</span>
                  </div>
                  <div className="text-[11px] text-slate-400">Smooth omnidirectional crosshair aim</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-indigo-500/30">
                  <div className="text-xs font-bold text-indigo-400 flex items-center gap-1.5 mb-1">
                    <Zap className="w-4 h-4" />
                    <span>PLAYER 2: SHOOT CONTROL</span>
                  </div>
                  <div className="text-xs text-slate-300 font-mono">
                    Key: <span className="text-indigo-300 font-bold">SPACEBAR</span>
                  </div>
                  <div className="text-[11px] text-slate-400">Precision hitscan firing & combo chains</div>
                </div>
              </div>
            </div>

            <button
              onClick={launchCountdown}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white font-extrabold text-base tracking-wide shadow-xl shadow-cyan-500/20 transition flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>START 7-MINUTE COMPETITION SESSION</span>
            </button>
          </div>
        )}

        {/* 3. 3-2-1 COUNTDOWN */}
        {gameState === STATES.COUNTDOWN && (
          <div className="min-h-[500px] flex flex-col items-center justify-center text-center">
            <div className="text-sm font-mono uppercase tracking-widest text-cyan-400 mb-4 animate-pulse">
              GET READY • TARGET STRIKE IMMINENT
            </div>
            <div className="text-8xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400 scale-125 transition-transform duration-300">
              {countdown}
            </div>
          </div>
        )}

        {/* 4. OFFICIAL PLAYING SCREEN */}
        {gameState === STATES.PLAYING && (
          <div className="space-y-3">
            {/* Top HUD Bar */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
              {/* Team Info & Chapter */}
              <div>
                <div className="text-[10px] font-mono text-cyan-400 font-semibold tracking-wider">
                  {activeSession?.team_code} • {activeSession?.difficulty}
                </div>
                <div className="text-lg font-black text-white leading-tight">
                  {activeSession?.team_name}
                </div>
              </div>

              {/* 7-MINUTE TIMER DISPLAY */}
              <div className="px-5 py-2 rounded-xl bg-slate-950 border border-cyan-500/40 text-center shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                <div className="text-[10px] font-mono uppercase text-slate-400 tracking-wider flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3 text-cyan-400" /> Match Clock
                </div>
                <div className={`text-2xl font-black font-mono tracking-widest ${
                  hudStats.remainingSeconds <= 30 ? 'text-rose-400 animate-pulse' : 'text-cyan-300'
                }`}>
                  {formatTime(hudStats.remainingSeconds)}
                </div>
              </div>

              {/* Real-Time Stats Counters */}
              <div className="flex items-center gap-4 text-right">
                <div>
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Score</div>
                  <div className="text-2xl font-black text-emerald-400 font-mono">
                    {hudStats.score}
                  </div>
                </div>

                <div className="border-l border-slate-800 pl-4">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Accuracy</div>
                  <div className="text-base font-bold text-sky-400 font-mono">
                    {hudStats.accuracy}%
                  </div>
                </div>

                {hudStats.combo > 1 && (
                  <div className="border-l border-slate-800 pl-4">
                    <div className="text-[10px] font-mono text-amber-400 uppercase flex items-center gap-1">
                      <Flame className="w-3 h-3" /> Combo
                    </div>
                    <div className="text-base font-bold text-amber-300 font-mono">
                      {hudStats.combo}x
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Game Canvas Viewport */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950 flex items-center justify-center">
              <canvas
                ref={canvasRef}
                className="w-full h-auto cursor-none select-none block"
              />
            </div>

            {/* Bottom Controls Legend */}
            <div className="flex items-center justify-between text-xs text-slate-400 px-2 font-mono">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold">P1 AIM: WASD</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-bold">P2 FIRE: SPACE</span>
              </div>
              <div>
                Hits: <span className="text-white font-bold">{hudStats.hits}</span> / Shots: <span className="text-white font-bold">{hudStats.totalShots}</span>
              </div>
            </div>
          </div>
        )}

        {/* 5. SUBMITTING TELEMETRY */}
        {gameState === STATES.SUBMITTING && (
          <div className="min-h-[400px] flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-12 h-12 border-3 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin"></div>
            <div className="text-lg font-bold font-mono text-white">
              VERIFYING & RECORDING OFFICIAL SCORE...
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Validating hitscan telemetry with server anti-cheat engine...
            </div>
          </div>
        )}

        {/* 6. GAME OVER / RESULT SUMMARY */}
        {gameState === STATES.GAME_OVER && finalResult && (
          <div className="max-w-xl mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl text-center relative overflow-hidden">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-amber-400">
              <Trophy className="w-8 h-8" />
            </div>

            <div className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-bold mb-1">
              OFFICIAL MATCH CONCLUDED
            </div>
            <h2 className="text-3xl font-black font-display text-white mb-1">
              {finalResult.team_name}
            </h2>
            <div className="text-xs text-slate-400 font-mono mb-6">
              {finalResult.team_code} • Current Leaderboard Rank: #{finalResult.rank}
            </div>

            {/* Scorecard */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 border border-slate-800 rounded-2xl p-4 mb-6">
              <div>
                <div className="text-[10px] text-slate-400 font-mono uppercase">Final Score</div>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  {finalResult.official_result?.score}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-slate-400 font-mono uppercase">Accuracy</div>
                <div className="text-2xl font-black text-sky-400 font-mono">
                  {finalResult.official_result?.accuracy}%
                </div>
              </div>

              <div>
                <div className="text-[10px] text-slate-400 font-mono uppercase">Targets Hit</div>
                <div className="text-2xl font-black text-white font-mono">
                  {finalResult.official_result?.hits}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-slate-400 font-mono uppercase">Best Streak</div>
                <div className="text-2xl font-black text-amber-400 font-mono">
                  {finalResult.official_result?.best_combo}x
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setGameState(STATES.VERIFY);
                  setActiveSession(null);
                  setSessionToken(null);
                  setInputTeamCode('');
                  setInputAccessCode('');
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Next Team Game Access</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
