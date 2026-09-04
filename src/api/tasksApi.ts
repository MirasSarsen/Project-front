// ─────────────────────────────────────────────────────────────
// Слой доступа к данным заданий.
//
// USE_MOCK = false — данные берутся из справочника "Задачи" в 1С
// через стандартный OData-интерфейс.
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

const ODATA_BASE_URL = "https://gos.masterkliuch.kz/WEB_BGU_Miras/odata/standard.odata";
const TASKS_ENDPOINT = `${ODATA_BASE_URL}/Catalog_Задачи`;

// ⚠️ ВНИМАНИЕ: логин/пароль, зашитые прямо во фронтенд, видны любому
// через DevTools (вкладка Network), а вместе с задачами наружу уходит
// и НомерПравильногоОтвета — то есть правильные ответы можно подсмотреть
// в исходном JSON ещё до того, как отвечать. Для реального прод-использования
// лучше вернуться к варианту с HTTP-сервисом (см. предыдущее обсуждение),
// где сервер сам решает, верно ли, и наружу отдаёт только id/question/options.
const ODATA_LOGIN = "Miras_ADMIN";
const ODATA_PASSWORD = "Passw0rd!";

function authHeader(): string {
  return "Basic " + btoa(`${ODATA_LOGIN}:${ODATA_PASSWORD}`);
}

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

// Приводит одну запись OData к формату Task, который ожидает фронтенд.
function mapODataItem(item: any): Task {
  const options = [item.Вариант1, item.Вариант2, item.Вариант3, item.Вариант4];
  // НомерПравильногоОтвета в 1С хранится 1-based (1..4), во фронтенде — 0-based.
  const correctIndex = Number(item.НомерПравильногоОтвета) - 1;
  return {
    id: item.Ref_Key,
    question: item.ТекстВопроса,
    options,
    correctIndex,
    explanation: `Правильный ответ: «${options[correctIndex]}»`,
  };
}

export async function fetchTasks(): Promise<Task[]> {
  if (USE_MOCK) {
    await delay(500);
    return mockTasks;
  }

  const fields = ["Ref_Key", "ТекстВопроса", "Вариант1", "Вариант2", "Вариант3", "Вариант4", "НомерПравильногоОтвета"].join(",");

  let response: Response;
  try {
    response = await fetch(`${TASKS_ENDPOINT}?$format=json&$select=${fields}`, {
      headers: {
        Accept: "application/json",
        Authorization: authHeader(),
      },
    });
  } catch {
    throw new Error("Не удалось связаться с сервером. Проверьте соединение.");
  }

  if (!response.ok) {
    throw new Error(`Сервер вернул ошибку (${response.status}).`);
  }

  const data = await response.json();
  return (data.value as any[]).map(mapODataItem);
}

export async function submitAnswer(taskId: string, answerIndex: number): Promise<SubmitResult> {
  if (USE_MOCK) {
    await delay(400);
    const task = mockTasks.find((t) => t.id === taskId);
    if (!task) throw new Error("Задание не найдено.");
    return { correct: answerIndex === task.correctIndex, explanation: task.explanation };
  }

  // Проверка ответа делается на клиенте: тянем этот же элемент справочника
  // по Ref_Key и сравниваем НомерПравильногоОтвета. Это самый простой вариант
  // без отдельного документа "Результаты" — но он не сохраняет статистику
  // ответов пользователя. Если понадобится хранить историю прохождений,
  // нужно будет завести отдельный документ и писать в него через HTTP-сервис.
  let response: Response;
  try {
    response = await fetch(
      `${TASKS_ENDPOINT}(guid'${taskId}')?$format=json&$select=Вариант1,Вариант2,Вариант3,Вариант4,НомерПравильногоОтвета`,
      {
        headers: {
          Accept: "application/json",
          Authorization: authHeader(),
        },
      }
    );
  } catch {
    throw new Error("Не удалось проверить ответ. Проверьте соединение.");
  }

  if (!response.ok) {
    throw new Error(`Сервер не принял запрос (${response.status}).`);
  }

  const item = await response.json();
  const options = [item.Вариант1, item.Вариант2, item.Вариант3, item.Вариант4];
  const correctIndex = Number(item.НомерПравильногоОтвета) - 1;

  return {
    correct: answerIndex === correctIndex,
    explanation: `Правильный ответ: «${options[correctIndex]}»`,
  };
}