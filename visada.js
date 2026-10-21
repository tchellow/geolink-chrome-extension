const R_TERRA = 6371000;       // raio médio da Terra (m)
const K_REFRACAO = 4 / 3;      // fator k da atmosfera padrão (refração)
const VEL_LUZ = 299792458;     // m/s
const LOTE = 100;              // pontos por chamada (limite das duas APIs)
const FRESNEL_MIN = 0.6;       // fração da 1ª zona de Fresnel que deve ficar livre
const CHAVE_PREFS = 'geolink.visada';

const el = id => document.getElementById(id);
const inputA = el('alturaA');
const inputB = el('alturaB');
const inputFreq = el('freq');
const estado = el('estado');
const svg = el('grafico');
const dica = el('dica');

// Perfil do terreno já buscado: as alturas/frequência só mudam o cálculo, não refazem a busca
let perfil = null;
let calculo = null;

function setEstado(msg, isError = false) {
  estado.textContent = msg;
  estado.classList.toggle('error', isError);
  estado.hidden = false;
}

function lerPonto(nome) {
  const valor = new URLSearchParams(location.search).get(nome);
  if (!valor) return null;
  const [lat, lon] = valor.split(',').map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

const rad = g => g * Math.PI / 180;
const graus = r => r * 180 / Math.PI;

// Ângulo central entre dois pontos (fórmula de haversine)
function distanciaAngular(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * Math.asin(Math.sqrt(h));
}

// Ponto na fração f (0..1) do arco de círculo máximo entre a e b
function pontoIntermediario(a, b, f, delta) {
  const A = Math.sin((1 - f) * delta) / Math.sin(delta);
  const B = Math.sin(f * delta) / Math.sin(delta);
  const x = A * Math.cos(rad(a.lat)) * Math.cos(rad(a.lon)) + B * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon));
  const y = A * Math.cos(rad(a.lat)) * Math.sin(rad(a.lon)) + B * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon));
  const z = A * Math.sin(rad(a.lat)) + B * Math.sin(rad(b.lat));
  return { lat: graus(Math.atan2(z, Math.hypot(x, y))), lon: graus(Math.atan2(y, x)) };
}

const espera = ms => new Promise(resolve => setTimeout(resolve, ms));

