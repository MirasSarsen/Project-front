import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { Key, Lock, Check, X, Sparkles, Loader2, RotateCcw, Flame, Clock, Trophy } from "lucide-react";
import { fetchTasks, submitAnswer } from "../api/tasksApi";
import type { Task, SubmitResult } from "../api/tasksApi";

type Status = "loading" | "ready" | "error";

const TIME_LIMIT = 20; // секунд на вопрос

const palette = {
  bg: "#1B1F2A",
  card: "#242938",
  cardBorder: "#333A4D",
  gold: "#D4A24C",
  teal: "#4FB0A5",
  rust: "#C15A45",
  text: "#F2EFE9",
  muted: "#9AA0AE",
};

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  color: string;
  rotate: number;
}

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

interface Point {
  x: number;
  y: number;
}

function generateConfetti(count: number): ConfettiPiece[] {
  const colors = [palette.gold, palette.teal, palette.rust, "#F2EFE9"];
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.25,
    color: colors[i % colors.length],
    rotate: Math.random() * 360,
  }));
}

function generateStars(count: number): Star[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 1,
    duration: 2 + Math.random() * 3,
    delay: Math.random() * 3,
  }));
}

function motivationalCaption(doneCount: number, total: number): string {
  if (total === 0) return "Пройди путь — открой все замки";
  if (doneCount === 0) return "Пройди путь — открой все замки";
  if (doneCount < total / 2) return "Отличное начало!";
  if (doneCount < total) return "Уже больше половины пути!";
  return "Финальный рывок!";
}

