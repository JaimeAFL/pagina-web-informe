export default async function handler(req, res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({error:'Method not allowed'});

  await new Promise(r=>setTimeout(r, 600));

  const demo = {
    "explicacion": "Top ventas en el punto 22 de Madrid en el último mes. Se muestran los 3 productos líderes y su evolución semanal.",
    "kpis": [
      {"nombre":"Producto estrella","valor":"Zapatilla X-Pro","periodo":"Último mes"},
      {"nombre":"Unidades vendidas","valor": 842,"periodo":"Último mes"},
      {"nombre":"Ingresos","valor":"€ 27.450","periodo":"Último mes"}
    ],
    "grafico": {
      "tipo": "bar",
      "labels": ["Semana 1","Semana 2","Semana 3","Semana 4"],
      "datasets": [
        {"label":"Zapatilla X-Pro","data":[120,220,260,240]},
        {"label":"Camiseta DryFit","data":[80,130,150,160]},
        {"label":"Mochila Urban","data":[60,90,110,112]}
      ]
    },
    "tabla": [
      {"producto":"Zapatilla X-Pro","unidades":842,"ingresos":"€ 17.680"},
      {"producto":"Camiseta DryFit","unidades":540,"ingresos":"€ 5.940"},
      {"producto":"Mochila Urban","unidades":402,"ingresos":"€ 3.830"}
    ]
  };

  return res.status(200).json(demo);
}
