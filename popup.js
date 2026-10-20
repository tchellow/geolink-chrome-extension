const btn = document.getElementById('btn');
const btnFromTopo = document.getElementById('btnFromTopo');
const status = document.getElementById('status');
const headingClipboard = document.getElementById('headingClipboard');

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
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isTopo = !!(tab && tab.url && tab.url.includes('topographic-map.com'));
    btnFromTopo.disabled = !isTopo;
  } catch (err) {
    btnFromTopo.disabled = true;
  }
}

init();

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
