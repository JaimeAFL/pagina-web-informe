// /api/ask.js  (Vercel, ESM)
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { pregunta } = req.body || {};
    if (!pregunta) return res.status(400).json({ error: 'Falta "pregunta"' });

    const asstId = process.env.ASSISTANT_ID;
    if (!process.env.OPENAI_API_KEY || !asstId) {
      return res.status(500).json({ error: 'Faltan variables OPENAI_API_KEY o ASSISTANT_ID' });
    }

    // 1) Crea hilo con el mensaje del usuario
    const thread = await client.beta.threads.create({
      messages: [{ role: "user", content: pregunta }]
    });

    // 2) Lanza el run del Assistant
    let run = await client.beta.threads.runs.create({
      thread_id: thread.id,
      assistant_id: asstId
    });

    // 3) Espera a que termine
    while (run.status === "queued" || run.status === "in_progress") {
      await new Promise(r => setTimeout(r, 1000));
      run = await client.beta.threads.runs.retrieve(thread.id, run.id);
    }
    if (run.status !== "completed") {
      // Devuelve error legible si requiere acciones o falló
      return res.status(500).json({ error: `Run ${run.status}`, details: run.last_error || null });
    }

    // 4) Lee los mensajes del hilo y toma el último del assistant
    const msgs = await client.beta.threads.messages.list(thread.id, { order: "desc", limit: 5 });
    const firstAssistant = msgs.data.find(m => m.role === "assistant");
    const textParts = (firstAssistant?.content || [])
      .filter(c => c.type === "text")
      .map(c => c.text.value);

    const raw = textParts.join("\n").trim();

    // 5) Extrae JSON estricto de la respuesta
    const json = safeParseJSON(raw);
    if (!json) {
      // Fallback mínimo si el Assistant no respetó el formato
      return res.status(200).json({
        explicacion: raw || "Sin contenido",
        kpis: [],
        grafico: { tipo: "bar", labels: [], datasets: [] },
        tabla: []
      });
    }

    return res.status(200).json(json);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

function safeParseJSON(s) {
  if (!s) return null;
  // intenta extraer bloque JSON aunque venga dentro de markdown
  const fence = s.match(/```(?:json)?\\s*([\\s\\S]*?)```/i);
  const candidate = fence ? fence[1] : s;
  try { return JSON.parse(candidate); } catch { /* try looser */ }
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(candidate.slice(start, end + 1)); } catch {}
  }
  return null;
}
