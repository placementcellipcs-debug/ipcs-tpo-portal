import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Brain, Check, CheckCircle, Clock, Fire, Lightbulb, Sparkle, Trophy, X } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../layouts/Layout';
import './BrainGym.css';

const STORE_KEY = 'ipcs-mind-gym-v1';
const PILLARS = ['Memory', 'Attention', 'Language', 'Math', 'Speed', 'Flexibility', 'Problem Solving'];
const GAMES = [
  { id: 'pinpoint', title: 'Pinpoint', pillar: 'Language', kind: 'Word association', description: 'Find the one idea that connects five clues. Earlier guesses earn more points.', color: 'violet', icon: '✳' },
  { id: 'crossclimb', title: 'Crossclimb', pillar: 'Language', kind: 'Word ladder', description: 'Build a ladder by changing exactly one letter at each step.', color: 'blue', icon: '↟' },
  { id: 'queens', title: 'Queens', pillar: 'Problem Solving', kind: 'Logic grid', description: 'Place one crown in every row, column, and colored region. Crowns cannot touch.', color: 'rose', icon: '♛' },
  { id: 'tango', title: 'Tango', pillar: 'Flexibility', kind: 'Pattern logic', description: 'Balance suns and moons, avoid triples, and follow the relation clues.', color: 'amber', icon: '☯' },
  { id: 'zip', title: 'Zip', pillar: 'Problem Solving', kind: 'Pathfinding', description: 'Trace one continuous path through every cell and visit checkpoints in order.', color: 'cyan', icon: '⌁' },
  { id: 'sudoku', title: 'Mini Sudoku', pillar: 'Math', kind: 'Number logic', description: 'Complete the 6 × 6 grid with no repeats in any row, column, or box.', color: 'green', icon: '▦' },
  { id: 'patches', title: 'Patches', pillar: 'Problem Solving', kind: 'Spatial tiling', description: 'Fit every fixed-orientation piece onto the board without gaps or overlaps.', color: 'orange', icon: '⬚' },
  { id: 'wend', title: 'Wend', pillar: 'Attention', kind: 'Word paths', description: 'Trace each word through neighboring letters and use every tile once.', color: 'teal', icon: '⌘' },
  { id: 'memory', title: 'Memory Board', pillar: 'Memory', kind: 'Recall', description: 'Remember a flashing tile pattern, then tap it back exactly.', color: 'indigo', icon: '▤' },
  { id: 'stroop', title: 'Color Clash', pillar: 'Attention', kind: 'Selective focus', description: 'Ignore the word and choose the color of its ink.', color: 'pink', icon: '◉' },
  { id: 'quickmath', title: 'Quick Math', pillar: 'Math', kind: 'Mental arithmetic', description: 'Decide whether each rapid equation is true or false.', color: 'lime', icon: '±' },
  { id: 'rapidmatch', title: 'Rapid Match', pillar: 'Speed', kind: 'Processing speed', description: 'Compare each symbol with the one immediately before it.', color: 'purple', icon: '⇄' },
  { id: 'sorting', title: 'Sorting Shift', pillar: 'Flexibility', kind: 'Task switching', description: 'Switch sorting rules between shape and color as the prompt changes.', color: 'gold', icon: '⤨' },
];

const PINPOINTS = [
  { clues: ['Mercury', 'A feather', 'A sprinter', 'A courier', 'Fast'], answer: ['speed', 'fastness', 'quickness'] },
  { clues: ['A key', 'A map', 'A hint', 'A compass', 'Guidance'], answer: ['direction', 'guidance', 'help'] },
  { clues: ['A seed', 'A spark', 'A first step', 'A sketch', 'Beginning'], answer: ['start', 'beginning', 'origin', 'potential'] },
  { clues: ['A mirror', 'An echo', 'A twin', 'A shadow', 'Reflection'], answer: ['reflection', 'copy', 'image'] },
  { clues: ['A thread', 'A bridge', 'A handshake', 'A shared goal', 'Connection'], answer: ['connection', 'link', 'bond'] },
  { clues: ['A lens', 'A filter', 'A spotlight', 'A magnifier', 'Focus'], answer: ['focus', 'attention', 'concentration'] },
  { clues: ['A hinge', 'A fork', 'A pivot', 'A new route', 'Change'], answer: ['change', 'flexibility', 'shift'] },
];
const WEND_WORD_SETS = [
  ['MIND', 'GAME', 'PLAY', 'WARM'], ['IDEA', 'WORD', 'PATH', 'FIND'], ['CALM', 'MIND', 'PLAY', 'MOVE'],
];
const SYMBOLS = ['◆', '●', '▲', '✦', '⬟', '■'];
const COLORS = [
  { name: 'Red', value: '#fb7185' }, { name: 'Blue', value: '#60a5fa' },
  { name: 'Green', value: '#34d399' }, { name: 'Gold', value: '#fbbf24' },
];
const SUDOKU_SOLUTION = Array.from({ length: 6 }, (_, row) => Array.from({ length: 6 }, (_, col) => ((row % 2) * 3 + Math.floor(row / 2) + col) % 6 + 1));
const QUEEN_SOLUTION = [1, 3, 5, 0, 2, 4];
const CROSSCLIMB_LADDER = ['COLD', 'CORD', 'CARD', 'WARD', 'WORD'];
const TANGO_PATTERN = [[0, 0, 1, 1, 0, 1], [1, 1, 0, 0, 1, 0], [0, 0, 1, 1, 0, 1], [1, 1, 0, 0, 1, 0], [0, 0, 1, 1, 0, 1], [1, 1, 0, 0, 1, 0]];
const TANGO_RELATIONS = [[0, 0, 0, 1, '='], [2, 2, 2, 3, '='], [4, 0, 4, 1, '='], [0, 4, 1, 4, '×'], [2, 0, 3, 0, '×'], [4, 5, 5, 5, '×']];

function localDayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function normalize(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function seededNumber(seed, index = 0) {
  let value = 2166136261;
  for (const char of `${seed}:${index}`) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return (value >>> 0) / 4294967296;
}
function shuffle(list, seed = '') {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(seededNumber(seed, i) * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}
function loadProfile(key) {
  try {
    const profile = JSON.parse(localStorage.getItem(key) || '{}');
    return { xp: 0, streak: 0, bestStreak: 0, lastCircuit: '', games: {}, pillars: {}, ...profile };
  } catch { return { xp: 0, streak: 0, bestStreak: 0, lastCircuit: '', games: {}, pillars: {} }; }
}
function weekdayLevel(date) { return date.getDay() === 0 ? 5 : Math.min(5, date.getDay()); }
function targetCircuit(date) {
  const seed = localDayKey(date);
  const offset = Math.floor(seededNumber(seed) * GAMES.length);
  return Array.from({ length: 5 }, (_, index) => GAMES[(offset + index * 2) % GAMES.length].id);
}
function oneLetterApart(first, second) {
  if (first.length !== second.length) return false;
  let differences = 0;
  for (let index = 0; index < first.length; index += 1) if (first[index] !== second[index]) differences += 1;
  return differences === 1;
}
function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }

export default function BrainGym() {
  const navigate = useNavigate();
  const profileKey = useMemo(() => {
    try {
      const user = JSON.parse(localStorage.getItem('tpoData') || '{}');
      return `${STORE_KEY}:${normalize(user.email || user.loginId || user.empId || user.name || 'staff')}`;
    } catch { return `${STORE_KEY}:staff`; }
  }, []);
  const [profile, setProfile] = useState(() => loadProfile(profileKey));
  const [activeGame, setActiveGame] = useState('');
  const [circuit, setCircuit] = useState(null);
  const [circuitIndex, setCircuitIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState('');
  const [today, setToday] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setToday(new Date()), 60_000); return () => window.clearInterval(timer); }, []);
  const todayKey = localDayKey(today);
  const circuitGames = useMemo(() => targetCircuit(today), [today]);
  const dailyProgress = circuitGames.filter(id => profile.games[id]?.lastPlayed === todayKey).length;

  useEffect(() => { localStorage.setItem(profileKey, JSON.stringify(profile)); }, [profile, profileKey]);
  useEffect(() => {
    if (!circuit) return undefined;
    const timer = window.setInterval(() => setElapsed(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [circuit]);

  const beginCircuit = () => {
    if (profile.lastCircuit === todayKey) { setNotice('Today’s circuit is already complete. Pick any game for another round.'); return; }
    setCircuit(circuitGames);
    setCircuitIndex(0);
    setElapsed(0);
    setActiveGame(circuitGames[0]);
    setNotice('');
  };
  const playGame = id => { setCircuit(null); setActiveGame(id); setNotice(''); };
  const exitGame = () => { setActiveGame(''); setCircuit(null); setNotice(''); };

  const recordResult = (gameId, result) => {
    const nowKey = localDayKey();
    setProfile(previous => {
      const before = previous.games[gameId] || { plays: 0, wins: 0, streak: 0, level: weekdayLevel(new Date()), best: 0, lastPlayed: '' };
      const consecutiveWins = result.won ? before.streak + 1 : 0;
      const level = clamp(before.level + (consecutiveWins > 0 && consecutiveWins % 3 === 0 ? 1 : result.won ? 0 : -1), weekdayLevel(new Date()), 5);
      const gameStats = {
        ...before, plays: before.plays + 1, wins: before.wins + (result.won ? 1 : 0), streak: consecutiveWins,
        level, best: Math.max(before.best || 0, result.score || 0), lastPlayed: nowKey,
      };
      const pillarBefore = previous.pillars[result.pillar] || { attempts: 0, wins: 0, points: 0 };
      const pillarStats = { ...pillarBefore, attempts: pillarBefore.attempts + 1, wins: pillarBefore.wins + (result.won ? 1 : 0), points: pillarBefore.points + (result.score || 0) };
      const games = { ...previous.games, [gameId]: gameStats };
      const pillars = { ...previous.pillars, [result.pillar]: pillarStats };
      const circuitDone = circuit && circuit.every(id => games[id]?.lastPlayed === nowKey);
      let streak = previous.streak;
      let lastCircuit = previous.lastCircuit;
      let bonus = 0;
      if (circuitDone && previous.lastCircuit !== nowKey) {
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        streak = previous.lastCircuit === localDayKey(yesterday) ? streak + 1 : 1;
        lastCircuit = nowKey;
        bonus = 50;
      }
      return { ...previous, games, pillars, streak, bestStreak: Math.max(previous.bestStreak, streak), lastCircuit, xp: previous.xp + Math.max(5, result.score || 0) + (result.won ? 15 : 0) + bonus };
    });
  };

  const game = GAMES.find(item => item.id === activeGame);
  const gameLevel = game ? Math.round(clamp(Math.max(weekdayLevel(today), profile.games[game.id]?.level || 1), 1, 5)) : weekdayLevel(today);
  const wins = Object.values(profile.games).reduce((total, item) => total + (item.wins || 0), 0);
  const attempts = Object.values(profile.games).reduce((total, item) => total + (item.plays || 0), 0);
  const personalScore = attempts ? Math.round((wins / attempts) * 100) : 0;
  const badges = [
    { name: 'First spark', hint: 'Finish a challenge', earned: wins > 0 },
    { name: 'Daily rhythm', hint: 'Reach a 3-day streak', earned: profile.bestStreak >= 3 },
    { name: 'XP collector', hint: 'Earn 500 Mind XP', earned: profile.xp >= 500 },
  ];

  return (
    <Layout>
      <main className="mind-gym page-container">
        <header className="gamepal-page-header"><span>DAILY BRAIN GAMES</span><h1>GamePal</h1><p>A five-minute reset for focus, recall, language, and logic.</p></header>
        {activeGame ? <GameSession key={activeGame} game={game} level={gameLevel} onExit={exitGame} onResult={recordResult} onNext={() => {
          if (!circuit) { exitGame(); return; }
          const next = circuitIndex + 1;
          if (next >= circuit.length) { setActiveGame(''); setCircuit(null); setNotice('Circuit complete. Your daily streak and XP have been updated.'); return; }
          setCircuitIndex(next); setActiveGame(circuit[next]);
        }} circuitStep={circuit ? circuitIndex + 1 : 0} circuitTotal={circuit?.length || 0} elapsed={elapsed} /> : <>
          <section className="mind-gym-hero">
            <div className="mind-gym-hero-copy"><span className="mind-gym-eyebrow"><Sparkle size={15} weight="fill" /> YOUR DAILY DIGITAL GYM</span><h2>Give your mind<br /><em>five focused minutes.</em></h2><p>Choose a quick challenge or move through today’s five-game circuit. Your difficulty responds to your own results.</p><div className="mind-gym-hero-actions"><button className="mind-primary-button" onClick={beginCircuit} disabled={profile.lastCircuit === todayKey}><Brain size={19} weight="fill" />{profile.lastCircuit === todayKey ? 'Circuit complete today' : 'Start today’s circuit'}<ArrowRight size={17} /></button><span><Clock size={16} /> About 5 minutes</span></div>{notice && <p className="mind-gym-notice" role="status">{notice}</p>}</div>
            <div className="mind-gym-orbit" aria-hidden="true"><div className="mind-orbit-ring ring-one" /><div className="mind-orbit-ring ring-two" /><div className="mind-orbit-core"><Brain size={47} weight="duotone" /></div><span>FOCUS</span><b>✦</b><i>◉</i><small>⌁</small></div>
          </section>
          <section className="mind-gym-stat-row" aria-label="Your brain gym progress">
            <article><span><Fire size={18} weight="fill" /> Daily streak</span><strong>{profile.streak}<small> days</small></strong><em>Best: {profile.bestStreak}</em></article>
            <article><span><Sparkle size={18} weight="fill" /> Mind XP</span><strong>{profile.xp.toLocaleString()}</strong><em>Personal progress</em></article>
            <article><span><Trophy size={18} weight="fill" /> Personal score</span><strong>{personalScore}<small>/100</small></strong><em>{attempts ? `${wins} wins from ${attempts} rounds` : 'Your first round sets a baseline'}</em></article>
            <article><span><CheckCircle size={18} weight="fill" /> Today’s circuit</span><strong>{dailyProgress}<small>/5</small></strong><em>{profile.lastCircuit === todayKey ? 'Complete · +50 XP' : 'Complete all five to keep your streak'}</em></article>
          </section>
          <section className="mind-gym-pillar-panel"><div className="mind-gym-section-heading"><div><span>YOUR PERSONAL PROFILE</span><h3>Seven ways to train</h3></div><p>Scores are private to this device and reflect your practice here.</p></div><div className="mind-pillar-grid">{PILLARS.map((pillar, index) => { const stats = profile.pillars[pillar] || { attempts: 0, wins: 0, points: 0 }; const score = stats.attempts ? Math.round((stats.wins / stats.attempts) * 100) : 0; return <article key={pillar} className={`pillar-card pillar-${index + 1}`}><span>{String(index + 1).padStart(2, '0')} / PILLAR</span><b>{pillar}</b><div><i style={{ width: `${score}%` }} /></div><small>{stats.attempts ? `${score}% personal round success` : 'Ready to explore'}</small></article>; })}</div></section>
          <section className="mind-game-section"><div className="mind-gym-section-heading"><div><span>THE GAME LIBRARY</span><h3>Pick your next challenge</h3></div><p>Short rounds; your level adjusts after three wins in a row.</p></div><div className="mind-game-grid">{GAMES.map(item => { const stats = profile.games[item.id]; const level = clamp(Math.max(weekdayLevel(today), stats?.level || 1), 1, 5); const inCircuit = circuitGames.includes(item.id); return <button key={item.id} className={`mind-game-card game-${item.color}`} onClick={() => playGame(item.id)}><div className="mind-game-card-top"><span className="mind-game-icon">{item.icon}</span><span className="mind-game-level">LEVEL {level}</span></div><span className="mind-game-kind">{item.kind} · {item.pillar}</span><b>{item.title}</b><p>{item.description}</p><span className="mind-game-card-bottom">{inCircuit ? 'In today’s circuit' : stats ? `${stats.plays} rounds · ${stats.wins} wins` : 'Ready when you are'}<ArrowRight size={16} /></span></button>; })}</div></section>
          <section className="mind-gym-badge-panel"><div className="mind-badge-heading"><Trophy size={21} /><span><b>Practice badges</b><small>Milestones earned through your personal practice.</small></span></div><div className="mind-badge-list">{badges.map(badge => <div key={badge.name} className={badge.earned ? 'earned' : ''}><span>{badge.earned ? <CheckCircle size={17} weight="fill" /> : <Sparkle size={16} />}</span><b>{badge.name}</b><small>{badge.hint}</small></div>)}</div><div className="mind-badge-footer"><Lightbulb size={18} /> Your game progress stays on this device. Game levels adjust after streaks; this is a personal practice score, not a clinical assessment.<button onClick={() => navigate('/career-hub')}>News &amp; Blog <ArrowRight size={15} /></button></div></section>
        </>}
      </main>
    </Layout>
  );
}

function GameSession({ game, level, onExit, onResult, onNext, circuitStep, circuitTotal, elapsed }) {
  const [result, setResult] = useState(null);
  const finish = summary => {
    if (result) return;
    const final = { ...summary, pillar: game.pillar };
    setResult(final);
    onResult(game.id, final);
  };
  if (!game) return null;
  return <section className="mind-play-shell">
    <div className="mind-play-header"><button onClick={onExit} className="mind-back-button"><ArrowLeft size={17} /> GamePal</button><div>{circuitTotal > 0 && <span className="mind-circuit-step">CHALLENGE {circuitStep} / {circuitTotal}</span>}<h2>{game.title}</h2><p>{game.description}</p></div><span className="mind-level-pill">LEVEL {level}</span></div>
    {circuitTotal > 0 && <div className="mind-circuit-progress"><span style={{ width: `${((circuitStep - 1) / circuitTotal) * 100}%` }} /><small><Clock size={14} /> {Math.floor(Math.max(0, 300 - elapsed) / 60)}:{String(Math.max(0, 300 - elapsed) % 60).padStart(2, '0')} left in your five-minute warm-up</small></div>}
    {result ? <div className={`mind-round-result ${result.won ? 'is-win' : 'is-try-again'}`}><span className="mind-result-icon">{result.won ? <CheckCircle size={34} weight="fill" /> : <Sparkle size={33} weight="fill" />}</span><div><span>{result.won ? 'ROUND COMPLETE' : 'GOOD PRACTICE'}</span><h3>{result.won ? 'Nice work.' : 'Keep building your skill.'}</h3><p>{result.message || (result.won ? 'Your score has been added to your personal profile.' : 'Your round is recorded. The next puzzle will give you another try.')}</p></div><strong>+{Math.max(5, result.score || 0) + (result.won ? 15 : 0)} XP</strong><button className="mind-primary-button" onClick={onNext}>{circuitTotal && circuitStep < circuitTotal ? 'Next challenge' : 'Back to GamePal'}<ArrowRight size={17} /></button></div> : <div className="mind-game-stage"><GameEngine gameId={game.id} level={level} finish={finish} /></div>}
  </section>;
}

function GameEngine({ gameId, level, finish }) {
  if (gameId === 'pinpoint') return <PinpointGame level={level} finish={finish} />;
  if (gameId === 'crossclimb') return <CrossclimbGame level={level} finish={finish} />;
  if (gameId === 'queens') return <QueensGame finish={finish} />;
  if (gameId === 'tango') return <TangoGame level={level} finish={finish} />;
  if (gameId === 'zip') return <ZipGame finish={finish} />;
  if (gameId === 'sudoku') return <SudokuGame level={level} finish={finish} />;
  if (gameId === 'patches') return <PatchesGame finish={finish} />;
  if (gameId === 'wend') return <WendGame finish={finish} />;
  if (gameId === 'memory') return <MemoryGame level={level} finish={finish} />;
  if (gameId === 'stroop') return <StroopGame level={level} finish={finish} />;
  if (gameId === 'quickmath') return <QuickMathGame level={level} finish={finish} />;
  if (gameId === 'rapidmatch') return <RapidMatchGame level={level} finish={finish} />;
  return <SortingGame level={level} finish={finish} />;
}

function PinpointGame({ level, finish }) {
  const puzzle = PINPOINTS[(new Date().getDate() + level) % PINPOINTS.length];
  const [clueIndex, setClueIndex] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [guess, setGuess] = useState('');
  const [feedback, setFeedback] = useState('');
  const submit = event => {
    event.preventDefault();
    if (!guess.trim()) return;
    const nextAttempts = attempts + 1;
    if (puzzle.answer.includes(normalize(guess))) {
      finish({ won: true, score: 100 - clueIndex * 14 - (nextAttempts - 1) * 6, message: `Solved with ${clueIndex + 1} clue${clueIndex ? 's' : ''} and ${nextAttempts} guess${nextAttempts === 1 ? '' : 'es'}.` });
      return;
    }
    setAttempts(nextAttempts);
    setGuess('');
    if (nextAttempts >= 5) { finish({ won: false, score: 15, message: `The connecting idea was “${puzzle.answer[0]}”.` }); return; }
    setClueIndex(value => Math.min(value + 1, 4));
    setFeedback('Not quite. Another clue is ready.');
  };
  return <div className="mind-puzzle-card"><PuzzleHeading eyebrow="WORD ASSOCIATION" title="What connects the clues?" instruction="Guess the shared idea. Every miss reveals the next clue." /><div className="pinpoint-clues">{puzzle.clues.slice(0, clueIndex + 1).map((clue, index) => <span key={clue}><small>CLUE {index + 1}</small><b>{clue}</b></span>)}</div><form className="mind-answer-form" onSubmit={submit}><input value={guess} onChange={event => setGuess(event.target.value)} placeholder="Type your connection…" aria-label="Your category guess" autoComplete="off" /><button className="mind-primary-button" type="submit">Submit guess <ArrowRight size={16} /></button></form><p className="mind-round-hint" role="status">{feedback || `${5 - attempts} guesses remaining · ${5 - clueIndex} clues available`}</p></div>;
}

function CrossclimbGame({ level, finish }) {
  const targetIndex = clamp(level + 1, 2, CROSSCLIMB_LADDER.length - 1);
  const ladder = CROSSCLIMB_LADDER.slice(0, targetIndex + 1);
  const options = useMemo(() => shuffle([...CROSSCLIMB_LADDER.slice(1, targetIndex + 1), 'COOL', 'WORK', 'WORE'], `${localDayKey()}:cross`), [targetIndex]);
  const [steps, setSteps] = useState([ladder[0]]);
  const [feedback, setFeedback] = useState('');
  const place = word => {
    const previous = steps.at(-1);
    if (word === ladder.at(-1) && steps.length === ladder.length - 1 && oneLetterApart(previous, word)) {
      finish({ won: true, score: 70 + (steps.length - 1) * 8, message: `You linked ${ladder[0]} to ${ladder.at(-1)} in ${steps.length} moves.` }); return;
    }
    if (word === ladder.at(-1)) { setFeedback('That is the goal rung. Find the missing word before it.'); return; }
    if (!oneLetterApart(previous, word)) { setFeedback('Change one letter at a time. Try a word one edit away.'); return; }
    if (!ladder.includes(word)) { setFeedback('That word fits the letter rule, but not this ladder.'); return; }
    const nextSteps = [...steps, word]; setSteps(nextSteps); setFeedback('Good rung. Keep climbing.');
  };
  return <div className="mind-puzzle-card"><PuzzleHeading eyebrow="WORD LADDER" title="Climb one letter at a time" instruction="Choose a new word that differs from the last rung by exactly one letter." /><div className="crossclimb-ladder"><span className="ladder-end">START · {ladder[0]}</span>{steps.slice(1).map((word, index) => <span className="ladder-rung" key={`${word}-${index}`}>{word}</span>)}<span className="ladder-target">FINISH · {ladder.at(-1)}</span></div><div className="crossclimb-options">{options.filter(word => !steps.includes(word)).map(word => <button key={word} onClick={() => place(word)}>{word}</button>)}</div><p className="mind-round-hint" role="status">{feedback || `${Math.max(0, ladder.length - steps.length)} rungs to go`}</p></div>;
}

function QueensGame({ finish }) {
  const [marks, setMarks] = useState(Array(36).fill(0));
  const [feedback, setFeedback] = useState('Tap once to mark a cell, twice to place a crown.');
  const regions = useMemo(() => Array.from({ length: 36 }, (_, index) => {
    const row = Math.floor(index / 6); const col = index % 6;
    let closest = 0; let distance = Infinity;
    QUEEN_SOLUTION.forEach((queenCol, queenRow) => { const nextDistance = Math.abs(row - queenRow) + Math.abs(col - queenCol); if (nextDistance < distance) { distance = nextDistance; closest = queenRow; } });
    return closest;
  }), []);
  const cycle = index => setMarks(current => current.map((value, cell) => cell === index ? (value + 1) % 3 : value));
  const check = () => {
    const queens = marks.map((value, index) => value === 2 ? index : -1).filter(index => index >= 0);
    if (queens.length !== 6) { setFeedback(`Place exactly 6 crowns. You have ${queens.length}.`); return; }
    const rows = new Set(); const cols = new Set(); const zones = new Set();
    for (const index of queens) {
      const row = Math.floor(index / 6); const col = index % 6; const zone = regions[index];
      if (rows.has(row) || cols.has(col) || zones.has(zone)) { setFeedback('Two crowns share a row, column, or colored region.'); return; }
      rows.add(row); cols.add(col); zones.add(zone);
    }
    if (queens.some((index, i) => queens.slice(i + 1).some(other => Math.abs(Math.floor(index / 6) - Math.floor(other / 6)) === 1 && Math.abs(index % 6 - other % 6) === 1))) { setFeedback('Two crowns are touching diagonally. Move one and try again.'); return; }
    finish({ won: true, score: 100, message: 'Six crowns, six rows, six columns, six regions. A clean solve.' });
  };
  return <div className="mind-puzzle-card"><PuzzleHeading eyebrow="CROWN LOGIC" title="One crown in every region" instruction="Each row, column, and colored region needs one crown. Crowns cannot touch, even diagonally." /><div className="queens-board">{marks.map((mark, index) => <button key={index} className={`queen-cell region-${regions[index]} ${mark ? `mark-${mark}` : ''}`} aria-label={`Row ${Math.floor(index / 6) + 1}, column ${index % 6 + 1}${mark === 2 ? ', crown' : mark === 1 ? ', excluded' : ''}`} onClick={() => cycle(index)}>{mark === 1 ? <X size={20} /> : mark === 2 ? '♛' : ''}</button>)}</div><div className="mind-game-actions"><p role="status">{feedback}</p><button className="mind-primary-button" onClick={check}>Check crowns <Check size={17} /></button></div></div>;
}

function TangoGame({ level, finish }) {
  const solution = TANGO_PATTERN;
  const fixed = useMemo(() => Array.from({ length: 36 }, (_, index) => seededNumber(`${localDayKey()}:tango:${level}`, index) < 0.2), [level]);
  const [board, setBoard] = useState(() => solution.map((line, row) => line.map((value, col) => (fixed[row * 6 + col] ? value : null))));
  const [feedback, setFeedback] = useState('Every row and column needs three suns and three moons. No triples.');
  const cycle = (row, col) => { if (fixed[row * 6 + col]) return; setBoard(current => current.map((line, r) => line.map((value, c) => r === row && c === col ? (value === null ? 0 : value === 0 ? 1 : null) : value))); };
  const check = () => {
    if (board.some(row => row.some(value => value === null))) { setFeedback('Fill every cell before checking the balance.'); return; }
    const validLine = line => line.filter(value => value === 0).length === 3 && line.every((value, index) => !(index >= 2 && line[index] === line[index - 1] && line[index] === line[index - 2]));
    const columns = Array.from({ length: 6 }, (_, col) => board.map(row => row[col]));
    if (![...board, ...columns].every(validLine)) { setFeedback('Balance each row and column and remove any three-in-a-row.'); return; }
    const relationMatch = TANGO_RELATIONS.every(([r1, c1, r2, c2, relation]) => relation === '=' ? board[r1][c1] === board[r2][c2] : board[r1][c1] !== board[r2][c2]);
    if (!relationMatch) { setFeedback('Your rows and columns balance. Check each = and × relation clue.'); return; }
    finish({ won: true, score: 95, message: 'Perfect balance, with no triples.' });
  };
  return <div className="mind-puzzle-card"><PuzzleHeading eyebrow="SUN & MOON" title="Keep both sides in balance" instruction="Tap a tile to switch blank → sun → moon. Every row and column has three of each." /><div className="tango-clues">{TANGO_RELATIONS.map(([r1, c1, r2, c2, relation], index) => <span key={index}>R{r1 + 1}C{c1 + 1} {relation} R{r2 + 1}C{c2 + 1}</span>)}</div><div className="tango-board">{board.flatMap((row, r) => row.map((value, c) => <button key={`${r}-${c}`} className={`tango-cell ${value === 0 ? 'sun' : value === 1 ? 'moon' : ''} ${fixed[r * 6 + c] ? 'given' : ''}`} aria-label={`Row ${r + 1}, column ${c + 1}, ${value === null ? 'blank' : value === 0 ? 'sun' : 'moon'}`} onClick={() => cycle(r, c)}>{value === 0 ? '☀' : value === 1 ? '☾' : ''}</button>))}</div><div className="mind-game-actions"><p role="status">{feedback}</p><button className="mind-primary-button" onClick={check}>Check grid <Check size={17} /></button></div></div>;
}

function ZipGame({ finish }) {
  const pathOrder = useMemo(() => Array.from({ length: 16 }, (_, index) => { const row = Math.floor(index / 4); const offset = index % 4; return row * 4 + (row % 2 ? 3 - offset : offset); }), []);
  const checkpoints = useMemo(() => ({ [pathOrder[0]]: 1, [pathOrder[5]]: 2, [pathOrder[10]]: 3, [pathOrder[15]]: 4 }), [pathOrder]);
  const [path, setPath] = useState([pathOrder[0]]);
  const [feedback, setFeedback] = useState('Start at 1 and extend the path through each neighboring square.');
  const tap = index => {
    const tip = path.at(-1);
    if (path.length > 1 && index === path.at(-2)) { setPath(current => current.slice(0, -1)); return; }
    if (path.includes(index)) { setFeedback('That cell is already in your path. Tap the previous cell to undo.'); return; }
    if (Math.abs(Math.floor(tip / 4) - Math.floor(index / 4)) + Math.abs(tip % 4 - index % 4) !== 1) { setFeedback('Choose a cell that touches the open end of your path.'); return; }
    const checkpoint = checkpoints[index];
    const nextCheckpoint = [1, 2, 3, 4].find(value => !path.some(cell => checkpoints[cell] === value)) || 5;
    if (checkpoint && checkpoint !== nextCheckpoint) { setFeedback(`Visit checkpoint ${nextCheckpoint} before ${checkpoint}.`); return; }
    const nextPath = [...path, index]; setPath(nextPath);
    if (nextPath.length === 16) finish({ won: true, score: 100, message: 'Every cell connected in order.' });
  };
  return <div className="mind-puzzle-card"><PuzzleHeading eyebrow="PATHFINDING" title="Zip through every open cell" instruction="Tap neighboring cells to extend the path. Checkpoints 1–4 must be visited in order. Tap the previous cell to undo." /><div className="zip-board">{Array.from({ length: 16 }, (_, index) => <button key={index} className={`zip-cell ${path.includes(index) ? 'path-cell' : ''} ${path.at(-1) === index ? 'path-tip' : ''}`} onClick={() => tap(index)} aria-label={`Cell ${index + 1}${checkpoints[index] ? `, checkpoint ${checkpoints[index]}` : ''}`}>{checkpoints[index] || (path.includes(index) ? '•' : '')}</button>)}</div><div className="mind-game-actions"><p role="status">{feedback} <b>{path.length}/16</b></p><button className="mind-quiet-button" onClick={() => { setPath([pathOrder[0]]); setFeedback('Path reset. Start again at checkpoint 1.'); }}>Reset path</button></div></div>;
}

function SudokuGame({ level, finish }) {
  const blanks = 7 + level * 2;
  const puzzle = useMemo(() => SUDOKU_SOLUTION.map((row, r) => row.map((value, c) => seededNumber(`${localDayKey()}:sudoku:${level}`, r * 6 + c) < blanks / 36 ? null : value)), [level, blanks]);
  const [board, setBoard] = useState(() => puzzle.map(row => [...row]));
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState('Pick an empty square, then choose a number from 1 to 6.');
  const setValue = value => {
    if (!selected || puzzle[selected[0]][selected[1]]) return;
    setBoard(current => current.map((row, r) => row.map((cell, c) => r === selected[0] && c === selected[1] ? value : cell)));
  };
  const check = () => {
    if (board.some(row => row.includes(null))) { setFeedback('A few squares are still empty.'); return; }
    const validRows = board.every(row => new Set(row).size === 6);
    const validColumns = Array.from({ length: 6 }, (_, col) => new Set(board.map(row => row[col])).size === 6).every(Boolean);
    const validBoxes = [0, 2, 4].every(rowStart => [0, 3].every(colStart => new Set([
      board[rowStart][colStart], board[rowStart][colStart + 1], board[rowStart][colStart + 2],
      board[rowStart + 1][colStart], board[rowStart + 1][colStart + 1], board[rowStart + 1][colStart + 2],
    ]).size === 6));
    if (!validRows || !validColumns || !validBoxes) { setFeedback('One or more entries break a row, column, or 2 × 3 box.'); return; }
    finish({ won: true, score: 100, message: 'All six rows, columns, and boxes are complete.' });
  };
  return <div className="mind-puzzle-card"><PuzzleHeading eyebrow="NUMBER LOGIC" title="Complete the mini Sudoku" instruction="Place 1–6 once in every row, column, and 2 × 3 box. Tap a filled cell to clear your own entry." /><div className="sudoku-board">{board.flatMap((row, r) => row.map((value, c) => { const fixed = puzzle[r][c] !== null; return <button key={`${r}-${c}`} className={`sudoku-cell ${fixed ? 'fixed' : ''} ${selected?.[0] === r && selected?.[1] === c ? 'selected' : ''} ${c === 2 ? 'box-right' : ''} ${r % 2 === 1 ? 'box-bottom' : ''}`} onClick={() => { if (fixed) return; if (selected?.[0] === r && selected?.[1] === c && value !== null) setValue(null); else setSelected([r, c]); }} aria-label={`Row ${r + 1}, column ${c + 1}, ${value || 'blank'}`}>{value || ''}</button>; }))}</div><div className="sudoku-keypad">{[1, 2, 3, 4, 5, 6].map(value => <button key={value} onClick={() => setValue(value)}>{value}</button>)}</div><div className="mind-game-actions"><p role="status">{feedback}</p><button className="mind-primary-button" onClick={check}>Check solution <Check size={17} /></button></div></div>;
}

function PatchesGame({ finish }) {
  const orientations = useMemo(() => shuffle(['h', 'v', 'h', 'v', 'v', 'h', 'v', 'h'], localDayKey()), []);
  const [placed, setPlaced] = useState({});
  const [selectedPiece, setSelectedPiece] = useState(0);
  const [feedback, setFeedback] = useState('Choose a patch, then tap the board cell where its top-left square begins. Patches do not rotate.');
  const colors = ['var(--accent-primary)', '#22d3ee', '#f472b6', '#fbbf24', '#34d399', '#fb7185', '#60a5fa', '#a3e635'];
  const cells = useMemo(() => {
    const grid = Array(16).fill(null);
    Object.entries(placed).forEach(([piece, placement]) => placement.forEach(cell => { grid[cell] = Number(piece); }));
    return grid;
  }, [placed]);
  const place = cell => {
    const direction = orientations[selectedPiece]; const row = Math.floor(cell / 4); const col = cell % 4;
    const other = direction === 'h' ? cell + 1 : cell + 4;
    if ((direction === 'h' && col === 3) || (direction === 'v' && row === 3)) { setFeedback('That patch would extend beyond the board.'); return; }
    if (cells[cell] !== null || cells[other] !== null) { setFeedback('That placement overlaps a patch. Choose two empty squares.'); return; }
    const next = { ...placed, [selectedPiece]: [cell, other] }; setPlaced(next);
    if (Object.keys(next).length === 8) finish({ won: true, score: 100, message: 'The board is tiled exactly with all eight patches.' });
    else { const free = orientations.findIndex((_, index) => next[index] === undefined); setSelectedPiece(free); setFeedback('Nice fit. Select the next unplaced patch.'); }
  };
  const remove = piece => { setPlaced(current => { const next = { ...current }; delete next[piece]; return next; }); setSelectedPiece(piece); setFeedback('Patch removed. Place it again when ready.'); };
  return <div className="mind-puzzle-card"><PuzzleHeading eyebrow="SPATIAL TILING" title="Patch every square" instruction="Place eight two-square patches. Their orientation is fixed; no gaps, overlaps, or rotations." /><div className="patches-layout"><div className="patches-board">{cells.map((piece, index) => <button key={index} className="patch-cell" style={piece !== null ? { background: colors[piece] } : undefined} onClick={() => place(index)} aria-label={`Board square ${index + 1}${piece !== null ? ', filled' : ', empty'}`} />)}</div><div className="patches-tray"><b>PATCH TRAY</b>{orientations.map((direction, index) => <div key={index} className={`patch-piece-row ${selectedPiece === index ? 'chosen' : ''}`}><button className="patch-piece" onClick={() => !placed[index] && setSelectedPiece(index)} disabled={Boolean(placed[index])}><span className={`patch-shape ${direction}`} style={{ '--patch-color': colors[index] }} /><span>Patch {index + 1} · {direction === 'h' ? 'Horizontal' : 'Vertical'}</span></button>{placed[index] && <button className="patch-undo" onClick={() => remove(index)}>Undo</button>}</div>)}</div></div><div className="mind-game-actions"><p role="status">{feedback}</p><button className="mind-quiet-button" onClick={() => { setPlaced({}); setSelectedPiece(0); setFeedback('Board cleared. Place eight fixed-orientation patches.'); }}>Reset board</button></div></div>;
}

function WendGame({ finish }) {
  const words = WEND_WORD_SETS[new Date().getDate() % WEND_WORD_SETS.length];
  const path = useMemo(() => Array.from({ length: 16 }, (_, index) => { const row = Math.floor(index / 4); const offset = index % 4; return row * 4 + (row % 2 ? 3 - offset : offset); }), []);
  const letters = useMemo(() => { const cells = Array(16).fill(''); let cursor = 0; words.forEach((word, wordIndex) => { const segment = wordIndex % 2 ? [...word].reverse() : [...word]; segment.forEach(letter => { cells[path[cursor]] = letter; cursor += 1; }); }); return cells; }, [words, path]);
  const [used, setUsed] = useState([]);
  const [completedWords, setCompletedWords] = useState([]);
  const [activeWord, setActiveWord] = useState('');
  const [trace, setTrace] = useState([]);
  const [feedback, setFeedback] = useState('Choose a word, then trace its letters through adjacent tiles.');
  const tap = index => {
    if (used.includes(index)) { setFeedback('That letter is already used. Every square appears once.'); return; }
    const previous = trace.at(-1);
    if (previous !== undefined && Math.abs(Math.floor(previous / 4) - Math.floor(index / 4)) + Math.abs(previous % 4 - index % 4) !== 1) { setFeedback('Trace to a neighboring tile.'); return; }
    if (trace.includes(index)) { setTrace(current => current.slice(0, current.indexOf(index) + 1)); return; }
    const next = [...trace, index]; setTrace(next);
    const typed = next.map(cell => letters[cell]).join('');
    if (typed.length > activeWord.length || !activeWord.startsWith(typed)) { setFeedback('That path does not spell the selected word. Start a new path.'); setTrace([]); return; }
    if (typed === activeWord) {
      const nextUsed = [...used, ...next]; setUsed(nextUsed); setCompletedWords(current => [...current, activeWord]); setTrace([]); setActiveWord(''); setFeedback(`${activeWord} found. Select another word.`);
      if (nextUsed.length === 16) finish({ won: true, score: 100, message: 'Every hidden word traced, and every letter used exactly once.' });
    }
  };
  return <div className="mind-puzzle-card"><PuzzleHeading eyebrow="LETTER PATHS" title="Find every word in the winding grid" instruction="Choose a word and trace adjacent letters. Each tile can only be used once." /><div className="wend-word-list">{words.map(word => <button key={word} className={`${completedWords.includes(word) ? 'completed' : ''} ${activeWord === word ? 'active' : ''}`} disabled={completedWords.includes(word)} onClick={() => { setActiveWord(word); setTrace([]); setFeedback(`Trace ${word} one adjacent letter at a time.`); }}>{completedWords.includes(word) ? <>{word} <Check size={14} /></> : word}</button>)}</div><div className="wend-board">{letters.map((letter, index) => <button key={index} className={`${used.includes(index) ? 'used' : ''} ${trace.includes(index) ? 'tracing' : ''}`} onClick={() => activeWord && tap(index)} aria-label={`Letter ${letter}${used.includes(index) ? ', already used' : ''}`}>{letter}</button>)}</div><p className="mind-round-hint" role="status">{feedback} <b>{used.length}/16 tiles</b></p><div className="mind-game-actions"><button className="mind-quiet-button" onClick={() => { setTrace([]); setActiveWord(''); setFeedback('Choose an unused word to start a new path.'); }}>Clear current path</button></div></div>;
}

function MemoryGame({ level, finish }) {
  const size = Math.min(6, 2 + level);
  const count = Math.min(size + 1, Math.ceil(size * size * 0.36));
  const pattern = useMemo(() => shuffle(Array.from({ length: size * size }, (_, index) => index), `${localDayKey()}:memory:${level}`).slice(0, count), [size, count, level]);
  const [stage, setStage] = useState('show');
  const [selected, setSelected] = useState([]);
  const [feedback, setFeedback] = useState('Memorize the highlighted tiles.');
  useEffect(() => { const timer = window.setTimeout(() => { setStage('recall'); setFeedback('Now tap the tiles that were lit.'); }, 1500 + Math.max(0, 5 - level) * 220); return () => window.clearTimeout(timer); }, [level]);
  const toggle = index => setSelected(current => current.includes(index) ? current.filter(item => item !== index) : [...current, index]);
  const check = () => {
    const correct = selected.length === pattern.length && pattern.every(index => selected.includes(index));
    finish({ won: correct, score: correct ? 100 : 20, message: correct ? `${pattern.length} of ${size * size} tiles recalled correctly.` : `The pattern contained ${pattern.length} tiles. Try another board to build recall.` });
  };
  return <div className="mind-puzzle-card"><PuzzleHeading eyebrow="WORKING MEMORY" title={`Remember the ${size} × ${size} pattern`} instruction="The pattern disappears shortly. Then recreate it from memory." /><div className={`memory-board size-${size}`}>{Array.from({ length: size * size }, (_, index) => <button key={index} disabled={stage === 'show'} className={`${pattern.includes(index) && stage === 'show' ? 'lit' : ''} ${selected.includes(index) ? 'selected' : ''}`} onClick={() => toggle(index)} aria-label={`Tile ${index + 1}${pattern.includes(index) && stage === 'show' ? ', highlighted' : ''}`} />)}</div><div className="mind-game-actions"><p role="status">{feedback} {stage === 'recall' && <b>{selected.length}/{pattern.length} selected</b>}</p>{stage === 'recall' && <button className="mind-primary-button" onClick={check}>Check pattern <Check size={17} /></button>}</div></div>;
}

function StroopGame({ level, finish }) {
  const total = 5 + level;
  const rounds = useMemo(() => Array.from({ length: total }, (_, index) => { const wordIndex = Math.floor(seededNumber(`${localDayKey()}:stroop:${level}`, index) * COLORS.length); let inkIndex = Math.floor(seededNumber(`${localDayKey()}:ink:${level}`, index) * COLORS.length); if (inkIndex === wordIndex) inkIndex = (inkIndex + 1) % COLORS.length; return { word: COLORS[wordIndex].name, ink: COLORS[inkIndex] }; }), [total, level]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('Choose the ink color, not the word you read.');
  const answer = color => {
    const nextScore = score + Number(color === rounds[index].ink.name);
    if (index + 1 === rounds.length) finish({ won: nextScore >= Math.ceil(rounds.length * 0.65), score: Math.round(nextScore / rounds.length * 100), message: `${nextScore} of ${rounds.length} ink colors correct.` });
    else { setScore(nextScore); setIndex(index + 1); setFeedback(color === rounds[index].ink.name ? 'Correct ink color. Keep your focus.' : 'That was the word color. Reset on the ink and continue.'); }
  };
  return <div className="mind-puzzle-card"><PuzzleHeading eyebrow="SELECTIVE ATTENTION" title="Color Clash" instruction="The word names a color. Choose the color the letters are printed in." /><div className="stroop-progress">ROUND {index + 1} / {rounds.length}<span><i style={{ width: `${(index / rounds.length) * 100}%` }} /></span></div><div className="stroop-word" style={{ color: rounds[index].ink.value }}>{rounds[index].word}</div><div className="color-choice-row">{COLORS.map(color => <button key={color.name} onClick={() => answer(color.name)}><i style={{ background: color.value }} />{color.name}</button>)}</div><p className="mind-round-hint" role="status">{feedback}</p></div>;
}

function QuickMathGame({ level, finish }) {
  const total = 6 + level;
  const rounds = useMemo(() => Array.from({ length: total }, (_, index) => {
    const a = 4 + Math.floor(seededNumber(`${localDayKey()}:math-a:${level}`, index) * (12 + level * 4));
    const b = 3 + Math.floor(seededNumber(`${localDayKey()}:math-b:${level}`, index) * (9 + level * 3));
    const multiply = index % 3 === 2; const correct = (index % 2 === 0);
    const value = multiply ? a * b : correct ? a + b : a + b + (index % 2 ? 2 : -3);
    return { text: `${a} ${multiply ? '×' : '+'} ${b} = ${value}`, correct };
  }), [total, level]);
  const [index, setIndex] = useState(0); const [score, setScore] = useState(0);
  const answer = value => { const points = score + Number(value === rounds[index].correct); if (index + 1 === rounds.length) finish({ won: points >= Math.ceil(total * 0.65), score: Math.round(points / total * 100), message: `${points} of ${total} equations judged correctly.` }); else { setScore(points); setIndex(index + 1); } };
  return <div className="mind-puzzle-card"><PuzzleHeading eyebrow="MENTAL ARITHMETIC" title="Quick Math" instruction="Decide whether the displayed equation is true. Trust your mental calculation." /><div className="stroop-progress">QUESTION {index + 1} / {total}<span><i style={{ width: `${(index / total) * 100}%` }} /></span></div><div className="quickmath-equation">{rounds[index].text}</div><div className="binary-choice-row"><button onClick={() => answer(true)}><Check size={19} /> True</button><button onClick={() => answer(false)}><X size={19} /> False</button></div></div>;
}

function RapidMatchGame({ level, finish }) {
  const total = 6 + level;
  const sequence = useMemo(() => Array.from({ length: total + 1 }, (_, index) => SYMBOLS[Math.floor(seededNumber(`${localDayKey()}:symbols:${level}`, index) * SYMBOLS.length)]), [total, level]);
  const [index, setIndex] = useState(0); const [score, setScore] = useState(0);
  const answer = isSame => {
    const points = score + Number(isSame === (sequence[index] === sequence[index - 1]));
    if (index === total) finish({ won: points >= Math.ceil(total * 0.65), score: Math.round(points / total * 100), message: `${points} of ${total} comparisons correct.` });
    else { setScore(points); setIndex(index + 1); }
  };
  return <div className="mind-puzzle-card"><PuzzleHeading eyebrow="PROCESSING SPEED" title="Rapid Match" instruction="Is the current symbol the same as the one immediately before it?" /><div className="stroop-progress">COMPARISON {Math.max(1, index)} / {total}<span><i style={{ width: `${(Math.max(0, index - 1) / total) * 100}%` }} /></span></div><div className="rapid-symbol-pair"><span>{index > 0 ? sequence[index - 1] : '—'}</span><i>→</i><b>{sequence[index]}</b></div>{index === 0 ? <button className="mind-primary-button center-button" onClick={() => setIndex(1)}>Start comparisons <ArrowRight size={16} /></button> : <div className="binary-choice-row"><button onClick={() => answer(true)}>Same</button><button onClick={() => answer(false)}>Different</button></div>}</div>;
}

function SortingGame({ level, finish }) {
  const total = 6 + level;
  const rounds = useMemo(() => Array.from({ length: total }, (_, index) => ({ rule: Math.floor(index / 2) % 2 ? 'color' : 'shape', shape: seededNumber(`${localDayKey()}:shape:${level}`, index) > 0.5 ? 'Circle' : 'Square', color: seededNumber(`${localDayKey()}:sortcolor:${level}`, index) > 0.5 ? 'Green' : 'Orange' })), [total, level]);
  const [index, setIndex] = useState(0); const [score, setScore] = useState(0);
  const answer = value => { const item = rounds[index]; const points = score + Number(value === (item.rule === 'shape' ? item.shape : item.color)); if (index + 1 === total) finish({ won: points >= Math.ceil(total * 0.65), score: Math.round(points / total * 100), message: `${points} of ${total} sorting rules followed correctly.` }); else { setScore(points); setIndex(index + 1); } };
  const item = rounds[index]; const choices = item.rule === 'shape' ? ['Circle', 'Square'] : ['Green', 'Orange'];
  return <div className="mind-puzzle-card"><PuzzleHeading eyebrow="TASK SWITCHING" title="Sorting Shift" instruction="The rule changes every two cards. Follow the current rule, not the last one." /><div className="sorting-rule">SORT BY <b>{item.rule.toUpperCase()}</b><small>ROUND {index + 1} / {total}</small></div><div className="sorting-item"><span style={{ color: item.color === 'Green' ? '#34d399' : '#fb923c' }}>{item.shape === 'Circle' ? '●' : '■'}</span><small>{item.color} · {item.shape}</small></div><div className="color-choice-row">{choices.map(choice => <button key={choice} onClick={() => answer(choice)}>{choice}</button>)}</div></div>;
}

function PuzzleHeading({ eyebrow, title, instruction }) {
  return <header className="mind-puzzle-heading"><span>{eyebrow}</span><h3>{title}</h3><p>{instruction}</p></header>;
}
