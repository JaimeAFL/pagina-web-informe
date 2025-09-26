// /api/ask.js  (Vercel, Node serverless, sin dependencias)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENAI_API_KEY;
  const asstId = process.env.ASSISTANT_ID;
  if (!apiKey || !asstId) {
    return res.status(500).json({ error: 'Faltan OPENAI_API_KEY o ASSISTANT_ID' });
  }

  try {
    const { pregunta } = req.body || {};
    if (!pregunta) return res.status(400).json({ error: 'Falta "pregunta"' });

    // helper fetch a OpenAI
    const oi = async (path, method='GET', body=null) => {
      const r = await fetch('https://api.openai.com/v1' + path, {
        method,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : null
      });
      if (!r.ok) {
        const t = await r.text();
        console.error('OpenAI error', r.status, t);
        throw new Error(`OpenAI ${r.status}: ${t}`);
      }
      return r.json();
    };

    // 1) Crear thread con el mensaje del usuario
    const thread = await oi('/threads', 'POST', {
      messages: [{ role: 'user', content: pregunta }]
    });

    // 2) Lanzar run del Assistant
    let run = await oi(`/threads/${thread.id}/runs`, 'POST', {
      assistant_id: asstId
    });

    // 3) Poll hasta completar
    for (let i=0; i<60 && (run.status === 'queued' || run.status === 'in_progress'); i++) {
      await new Promise(r => setTimeout(r, 1000));
      run = await oi(`/threads/${thread.id}/runs/${run.id}`);
    }
    if (run.status !== 'completed') {
      console.error('Run no completed:', run.status, run.last_error);
      return res.status(500).json({ error: `Run ${run.status}`, details: run.last_error || null });
    }

    // 4) Leer mensajes del hilo
    const msgs = await oi(`/threads/${thread.id}/messages?order=desc&limit=5`);
    const firstAssistant = (msgs.data || []).find(m => m.role === 'assistant');
    const textParts = (firstAssistant?.content || [])
      .filter(c => c.type === 'text')
      .map(c => c.text.value);
    const raw = (textParts.join('\n') || '').trim();

    // 5) Extraer JSON de forma segura
    const json = safeParseJSON(raw);
    if (!json) {
      return res.status(200).json({
        explicacion: raw || 'Sin contenido',
        kpis: [],
        grafico: { tipo: 'bar', labels: [], datasets: [] },
        tabla: []
      });
    }

    return res.status(200).json(json);

  } catch (e) {
    console.error('Handler error:', e);
    return res.status(500).json({ error: e.message });
  }
}

function safeParseJSON(s) {
  if (!s) return null;
  const fence = s.match(/```(?:json)?\\s*([\\s\\S]*?)```/i);
  const candidate = fence ? fence[1] : s;
  try { return JSON.parse(candidate); } catch {}
  const a = candidate.indexOf('{'), b = candidate.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(candidate.slice(a, b+1)); } catch {} }
  return null;
}
