// ─────────────────────────────────────────────────────────────
// Vercel Serverless Function: GET /api/tasks
//
// Выполняется на сервере Vercel, а не в браузере пользователя.
// Благодаря этому:
//   1) запрос к 1С идёт сервер-сервер, поэтому CORS браузера тут
//      ни при чём (ограничение CORS применяется только к запросам
//      из браузера, а не между серверами);
//   2) логин/пароль от 1С хранятся в переменных окружения Vercel
//      и никогда не попадают в JS-бандл, который скачивает клиент;
// ⚠️ Как и раньше, этот эндпоинт отдаёт correctIndex вместе с
// заданием (компонент master_kliuch_quest.tsx использует его,
// чтобы подсветить правильный вариант и показать ответ по
// таймауту). Это по-прежнему значит, что ответ виден в
// Network-вкладке DevTools ДО того, как пользователь ответил —
// просто теперь хотя бы логин/пароль от 1С скрыты. Если захотите
// закрыть и эту дыру, дайте знать: понадобится доработать и
// master_kliuch_quest.tsx, чтобы он не читал correctIndex до
// получения результата с сервера.
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
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const fields = [
    "Ref_Key",
    "ТекстВопроса",
    "Вариант1",
    "Вариант2",
    "Вариант3",
    "Вариант4",
    "НомерПравильногоОтвета",
  ].join(",");

  try {
    const upstream = await fetch(
      `${TASKS_ENDPOINT}?$format=json&$select=${fields}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: authHeader(),
        },
      }
    );

    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: `1С вернул ошибку (${upstream.status}).`,
      });
      return;
    }

    const data = await upstream.json();
    const tasks = (data.value as any[]).map((item) => {
      const options = [item.Вариант1, item.Вариант2, item.Вариант3, item.Вариант4];
      const correctIndex = Number(item.НомерПравильногоОтвета) - 1;
      return {
        id: item.Ref_Key,
        question: item.ТекстВопроса,
        options,
        correctIndex,
        explanation: `Правильный ответ: «${options[correctIndex]}»`,
      };
    });

    res.status(200).json(tasks);
  } catch (err) {
    console.error("GET /api/tasks failed:", err);
    res.status(502).json({ error: "Не удалось связаться с 1С." });
  }
}
