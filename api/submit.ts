export const config = { runtime: "nodejs" };

const SUBMIT_ENDPOINT =
  "https://gos.masterkliuch.kz/WEB_BGU_Miras/hs/quest/submit";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { taskId, answerIndex } = req.body ?? {};

  if (
    typeof taskId !== "string" ||
    typeof answerIndex !== "number"
  ) {
    res.status(400).json({
      error: "Нужны taskId (string) и answerIndex (number).",
    });
    return;
  }

  try {
    const upstream = await fetch(SUBMIT_ENDPOINT, {
      method: "POST",

      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        taskId,
        answerIndex,
      }),
    });

    const text = await upstream.text();

    if (!upstream.ok) {
      console.error(
        "1C POST /submit error:",
        upstream.status,
        text
      );

      res.status(upstream.status).json({
        error: 1С не принял запрос (${upstream.status}).,
      });

      return;
    }

    let result;

    try {
      result = JSON.parse(text);
    } catch {
      console.error("1C returned invalid JSON:", text);

      res.status(502).json({
        error: "1С вернул некорректный JSON.",
      });

      return;
    }

    res.status(200).json(result);

  } catch (err) {
    console.error("POST /api/submit failed:", err);

    res.status(502).json({
      error: "Не удалось проверить ответ.",
    });
  }
}