// OpenTopoData (SRTM 30 m): gratuita, máx. 100 pontos e 1 chamada por segundo
async function buscarOpenTopoData(pontos) {
  const alturas = [];
  const lotes = Math.ceil(pontos.length / LOTE);
  for (let i = 0; i < lotes; i++) {
    setEstado(`Buscando elevações no OpenTopoData (${i + 1}/${lotes})...`);
    if (i > 0) await espera(1100);
    const locs = pontos.slice(i * LOTE, (i + 1) * LOTE)
      .map(p => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`)
      .join('|');
    const resp = await fetch(`https://api.opentopodata.org/v1/srtm30m?locations=${encodeURIComponent(locs)}`);
    if (!resp.ok) throw new Error(`OpenTopoData respondeu HTTP ${resp.status}`);
    const json = await resp.json();
    if (json.status !== 'OK') throw new Error(json.error || json.status);
    json.results.forEach(r => alturas.push(r.elevation));
  }
  return alturas;
}

// Open-Meteo (Copernicus 90 m): reserva, gratuita para uso não comercial
async function buscarOpenMeteo(pontos) {
  const alturas = [];
  const lotes = Math.ceil(pontos.length / LOTE);
  for (let i = 0; i < lotes; i++) {
    setEstado(`Buscando elevações no Open-Meteo (${i + 1}/${lotes})...`);
    const lote = pontos.slice(i * LOTE, (i + 1) * LOTE);
    const lats = lote.map(p => p.lat.toFixed(6)).join(',');
    const lons = lote.map(p => p.lon.toFixed(6)).join(',');
    const resp = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`);
    if (!resp.ok) throw new Error(`Open-Meteo respondeu HTTP ${resp.status}`);
    const json = await resp.json();
    if (!Array.isArray(json.elevation)) throw new Error(json.reason || 'resposta inválida do Open-Meteo');
    alturas.push(...json.elevation);
  }
  return alturas;
}

// Pontos sem dado (falhas do modelo) recebem a altura do vizinho válido mais próximo
function preencherVazios(alturas) {
  if (alturas.every(v => v == null)) throw new Error('sem dados de elevação para este trajeto');
  let ultimo = alturas.find(v => v != null);
  return alturas.map(v => (v == null ? ultimo : (ultimo = v)));
}

async function carregarPerfil(a, b) {
  const delta = distanciaAngular(a, b);
  const total = delta * R_TERRA;
  if (total < 1) throw new Error('os pontos A e B são iguais');

  // Uma amostra a cada ~30 m (resolução do SRTM), entre 100 e 300 amostras
  const n = Math.min(300, Math.max(100, Math.ceil(total / 30) + 1));
  const pontos = Array.from({ length: n }, (_, i) => pontoIntermediario(a, b, i / (n - 1), delta));

  let alturas;
  let fonte;
  try {
    alturas = await buscarOpenTopoData(pontos);
    fonte = 'OpenTopoData · SRTM 30 m';
  } catch (err) {
    console.warn('OpenTopoData falhou, usando Open-Meteo:', err);
    alturas = await buscarOpenMeteo(pontos);
    fonte = 'Open-Meteo · Copernicus DEM 90 m (OpenTopoData indisponível)';
  }

  return {
    total,
    fonte,
    dist: pontos.map((_, i) => total * i / (n - 1)),
    terreno: preencherVazios(alturas)
  };
}

function lerNumero(input, padrao, minimo) {
  const v = parseFloat(input.value);
  return Number.isFinite(v) && v >= minimo ? v : padrao;
}

// Linha de visada entre o topo das antenas, com o terreno elevado pela curvatura da Terra
function calcular() {
  const hA = lerNumero(inputA, 0, 0);
  const hB = lerNumero(inputB, 0, 0);
  const fMHz = lerNumero(inputFreq, 915, 1);
  const lambda = VEL_LUZ / (fMHz * 1e6);
  const { dist, terreno, total } = perfil;
  const n = dist.length;
  const yA = terreno[0] + hA;
  const yB = terreno[n - 1] + hB;

  const linhas = dist.map((d, i) => {
    const bojo = d * (total - d) / (2 * K_REFRACAO * R_TERRA);
    const solo = terreno[i] + bojo;
    const visada = yA + (yB - yA) * d / total;
    const fresnel = Math.sqrt(lambda * d * (total - d) / total);
    return { i, d, terreno: terreno[i], solo, visada, fresnel, folga: visada - solo };
  });

  // Ponto mais crítico: menor folga e menor fração livre da zona de Fresnel (sem as pontas)
  let pior = null;
  let piorFresnel = null;
  for (let i = 1; i < n - 1; i++) {
    const p = linhas[i];
    if (!pior || p.folga < pior.folga) pior = p;
    const razao = p.folga / p.fresnel;
    if (!piorFresnel || razao < piorFresnel.razao) piorFresnel = { ...p, razao };
  }

  return { hA, hB, fMHz, yA, yB, total, linhas, pior, piorFresnel };
}

function passoBonito(intervalo, divisoes) {
  const bruto = intervalo / divisoes;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const norm = bruto / mag;
  return (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
}

const fmt = (v, casas = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

function desenhar() {
  const c = calculo;
  const L = c.linhas;
  const W = svg.clientWidth || 900;
  const H = 380;
  const m = { l: 58, r: 18, t: 18, b: 42 };
  const larg = W - m.l - m.r;
  const alt = H - m.t - m.b;

  let yMin = Math.min(...L.map(p => p.solo));
  let yMax = Math.max(...L.map(p => Math.max(p.solo, p.visada + p.fresnel)));
  const folgaEixo = (yMax - yMin) * 0.06 || 10;
  yMin -= folgaEixo;
  yMax += folgaEixo;
  const passoY = passoBonito(yMax - yMin, 6);
  yMin = Math.floor(yMin / passoY) * passoY;
  yMax = Math.ceil(yMax / passoY) * passoY;

  const x = d => m.l + d / c.total * larg;
  const y = v => m.t + (yMax - v) / (yMax - yMin) * alt;
  const base = m.t + alt;
  const pts = arr => arr.map(([d, v]) => `${x(d).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  let s = '';

  // Grade e eixos
  for (let v = yMin; v <= yMax + 1e-9; v += passoY) {
    s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="#ececec"/>`;
    s += `<text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#666">${fmt(v)}</text>`;
  }
  const passoX = passoBonito(c.total / 1000, 8);
  for (let km = 0; km <= c.total / 1000 + 1e-9; km += passoX) {
    const px = x(km * 1000);
    s += `<line x1="${px}" x2="${px}" y1="${m.t}" y2="${base}" stroke="#f3f3f3"/>`;
    s += `<text x="${px}" y="${base + 16}" text-anchor="middle" font-size="11" fill="#666">${fmt(km, passoX < 1 ? 1 : 0)}</text>`;
  }
  s += `<text x="${m.l + larg / 2}" y="${H - 6}" text-anchor="middle" font-size="12" fill="#444">Distância de A (km)</text>`;
  s += `<text transform="translate(14 ${m.t + alt / 2}) rotate(-90)" text-anchor="middle" font-size="12" fill="#444">Altitude (m)</text>`;

  // 1ª zona de Fresnel
  const sup = L.map(p => [p.d, p.visada + p.fresnel]);
  const inf = L.map(p => [p.d, p.visada - p.fresnel]).reverse();
  s += `<polygon points="${pts(sup.concat(inf))}" fill="rgba(26,115,232,0.10)" stroke="#1a73e8" stroke-width="1" stroke-dasharray="4 3"/>`;

  // Terreno (com a curvatura da Terra)
  s += `<polygon points="${x(0)},${base} ${pts(L.map(p => [p.d, p.solo]))} ${x(c.total)},${base}" fill="#c8b29a" stroke="#7a5c3e" stroke-width="1.5"/>`;

  // Antenas e linha de visada
  const ultimo = L[L.length - 1];
  s += `<line x1="${x(0)}" y1="${y(L[0].solo)}" x2="${x(0)}" y2="${y(c.yA)}" stroke="#333" stroke-width="3"/>`;
  s += `<line x1="${x(c.total)}" y1="${y(ultimo.solo)}" x2="${x(c.total)}" y2="${y(c.yB)}" stroke="#333" stroke-width="3"/>`;
  s += `<line x1="${x(0)}" y1="${y(c.yA)}" x2="${x(c.total)}" y2="${y(c.yB)}" stroke="#d93025" stroke-width="2"/>`;
  s += `<circle cx="${x(0)}" cy="${y(c.yA)}" r="4" fill="#d93025"/>`;
  s += `<circle cx="${x(c.total)}" cy="${y(c.yB)}" r="4" fill="#d93025"/>`;
  s += `<text x="${x(0) + 8}" y="${y(c.yA) - 8}" font-size="13" font-weight="700" fill="#222">A</text>`;
  s += `<text x="${x(c.total) - 8}" y="${y(c.yB) - 8}" text-anchor="end" font-size="13" font-weight="700" fill="#222">B</text>`;

  // Ponto mais crítico
  const p = c.pior;
  const corPior = p.folga < 0 ? '#c5221f' : c.piorFresnel.razao < FRESNEL_MIN ? '#e37400' : '#137333';
  s += `<line x1="${x(p.d)}" y1="${y(p.solo)}" x2="${x(p.d)}" y2="${y(p.visada)}" stroke="${corPior}" stroke-width="1.5" stroke-dasharray="3 3"/>`;
  s += `<circle cx="${x(p.d)}" cy="${y(p.solo)}" r="5" fill="${corPior}" stroke="#fff" stroke-width="1.5"/>`;

  // Cursor do mouse
  s += `<line id="cursorLinha" y1="${m.t}" y2="${base}" stroke="#555" stroke-width="1" visibility="hidden"/>`;
  s += `<circle id="cursorPonto" r="4" fill="#fff" stroke="#555" stroke-width="2" visibility="hidden"/>`;

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = s;
  svg._escala = { x, y, m, larg };
}

function moverCursor(evento) {
  if (!calculo || !svg._escala) return;
  const { x, y, m, larg } = svg._escala;
  const caixa = svg.getBoundingClientRect();
  const px = (evento.clientX - caixa.left) * (svg.viewBox.baseVal.width / caixa.width);
  const f = (px - m.l) / larg;
  if (f < 0 || f > 1) return esconderCursor();

  const L = calculo.linhas;
  const p = L[Math.round(f * (L.length - 1))];
  const linha = el('cursorLinha');
  const ponto = el('cursorPonto');
  linha.setAttribute('x1', x(p.d));
  linha.setAttribute('x2', x(p.d));
  linha.setAttribute('visibility', 'visible');
  ponto.setAttribute('cx', x(p.d));
  ponto.setAttribute('cy', y(p.solo));
  ponto.setAttribute('visibility', 'visible');

  dica.innerHTML = '';
  [
    `${fmt(p.d / 1000, 2)} km de A`,
    `Terreno: ${fmt(p.terreno)} m`,
    `Visada: ${fmt(p.visada)} m`,
    `Folga: ${fmt(p.folga, 1)} m`,
    `Fresnel livre: ${fmt(Math.max(0, p.folga / p.fresnel) * 100)}%`
  ].forEach(t => {
    const div = document.createElement('div');
    div.textContent = t;
    dica.appendChild(div);
  });
  dica.hidden = false;

  const wrap = el('graficoWrap').getBoundingClientRect();
  const esquerda = evento.clientX - wrap.left;
  dica.style.top = `${evento.clientY - wrap.top + 12}px`;
  dica.style.left = esquerda > wrap.width / 2 ? '' : `${esquerda + 14}px`;
  dica.style.right = esquerda > wrap.width / 2 ? `${wrap.width - esquerda + 14}px` : '';
}

function esconderCursor() {
  dica.hidden = true;
  ['cursorLinha', 'cursorPonto'].forEach(id => {
    const e = el(id);
    if (e) e.setAttribute('visibility', 'hidden');
  });
}

function mostrarResumo() {
  const c = calculo;
  const L = c.linhas;
  const pior = c.pior;
  const pf = c.piorFresnel;
  const fresnelLivre = Math.max(0, pf.razao) * 100;
  const meio = L[Math.round((L.length - 1) / 2)];

  const diag = el('diagnostico');
  if (pior.folga < 0) {
    diag.className = 'obstruida';
    diag.textContent = `❌ Visada obstruída: o terreno passa ${fmt(-pior.folga, 1)} m acima da linha a ${fmt(pior.d / 1000, 2)} km de A.`;
  } else if (pf.razao < FRESNEL_MIN) {
    diag.className = 'aviso';
    diag.textContent = `⚠️ Visada livre, mas a zona de Fresnel está obstruída: só ${fmt(fresnelLivre)}% livre a ${fmt(pf.d / 1000, 2)} km de A (recomendado ≥ ${FRESNEL_MIN * 100}%).`;
  } else {
    diag.className = 'ok';
    diag.textContent = `✅ Visada livre, com pelo menos ${fmt(Math.min(fresnelLivre, 100))}% da zona de Fresnel desobstruída.`;
  }

  const cartoes = [
    ['Distância', `${fmt(c.total / 1000, 2)} km`, ''],
    ['Terreno em A / B', `${fmt(L[0].terreno)} / ${fmt(L[L.length - 1].terreno)} m`, `Antenas: ${fmt(c.hA)} m / ${fmt(c.hB)} m`],
    ['Desnível (B − A)', `${fmt(L[L.length - 1].terreno - L[0].terreno)} m`, 'entre os terrenos'],
    ['Folga mínima', `${fmt(pior.folga, 1)} m`, `a ${fmt(pior.d / 1000, 2)} km de A`],
    ['Fresnel livre (mínimo)', `${fmt(fresnelLivre)}%`, `a ${fmt(pf.d / 1000, 2)} km de A`],
    ['Raio de Fresnel no meio', `${fmt(meio.fresnel, 1)} m`, `${fmt(c.fMHz)} MHz`]
  ];
  const resumo = el('resumo');
  resumo.innerHTML = '';
  cartoes.forEach(([rotulo, valor, detalhe]) => {
    const card = document.createElement('div');
    card.className = 'cartao';
    [['rotulo', rotulo], ['valor', valor], ['detalhe', detalhe]].forEach(([classe, texto]) => {
      const div = document.createElement('div');
      div.className = classe;
      div.textContent = texto;
      card.appendChild(div);
    });
    resumo.appendChild(card);
  });

  el('nota').textContent =
    `Elevação: ${perfil.fonte}, ${L.length} amostras. O terreno inclui a curvatura da Terra com refração ` +
    `padrão (k = 4/3). A área azul é a 1ª zona de Fresnel; recomenda-se manter ao menos 60% dela livre. ` +
    `O modelo de elevação não mostra detalhes menores que a sua resolução: prédios, árvores e pequenos ` +
    `morros podem não aparecer, então considere uma margem.`;
}

function atualizar() {
  if (!perfil) return;
  calculo = calcular();
  desenhar();
  mostrarResumo();
  salvarPrefs();
}

function salvarPrefs() {
  try {
    localStorage.setItem(CHAVE_PREFS, JSON.stringify({ hA: inputA.value, hB: inputB.value, f: inputFreq.value }));
  } catch (e) {}
}

function carregarPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(CHAVE_PREFS) || 'null');
    if (p) {
      if (p.hA !== undefined) inputA.value = p.hA;
      if (p.hB !== undefined) inputB.value = p.hB;
      if (p.f !== undefined) inputFreq.value = p.f;
    }
  } catch (e) {}
}

