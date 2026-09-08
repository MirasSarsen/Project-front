// ─────────────────────────────────────────────────────────────
// Vercel Serverless Function: POST /api/submit
// Body: { taskId: string, answerIndex: number }
//
// Проверка правильности ответа делается здесь, на сервере, а не
// в браузере: клиент никогда не получает НомерПравильногоОтвета
// заранее, только результат (correct: true/false) и объяснение
// уже ПОСЛЕ того, как пользователь ответил.
// ─────────────────────────────────────────────────────────────

export const config = { runtime: "nodejs" };

const ODATA_BASE_URL =
  "https://gos.masterkliuch.kz/WEB_BGU_Miras/odata/standard.odata";
const TASKS_ENDPOINT = `${ODATA_BASE_URL}/Catalog_Задачи`;

function authHeader(): string {
  const login = process.env.ODATA_LOGIN;
  const password = process.env.ODATA_PASSWORD;
  if (!login || !password) {
    throw new Error("ODATA_LOGIN / ODATA_PASSWORD не заданы в переменных окружения");
  }
  return "Basic " + Buffer.from(`${login}:${password}`).toString("base64");
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { taskId, answerIndex } = req.body ?? {};
  if (typeof taskId !== "string" || typeof answerIndex !== "number") {
    res.status(400).json({ error: "Нужны taskId (string) и answerIndex (number)." });
    return;
  }

  try {
    const upstream = await fetch(
      `${TASKS_ENDPOINT}(guid'${taskId}')?$format=json&$select=Вариант1,Вариант2,Вариант3,Вариант4,НомерПравильногоОтвета`,
      {
        headers: {
          Accept: "application/json",
          Authorization: authHeader(),
        },
      }
    );

    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: `1С не принял запрос (${upstream.status}).`,
      });
      return;
    }

    const item = await upstream.json();
    const options = [item.Вариант1, item.Вариант2, item.Вариант3, item.Вариант4];
    const correctIndex = Number(item.НомерПравильногоОтвета) - 1;

    res.status(200).json({
      correct: answerIndex === correctIndex,
      explanation: `Правильный ответ: «${options[correctIndex]}»`,
    });
  } catch (err) {
    console.error("POST /api/submit failed:", err);
    res.status(502).json({ error: "Не удалось проверить ответ." });
  }
}
