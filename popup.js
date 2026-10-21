const btn = document.getElementById('btn');
const btnFromTopo = document.getElementById('btnFromTopo');
const status = document.getElementById('status');
const headingClipboard = document.getElementById('headingClipboard');
const btnSolwise = document.getElementById('btnSolwise');
const btnVisada = document.getElementById('btnVisada');
const pontosVisada = document.getElementById('pontosVisada');

const GMAPS_RE = /^https:\/\/(www\.)?google\.[a-z.]+\/maps/;

// Pontos da medição de distância detectada no Google Maps (exatamente 2) e a aba onde foi medida
let pontosMedicao = null;
let abaMedicao = null;

// Trunca (não arredonda) para 5 casas decimais, igual ao exemplo fornecido
function truncate5(num) {
  const factor = 100000;
  const truncated = Math.trunc(num * factor) / factor;
  return truncated.toFixed(5);
}

function setStatus(msg, isError = false) {
  status.textContent = msg;
  status.classList.toggle('error', isError);
}

// Tenta extrair um par lat,lon truncado a 5 casas decimais de um texto
function extractCoords(text) {
  const match = text.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  return {
    lat: truncate5(parseFloat(match[1])),
    lon: truncate5(parseFloat(match[2]))
  };
}

// Executada dentro da página do Google Maps (world MAIN).
// O Google Maps não expõe os pontos de "Medir distância" na URL nem no HTML: eles ficam num objeto
// interno com nomes ofuscados, que mudam a cada versão do site. Por isso a busca é pela forma do
// objeto, e não pelo nome: uma lista de pontos [_, lon, lat] acompanhada de outra lista do mesmo
// tamanho (as posições dos pontos no mapa).
function detectarMedicao() {
  const lonLat = p => {
    if (!p || typeof p !== 'object') return null;
    for (const k of Object.getOwnPropertyNames(p)) {
      const d = Object.getOwnPropertyDescriptor(p, k);
      const v = d && d.value;
      if (Array.isArray(v) && v.length === 3 && v[0] == null &&
          typeof v[1] === 'number' && typeof v[2] === 'number' &&
          Math.abs(v[1]) <= 180 && Math.abs(v[2]) <= 90 && (v[1] || v[2])) {
        return { lat: v[2], lon: v[1] };
      }
    }
    return null;
  };

  // Valores das propriedades do objeto, sem disparar getters
  const valores = o => {
    const out = [];
    for (const k of Object.getOwnPropertyNames(o)) {
      try {
        const d = Object.getOwnPropertyDescriptor(o, k);
        if (d && 'value' in d) out.push(d.value);
      } catch (e) {}
    }
    return out;
  };

  const encontradas = new Map();
  const fila = [window];
  const vistos = new Set(fila);
  const inicio = performance.now();

  for (let i = 0; i < fila.length && performance.now() - inicio < 3000; i++) {
    const o = fila[i];
    let vals;
    try {
      vals = o instanceof Map ? [...o.values()] : ArrayBuffer.isView(o) ? [] : valores(o);
    } catch (e) {
      continue;
    }

    const arrays = vals.filter(Array.isArray);
    for (const lista of arrays) {
      if (!lista.length) continue;
      const pts = lista.map(lonLat);
      if (pts.some(p => !p)) continue;
      if (!arrays.some(outra => outra !== lista && outra.length === lista.length)) continue;
      encontradas.set(JSON.stringify(pts), pts);
    }

    for (const v of vals) {
      if (v && (typeof v === 'object' || typeof v === 'function') && !vistos.has(v)) {
        vistos.add(v);
        fila.push(v);
      }
    }
  }

  return [...encontradas.values()];
}

// Executada na página do Google Maps: cobre a página com a visada (iframe da extensão) e um X para fechar
function abrirSobreposicao(url) {
  const ID = 'geolink-visada-sobreposicao';
  const anterior = document.getElementById(ID);
  if (anterior) anterior.remove();

  const fundo = document.createElement('div');
  fundo.id = ID;
  fundo.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#f7f7f8;';

  const frame = document.createElement('iframe');
  frame.src = url;
  frame.style.cssText = 'display:block;width:100%;height:100%;border:0;';

  const fechar = document.createElement('button');
  fechar.textContent = '×';
  fechar.title = 'Fechar (Esc)';
  fechar.style.cssText = 'position:absolute;top:10px;right:14px;width:36px;height:36px;padding:0;' +
    'border-radius:50%;border:1px solid #c8c8c8;background:#fff;color:#333;cursor:pointer;' +
    'font:24px/32px Arial,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,0.2);';

  const aoTeclar = e => { if (e.key === 'Escape') remover(); };
  // A página da visada (dentro do iframe) avisa quando o Esc é pressionado nela
  const aoReceber = e => { if (e.source === frame.contentWindow && e.data && e.data.geolink === 'fechar') remover(); };
  function remover() {
    fundo.remove();
    document.removeEventListener('keydown', aoTeclar, true);
    window.removeEventListener('message', aoReceber);
  }

  fechar.addEventListener('click', remover);
  document.addEventListener('keydown', aoTeclar, true);
  window.addEventListener('message', aoReceber);

  fundo.append(frame, fechar);
  document.body.appendChild(fundo);
}

// Distância em km entre dois pontos (fórmula de haversine)
function distanciaKm(a, b) {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(h));
}