export default function MasterKliuchQuest() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [progress, setProgress] = useState<Record<string, "done">>({});
  const [coins, setCoins] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<SubmitResult | null>(null);
  const [checking, setChecking] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>("");

  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [coinPopKey, setCoinPopKey] = useState<number>(0);
  const confetti = useRef<ConfettiPiece[]>(generateConfetti(24));
  const stars = useRef<Star[]>(generateStars(28));

  const listRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [points, setPoints] = useState<Point[]>([]);
  const [svgSize, setSvgSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const loadTasks = useCallback(() => {
    setStatus("loading");
    setErrorMessage("");
    fetchTasks()
      .then((data: Task[]) => {
        setTasks(data);
        setStatus("ready");
      })
      .catch((err: Error) => {
        setErrorMessage(err.message || "Не удалось загрузить задания.");
        setStatus("error");
      });
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Измеряем центры узлов пути, чтобы нарисовать соединяющую SVG-тропинку.
  useLayoutEffect(() => {
    function measure() {
      const container = listRef.current;
      if (!container || tasks.length === 0) return;
      const containerRect = container.getBoundingClientRect();
      const pts: Point[] = [];
      tasks.forEach((t) => {
        const el = nodeRefs.current[t.id];
        if (!el) return;
        const r = el.getBoundingClientRect();
        pts.push({
          x: r.left + r.width / 2 - containerRect.left,
          y: r.top + r.height / 2 - containerRect.top,
        });
      });
      setPoints(pts);
      setSvgSize({ w: containerRect.width, h: containerRect.height });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [tasks, status]);

  // Таймер: запускается при открытии задания, останавливается при получении фидбэка.
  useEffect(() => {
    if (activeId === null || feedback !== null) return;
    setTimeLeft(TIME_LIMIT);
    const interval = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t === null) return null;
        if (t <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeId, feedback]);

  // Авто-провал по истечении времени.
  useEffect(() => {
    if (timeLeft !== 0 || feedback !== null || activeId === null) return;
    const activeTaskForTimeout = tasks.find((t) => t.id === activeId);
    if (!activeTaskForTimeout) return;
    setFeedback({
      correct: false,
      explanation: `Время вышло! Правильный ответ: «${activeTaskForTimeout.options[activeTaskForTimeout.correctIndex]}».`,
    });
    setStreak(0);
  }, [timeLeft, feedback, activeId, tasks]);

  // Конфетти + всплывающая монетка при верном ответе.
  useEffect(() => {
    if (feedback?.correct) {
      confetti.current = generateConfetti(24);
      setShowConfetti(true);
      setCoinPopKey((k) => k + 1);
      const timeout = window.setTimeout(() => setShowConfetti(false), 1100);
      return () => window.clearTimeout(timeout);
    }
  }, [feedback]);

  const isUnlocked = (index: number): boolean =>
    index === 0 || progress[tasks[index - 1]?.id] === "done";

  function openTask(task: Task, index: number) {
    if (!isUnlocked(index)) return;
    setActiveId(task.id);
    setSelected(null);
    setFeedback(null);
    setSubmitError("");
  }

  function closeTask() {
    setActiveId(null);
    setSelected(null);
    setFeedback(null);
    setSubmitError("");
    setTimeLeft(null);
  }

  async function handleSubmit() {
    if (selected === null || activeId === null || timeLeft === 0) return;
    setChecking(true);
    setSubmitError("");
    try {
      const result = await submitAnswer(activeId, selected);
      setFeedback(result);
      if (result.correct) {
        setProgress((p) => ({ ...p, [activeId]: "done" }));
        setCoins((c) => c + 10);
        setStreak((s) => {
          const next = s + 1;
          setBestStreak((b) => Math.max(b, next));
          return next;
        });
      } else {
        setStreak(0);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Не удалось отправить ответ.");
    } finally {
      setChecking(false);
    }
  }

  function playAgain() {
    setProgress({});
    setCoins(0);
    setStreak(0);
    setBestStreak(0);
    closeTask();
  }

  const activeIndex = tasks.findIndex((t) => t.id === activeId);
  const activeTask = tasks[activeIndex];
  const doneCount = Object.keys(progress).length;
  const finished = tasks.length > 0 && doneCount === tasks.length;
  const timerPct = timeLeft === null ? 100 : Math.max(0, (timeLeft / TIME_LIMIT) * 100);
  const timerDanger = timeLeft !== null && timeLeft <= 5;
  const mascotPoint = !finished && points[doneCount] ? points[doneCount] : null;

  if (status === "loading") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ background: palette.bg }}>
        <div className="flex items-center gap-3" style={{ color: palette.muted }}>
          <Loader2 className="animate-spin" size={20} />
          <span>Загружаем задания…</span>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center px-6" style={{ background: palette.bg }}>
        <div className="max-w-sm text-center">
          <p className="mb-4" style={{ color: palette.text }}>{errorMessage}</p>
          <button
            onClick={loadTasks}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold"
            style={{ background: palette.gold, color: palette.bg }}
          >
            <RotateCcw size={16} />
            Повторить
          </button>
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center px-6" style={{ background: palette.bg }}>
        <p style={{ color: palette.muted }}>Заданий пока нет.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full relative overflow-hidden" style={{ background: palette.bg }}>
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(280px) rotate(540deg); opacity: 0; }
        }
        @keyframes coin-pop {
          0% { transform: translateY(0) scale(0.7); opacity: 0; }
          25% { transform: translateY(-8px) scale(1.15); opacity: 1; }
          100% { transform: translateY(-46px) scale(1); opacity: 0; }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.9); opacity: 0.7; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes pop-in {
          0% { transform: scale(0.85); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes trophy-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.65; transform: scale(1.4); }
        }
        @keyframes mascot-bob {
          0%, 100% { transform: translateY(0) rotate(-4deg); }
          50% { transform: translateY(-6px) rotate(4deg); }
        }
        @keyframes dash-flow {
          to { stroke-dashoffset: -24; }
        }
      `}</style>

      {/* Декоративный фон: градиентные пятна + мерцающие звёзды */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          style={{
            position: "absolute",
            top: "-12%",
            left: "-14%",
            width: 320,
            height: 320,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${palette.gold}26, transparent 70%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-16%",
            right: "-12%",
            width: 380,
            height: 380,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${palette.teal}22, transparent 70%)`,
          }}
        />
        {stars.current.map((s) => (
          <span
            key={s.id}
            style={{
              position: "absolute",
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              borderRadius: "50%",
              background: palette.text,
              animation: `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {finished ? (
        <div className="min-h-screen w-full flex items-center justify-center px-6 relative">
          <div
            className="max-w-sm w-full text-center rounded-2xl p-8"
            style={{ background: palette.card, border: `1px solid ${palette.cardBorder}`, animation: "pop-in 0.35s ease-out" }}
          >
            <div style={{ animation: "trophy-bounce 1.6s ease-in-out infinite" }}>
              <Trophy size={56} style={{ color: palette.gold, margin: "0 auto" }} />
            </div>
            <h2 className="text-2xl font-extrabold mt-4" style={{ color: palette.text }}>Все замки открыты!</h2>
            <p className="text-sm mt-2" style={{ color: palette.muted }}>Ты прошёл весь путь Мастер Ключа</p>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="rounded-xl py-3" style={{ background: "rgba(212,162,76,0.1)", border: `1px solid ${palette.cardBorder}` }}>
                <div className="flex items-center justify-center gap-1">
                  <Key size={16} style={{ color: palette.gold }} />
                  <span className="font-bold text-lg" style={{ color: palette.gold }}>{coins}</span>
                </div>
                <span className="text-xs" style={{ color: palette.muted }}>ключей собрано</span>
              </div>
              <div className="rounded-xl py-3" style={{ background: "rgba(79,176,165,0.1)", border: `1px solid ${palette.cardBorder}` }}>
                <div className="flex items-center justify-center gap-1">
                  <Flame size={16} style={{ color: palette.teal }} />
                  <span className="font-bold text-lg" style={{ color: palette.teal }}>{bestStreak}</span>
                </div>
                <span className="text-xs" style={{ color: palette.muted }}>лучшая серия</span>
              </div>
            </div>

            <button
              onClick={playAgain}
              className="w-full mt-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2"
              style={{ background: palette.gold, color: palette.bg }}
            >
              <RotateCcw size={16} />
              Играть заново
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-6 py-5 relative" style={{ borderBottom: `1px solid ${palette.cardBorder}` }}>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: "rgba(212,162,76,0.12)", border: `1px solid ${palette.gold}` }}
              >
                <Key size={18} style={{ color: palette.gold }} />
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight" style={{ color: palette.text }}>Мастер Ключ</h1>
                <p className="text-sm" style={{ color: palette.muted }}>{motivationalCaption(doneCount, tasks.length)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {streak >= 2 && (
                <div
                  className="flex items-center gap-1 px-3 py-2 rounded-full"
                  style={{ background: "rgba(193,90,69,0.12)", border: `1px solid ${palette.rust}`, animation: "pop-in 0.25s ease-out" }}
                >
                  <Flame size={16} style={{ color: palette.rust }} />
                  <span className="font-bold" style={{ color: palette.rust }}>{streak}</span>
                </div>
              )}
              <div className="relative flex items-center gap-2 px-3 py-2 rounded-full" style={{ background: palette.card, border: `1px solid ${palette.cardBorder}` }}>
                <Key size={16} style={{ color: palette.gold }} />
                <span className="font-bold" style={{ color: palette.gold }}>{coins}</span>
                {coinPopKey > 0 && (
                  <span
                    key={coinPopKey}
                    className="absolute -top-1 right-2 text-xs font-bold"
                    style={{ color: palette.gold, animation: "coin-pop 0.9s ease-out forwards" }}
                  >
                    +10
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="max-w-md mx-auto px-6 py-10 relative">
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: palette.muted }}>{doneCount} из {tasks.length} заданий открыто</span>
                <span className="text-sm font-semibold" style={{ color: palette.gold }}>{Math.round((doneCount / tasks.length) * 100)}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: palette.card }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(doneCount / tasks.length) * 100}%`, background: `linear-gradient(90deg, ${palette.gold}, ${palette.teal})` }}
                />
              </div>
            </div>

            <div ref={listRef} className="relative flex flex-col items-center gap-6">
              {svgSize.w > 0 && points.length === tasks.length && (
                <svg
                  className="absolute top-0 left-0 pointer-events-none"
                  width={svgSize.w}
                  height={svgSize.h}
                  style={{ overflow: "visible" }}
                  aria-hidden="true"
                >
                  {points.slice(0, -1).map((p, i) => {
                    const next = points[i + 1];
                    const segDone = progress[tasks[i].id] === "done";
                    return (
                      <line
                        key={i}
                        x1={p.x}
                        y1={p.y}
                        x2={next.x}
                        y2={next.y}
                        stroke={segDone ? palette.teal : palette.cardBorder}
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeDasharray={segDone ? undefined : "2 10"}
                        style={segDone ? undefined : { animation: "dash-flow 1.2s linear infinite" }}
                      />
                    );
                  })}
                </svg>
              )}

              {mascotPoint && (
                <div
                  className="absolute pointer-events-none z-10"
                  style={{
                    left: mascotPoint.x + 34,
                    top: mascotPoint.y - 26,
                    animation: "mascot-bob 2.4s ease-in-out infinite",
                  }}
                >
                  <svg width="36" height="36" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="18" fill={palette.gold} stroke={palette.bg} strokeWidth="2" />
                    <circle cx="14" cy="18" r="2.4" fill={palette.bg} />
                    <circle cx="26" cy="18" r="2.4" fill={palette.bg} />
                    <path d="M13 25 Q20 30 27 25" stroke={palette.bg} strokeWidth="2" fill="none" strokeLinecap="round" />
                  </svg>
                </div>
              )}

              {tasks.map((task: Task, index: number) => {
                const unlocked = isUnlocked(index);
                const done = progress[task.id] === "done";
                const offset = index % 2 === 0 ? -36 : 36;
                const label = index + 1;
                return (
                  <div
                    key={task.id}
                    ref={(el) => { nodeRefs.current[task.id] = el; }}
                    className="flex flex-col items-center relative z-10"
                    style={{ transform: `translateX(${offset}px)` }}
                  >
                    <div className="relative">
                      {unlocked && !done && (
                        <span
                          className="absolute inset-0 rounded-full"
                          style={{ border: `2px solid ${palette.gold}`, animation: "pulse-ring 1.8s ease-out infinite" }}
                        />
                      )}
                      <button
                        onClick={() => openTask(task, index)}
                        disabled={!unlocked}
                        aria-label={`Задание ${label}${done ? ", пройдено" : unlocked ? "" : ", закрыто"}`}
                        className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg transition-transform relative"
                        style={{
                          background: done ? palette.teal : unlocked ? palette.gold : palette.card,
                          color: done || unlocked ? "#1B1F2A" : palette.muted,
                          border: `2px solid ${done ? palette.teal : unlocked ? palette.gold : palette.cardBorder}`,
                          cursor: unlocked ? "pointer" : "not-allowed",
                        }}
                      >
                        {done ? <Check size={22} /> : unlocked ? label : <Lock size={18} />}
                      </button>
                    </div>
                    <span className="text-xs mt-2" style={{ color: palette.muted }}>Задание {label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {activeTask && (
            <div
              className="fixed inset-0 flex items-end sm:items-center justify-center p-4"
              style={{ background: "rgba(0,0,0,0.55)" }}
              onClick={closeTask}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="w-full max-w-sm rounded-2xl p-6 relative overflow-hidden"
                style={{ background: palette.card, border: `1px solid ${palette.cardBorder}`, animation: "pop-in 0.25s ease-out" }}
                onClick={(e) => e.stopPropagation()}
              >
                {showConfetti && (
                  <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    {confetti.current.map((p) => (
                      <span
                        key={p.id}
                        className="absolute top-0 block"
                        style={{
                          left: `${p.left}%`,
                          width: 6,
                          height: 6,
                          background: p.color,
                          borderRadius: 1,
                          animation: `confetti-fall 1s ease-in ${p.delay}s forwards`,
                          transform: `rotate(${p.rotate}deg)`,
                        }}
                      />
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold" style={{ color: palette.gold }}>Задание {activeIndex + 1}</span>
                  <button onClick={closeTask} aria-label="Закрыть" style={{ color: palette.muted }}><X size={18} /></button>
                </div>

                {feedback === null && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1" style={{ color: timerDanger ? palette.rust : palette.muted }}>
                        <Clock size={14} />
                        <span className="text-xs font-semibold">{timeLeft ?? TIME_LIMIT} сек</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: palette.bg }}>
                      <div
                        className="h-full rounded-full transition-all duration-1000 linear"
                        style={{ width: `${timerPct}%`, background: timerDanger ? palette.rust : palette.gold }}
                      />
                    </div>
                  </div>
                )}

                <p className="mb-5 leading-relaxed" style={{ color: palette.text }}>{activeTask.question}</p>

                <div className="flex flex-col gap-2 mb-5">
                  {activeTask.options.map((opt: string, i: number) => {
                    const isSelected = selected === i;
                    const showResult = feedback !== null;
                    const isCorrectOpt = showResult && i === activeTask.correctIndex;
                    const isWrongPick = showResult && isSelected && !feedback!.correct;
                    return (
                      <button
                        key={i}
                        onClick={() => !showResult && setSelected(i)}
                        disabled={showResult}
                        className="text-left px-4 py-3 rounded-xl transition-colors"
                        style={{
                          background: isCorrectOpt ? "rgba(79,176,165,0.15)" : isWrongPick ? "rgba(193,90,69,0.15)" : isSelected ? "rgba(212,162,76,0.12)" : "transparent",
                          border: `1px solid ${isCorrectOpt ? palette.teal : isWrongPick ? palette.rust : isSelected ? palette.gold : palette.cardBorder}`,
                          color: palette.text,
                        }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {submitError && (
                  <p className="text-sm mb-4" style={{ color: palette.rust }}>{submitError}</p>
                )}

                {feedback && (
                  <div
                    className="mb-4 px-4 py-3 rounded-xl flex items-start gap-2"
                    style={{ background: feedback.correct ? "rgba(79,176,165,0.1)" : "rgba(193,90,69,0.1)", animation: "pop-in 0.25s ease-out" }}
                  >
                    {feedback.correct ? <Sparkles size={16} style={{ color: palette.teal, marginTop: 2 }} /> : <X size={16} style={{ color: palette.rust, marginTop: 2 }} />}
                    <div>
                      <p className="text-sm font-semibold" style={{ color: feedback.correct ? palette.teal : palette.rust }}>
                        {feedback.correct ? "Верно! +10 ключей" : "Не совсем"}
                      </p>
                      <p className="text-sm mt-1" style={{ color: palette.muted }}>{feedback.explanation}</p>
                    </div>
                  </div>
                )}

                {!feedback ? (
                  <button
                    onClick={handleSubmit}
                    disabled={selected === null || checking}
                    className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                    style={{ background: selected === null ? palette.cardBorder : palette.gold, color: selected === null ? palette.muted : "#1B1F2A" }}
                  >
                    {checking ? <Loader2 className="animate-spin" size={16} /> : "Ответить"}
                  </button>
                ) : (
                  <button onClick={closeTask} className="w-full py-3 rounded-xl font-bold" style={{ background: palette.cardBorder, color: palette.text }}>
                    Продолжить
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}