// ─────────────────────────────────────────────────────────────
// Слой доступа к данным заданий.
//
// USE_MOCK = true — сейчас используются только заглушки (mockTasks).
// Код обращения к реальному 1С (через /api/tasks и /api/submit —
// см. папку /api в корне проекта) закомментирован ниже, а не удалён:
// когда 1С снова будет доступен, достаточно раскомментировать
// fetchTasksReal/submitAnswerReal и переключить USE_MOCK на false.
// ─────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface SubmitResult {
  correct: boolean;
  explanation: string;
}

const USE_MOCK = false;

const mockTasks: Task[] = [
  { id: "t1", question: "Реши: 12 × 7 − 15 = ?", options: ["69", "74", "84", "99"], correctIndex: 0, explanation: "12×7=84, 84−15=69." },
  { id: "t2", question: "Какое число лишнее: 4, 9, 16, 20, 25?", options: ["4", "9", "20", "25"], correctIndex: 2, explanation: "Остальные — точные квадраты (2²,3²,4²,5²)." },
  { id: "t3", question: "Сумма углов треугольника равна:", options: ["90°", "180°", "270°", "360°"], correctIndex: 1, explanation: "Классическая теорема геометрии." },
  { id: "t4", question: "Синоним слова «стремительный»:", options: ["медленный", "быстрый", "тихий", "громкий"], correctIndex: 1, explanation: "«Стремительный» значит «очень быстрый»." },
  { id: "t5", question: "3/4 от 200 это:", options: ["100", "125", "150", "175"], correctIndex: 2, explanation: "200 ÷ 4 × 3 = 150." },
  { id: "t6", question: "Столица Казахстана:", options: ["Алматы", "Астана", "Шымкент", "Караганда"], correctIndex: 1, explanation: "С 1997 года столица — Астана." },
  { id: "t7", question: "Найди следующее число: 2, 6, 12, 20, ?", options: ["28", "30", "32", "24"], correctIndex: 1, explanation: "Разница растёт на 2: +4, +6, +8, +10." },
  { id: "t8", question: "Антоним слова «начало»:", options: ["старт", "конец", "середина", "исток"], correctIndex: 1, explanation: "«Начало» ↔ «конец»." },
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTasksReal(): Promise<Task[]> {
  let response: Response;
  try {
    response = await fetch("/api/tasks", {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new Error("Не удалось связаться с сервером. Проверьте соединение.");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Сервер вернул ошибку (${response.status}).`);
  }

  return response.json();
}

async function submitAnswerReal(taskId: string, answerIndex: number): Promise<SubmitResult> {
  let response: Response;
  try {
    response = await fetch("/api/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ taskId, answerIndex }),
    });
  } catch {
    throw new Error("Не удалось проверить ответ. Проверьте соединение.");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Сервер не принял запрос (${response.status}).`);
  }

  return response.json();
}

export async function fetchTasks(): Promise<Task[]> {
  if (USE_MOCK) {
    await delay(500);
    return mockTasks;
  }
  return fetchTasksReal();
}

export async function submitAnswer(taskId: string, answerIndex: number): Promise<SubmitResult> {
  if (USE_MOCK) {
    await delay(400);
    const task = mockTasks.find((t) => t.id === taskId);
    if (!task) throw new Error("Задание не найдено.");
    return { correct: answerIndex === task.correctIndex, explanation: task.explanation };
  }
  return submitAnswerReal(taskId, answerIndex);
}