function mostrarPontos(a, b) {
  const pontos = el('pontos');
  [['A', a], ['B', b]].forEach(([nome, p]) => {
    const span = document.createElement('span');
    const rotulo = document.createElement('b');
    rotulo.textContent = `${nome}: `;
    span.appendChild(rotulo);
    span.appendChild(document.createTextNode(`${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`));
    pontos.appendChild(span);
  });
}

async function iniciar() {
  const a = lerPonto('a');
  const b = lerPonto('b');
  if (!a || !b) {
    setEstado('Coordenadas inválidas. Abra esta página pelo botão "Gerar visada" do GeoLink.', true);
    return;
  }
  document.title = `Visada ${a.lat.toFixed(4)}, ${a.lon.toFixed(4)} → ${b.lat.toFixed(4)}, ${b.lon.toFixed(4)} — GeoLink`;
  mostrarPontos(a, b);

  try {
    perfil = await carregarPerfil(a, b);
    estado.hidden = true;
    el('resultado').hidden = false;
    atualizar();
  } catch (err) {
    setEstado('Não foi possível obter as elevações: ' + err.message, true);
    const tentar = document.createElement('button');
    tentar.textContent = 'Tentar de novo';
    tentar.addEventListener('click', iniciarDeNovo);
    estado.appendChild(tentar);
  }
}

function iniciarDeNovo() {
  el('pontos').innerHTML = '';
  iniciar();
}

carregarPrefs();
[inputA, inputB, inputFreq].forEach(input => input.addEventListener('input', atualizar));
svg.addEventListener('mousemove', moverCursor);
svg.addEventListener('mouseleave', esconderCursor);
window.addEventListener('resize', () => { if (calculo) desenhar(); });
// Aberta sobre o Google Maps: o Esc aqui dentro também fecha a sobreposição
if (window.top !== window) {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') window.parent.postMessage({ geolink: 'fechar' }, '*');
  });
}
iniciar();
