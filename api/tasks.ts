// Vercel Serverless Function: GET /api/tasks

export const config = { runtime: "nodejs" };

const TASKS_ENDPOINT =
  "https://gos.masterkliuch.kz/WEB_BGU_Miras/hs/quest/tasks";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const upstream = await fetch(TASKS_ENDPOINT, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!upstream.ok) {
      const text = await upstream.text();

      console.error("1C GET /tasks error:", upstream.status, text);

      res.status(upstream.status).json({
        error: `1С вернул ошибку (${upstream.status}).`,
      });
      return;
    }

    const tasks = await upstream.json();

    res.status(200).json(tasks);
  } catch (err) {
    console.error("GET /api/tasks failed:", err);

    res.status(502).json({
      error: "Не удалось связаться с 1С.",
    });
  }
}