// Habilita o botão do Solwise somente quando há uma medição de exatamente 2 pontos
async function checarMedicao(tab) {
  pontosMedicao = null;
  btnSolwise.disabled = true;
  btnVisada.disabled = true;

  if (!tab || !tab.url || !GMAPS_RE.test(tab.url)) {
    pontosVisada.textContent = 'Abra o Google Maps e meça a distância entre 2 pontos.';
    return;
  }

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: detectarMedicao
  });
  const medicoes = result || [];

  if (medicoes.length === 0) {
    pontosVisada.textContent = 'Nenhuma medição de distância aberta no Google Maps.';
  } else if (medicoes.length > 1) {
    pontosVisada.textContent = 'Encontrei mais de uma medição. Feche e meça novamente.';
  } else if (medicoes[0].length !== 2) {
    pontosVisada.textContent = `A medição tem ${medicoes[0].length} ponto(s). Meça apenas 2 pontos.`;
  } else {
    const [a, b] = medicoes[0];
    pontosMedicao = [a, b];
    abaMedicao = tab;
    pontosVisada.innerHTML = '';
    [
      `A: ${a.lat.toFixed(6)}, ${a.lon.toFixed(6)}`,
      `B: ${b.lat.toFixed(6)}, ${b.lon.toFixed(6)}`,
      `Distância: ${distanciaKm(a, b).toFixed(2)} km`
    ].forEach(linha => {
      const div = document.createElement('div');
      div.textContent = linha;
      pontosVisada.appendChild(div);
    });
    btnSolwise.disabled = false;
    btnVisada.disabled = false;
  }
}

// Ao abrir o popup: mostra se há coordenada copiada e habilita/desabilita o botão de Topográfico
async function init() {
  // Garante que o documento do popup está focado antes de ler a área de transferência
  window.focus();
  await new Promise(resolve => setTimeout(resolve, 50));

  // Checa a área de transferência
  try {
    const text = await navigator.clipboard.readText();
    const coords = extractCoords(text);
    if (coords) {
      headingClipboard.textContent = `Coordenada ${coords.lat}, ${coords.lon} Copiada`;
      btn.disabled = false;
    } else {
      headingClipboard.textContent = 'Nenhuma Coordenada Copiada';
      btn.disabled = true;
    }
  } catch (err) {
    headingClipboard.textContent = 'Nenhuma Coordenada Copiada';
    btn.disabled = true;
    setStatus('Falha ao ler área de transferência: ' + err.message, true);
  }

  // Checa se a aba ativa é do topographic-map.com
  let tab = null;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isTopo = !!(tab && tab.url && tab.url.includes('topographic-map.com'));
    btnFromTopo.disabled = !isTopo;
  } catch (err) {
    btnFromTopo.disabled = true;
  }

  // Checa se há uma medição de distância de 2 pontos no Google Maps
  try {
    await checarMedicao(tab);
  } catch (err) {
    btnSolwise.disabled = true;
    btnVisada.disabled = true;
    pontosVisada.textContent = 'Falha ao ler a medição: ' + err.message;
  }
}

init();

// Botões "?": mostram/ocultam a explicação de cada procedimento
document.querySelectorAll('button.ajuda').forEach(botao => {
  botao.addEventListener('click', () => {
    const texto = document.getElementById(botao.dataset.ajuda);
    texto.hidden = !texto.hidden;
    botao.setAttribute('aria-expanded', String(!texto.hidden));
  });
});

btnFromTopo.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url || !tab.url.includes('topographic-map.com')) {
      setStatus('Abra uma página do topographic-map.com antes de clicar.', true);
      return;
    }

    const u = new URL(tab.url);
    const popup = u.searchParams.get('popup');

    if (!popup) {
      setStatus('Não encontrei coordenadas ("popup") na URL desta página.', true);
      return;
    }

    const [lat, lon] = popup.split(',').map(s => decodeURIComponent(s).trim());
    const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

    await chrome.tabs.create({ url: gmapsUrl });
    setStatus(`Abrindo no Google Maps: ${lat}, ${lon}`);
  } catch (err) {
    setStatus('Erro ao ler a URL da aba: ' + err.message, true);
  }
});

btnVisada.addEventListener('click', async () => {
  if (!pontosMedicao) {
    setStatus('Meça a distância entre 2 pontos no Google Maps antes de clicar.', true);
    return;
  }
  const [a, b] = pontosMedicao;
  const url = chrome.runtime.getURL(`visada.html?a=${a.lat},${a.lon}&b=${b.lat},${b.lon}`);
  try {
    await chrome.scripting.executeScript({
      target: { tabId: abaMedicao.id },
      func: abrirSobreposicao,
      args: [url]
    });
    window.close();
  } catch (err) {
    setStatus('Não foi possível abrir a visada sobre o Google Maps: ' + err.message, true);
  }
});

btnSolwise.addEventListener('click', () => {
  if (!pontosMedicao) {
    setStatus('Meça a distância entre 2 pontos no Google Maps antes de clicar.', true);
    return;
  }
  // O service worker abre o Solwise e aplica os pontos (o popup fecha ao abrir a nova aba)
  chrome.runtime.sendMessage({ tipo: 'visadaSolwise', pontos: pontosMedicao });
  setStatus('Abrindo o Solwise...');
});

btn.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    const coords = extractCoords(text);

    if (!coords) {
      setStatus('Nenhuma coordenada válida encontrada na área de transferência.', true);
      return;
    }

    const { lat, lon } = coords;
    const url = `https://pt-br.topographic-map.com/map-g825k/Brasil/?center=${lat}%2C${lon}&zoom=12&popup=${lat}%2C${lon}`;

    await chrome.tabs.create({ url });
    setStatus(`Abrindo: ${lat}, ${lon}`);
  } catch (err) {
    setStatus('Erro ao ler a área de transferência: ' + err.message, true);
  }
});
