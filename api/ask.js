// /api/ask.js  (sin SDK, con header Beta)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENAI_API_KEY;
  const asstId = process.env.ASSISTANT_ID;
  if (!apiKey || !asstId) return res.status(500).json({ error: 'Faltan OPENAI_API_KEY o ASSISTANT_ID' });

  try {
    const { pregunta } = req.body || {};
    if (!pregunta) return res.status(400).json({ error: 'Falta "pregunta"' });

    // Helper con el header requerido: OpenAI-Beta: assistants=v2
    const oi = async (path, method='GET', body=null) => {
      const r = await fetch('https://api.openai.com/v1' + path, {
        method,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        },
        body: body ? JSON.stringify(body) : null
      });
      if (!r.ok) throw new Error(`OpenAI ${r.status}: ` + await r.text());
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
    for (let i=0; i<60 && (run.status==='queued'||run.status==='in_progress'); i++) {
      await new Promise(r => setTimeout(r, 1000));
      run = await oi(`/threads/${thread.id}/runs/${run.id}`);
    }
    if (run.status !== 'completed') {
      return res.status(500).json({ error: `Run ${run.status}`, details: run.last_error || null });
    }

    // 4) Leer mensajes del hilo
    const msgs = await oi(`/threads/${thread.id}/messages?order=desc&limit=5`);
    const firstAssistant = (msgs.data||[]).find(m => m.role === 'assistant');
    const text = (firstAssistant?.content||[])
      .filter(c=>c.type==='text')
      .map(c=>c.text.value)
      .join('\n')
      .trim();

    // 5) Extraer JSON o fallback
    const json = safeParseJSON(text) || {
      explicacion: text || 'Sin contenido',
      kpis: [],
      grafico: { tipo:'bar', labels: [], datasets: [] },
      tabla: []
    };
    return res.status(200).json(json);

  } catch (e) {
    console.error('Handler error:', e);
    return res.status(500).json({ error: e.message });
  }
}

function safeParseJSON(s){
  if (!s) return null;
  const f = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const c = f ? f[1] : s;
  try { return JSON.parse(c); } catch {}
  const a=c.indexOf('{'), b=c.lastIndexOf('}'); if(a>=0&&b>a){ try{ return JSON.parse(c.slice(a,b+1)); }catch{} }
  return null;
}
