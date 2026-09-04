import { useState, useEffect, useCallback } from "react";
import { Key, Lock, Check, X, Sparkles, Loader2, RotateCcw } from "lucide-react";
import { fetchTasks, submitAnswer, Task, SubmitResult } from "../api/tasksApi";

type Status = "loading" | "ready" | "error";

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

export default function MasterKliuchQuest() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [progress, setProgress] = useState<Record<string, "done">>({});
  const [coins, setCoins] = useState<number>(0);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<SubmitResult | null>(null);
  const [checking, setChecking] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>("");

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
  }

  async function handleSubmit() {
    if (selected === null || activeId === null) return;
    setChecking(true);
    setSubmitError("");
    try {
      const result = await submitAnswer(activeId, selected);
      setFeedback(result);
      if (result.correct) {
        setProgress((p) => ({ ...p, [activeId]: "done" }));
        setCoins((c) => c + 10);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Не удалось отправить ответ.");
    } finally {
      setChecking(false);
    }
  }

  const activeIndex = tasks.findIndex((t) => t.id === activeId);
  const activeTask = tasks[activeIndex];
  const doneCount = Object.keys(progress).length;

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
    <div className="min-h-screen w-full" style={{ background: palette.bg }}>
      <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: `1px solid ${palette.cardBorder}` }}>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight" style={{ color: palette.text }}>Мастер Ключ</h1>
          <p className="text-sm" style={{ color: palette.muted }}>Пройди путь — открой все замки</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-full" style={{ background: palette.card, border: `1px solid ${palette.cardBorder}` }}>
          <Key size={16} style={{ color: palette.gold }} />
          <span className="font-bold" style={{ color: palette.gold }}>{coins}</span>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 py-10">
        <div className="text-center mb-8">
          <span className="text-sm" style={{ color: palette.muted }}>{doneCount} из {tasks.length} заданий открыто</span>
        </div>

        <div className="flex flex-col items-center gap-6">
          {tasks.map((task: Task, index: number) => {
            const unlocked = isUnlocked(index);
            const done = progress[task.id] === "done";
            const offset = index % 2 === 0 ? -36 : 36;
            const label = index + 1;
            return (
              <div key={task.id} className="flex flex-col items-center" style={{ transform: `translateX(${offset}px)` }}>
                <button
                  onClick={() => openTask(task, index)}
                  disabled={!unlocked}
                  aria-label={`Задание ${label}${done ? ", пройдено" : unlocked ? "" : ", закрыто"}`}
                  className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg transition-transform"
                  style={{
                    background: done ? palette.teal : unlocked ? palette.gold : palette.card,
                    color: done || unlocked ? "#1B1F2A" : palette.muted,
                    border: `2px solid ${done ? palette.teal : unlocked ? palette.gold : palette.cardBorder}`,
                    cursor: unlocked ? "pointer" : "not-allowed",
                    boxShadow: unlocked && !done ? `0 0 0 4px rgba(212,162,76,0.15)` : "none",
                  }}
                >
                  {done ? <Check size={22} /> : unlocked ? label : <Lock size={18} />}
                </button>
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
            className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: palette.card, border: `1px solid ${palette.cardBorder}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold" style={{ color: palette.gold }}>Задание {activeIndex + 1}</span>
              <button onClick={closeTask} aria-label="Закрыть" style={{ color: palette.muted }}><X size={18} /></button>
            </div>

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
              <div className="mb-4 px-4 py-3 rounded-xl flex items-start gap-2" style={{ background: feedback.correct ? "rgba(79,176,165,0.1)" : "rgba(193,90,69,0.1)" }}>
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
    </div>
  );
}