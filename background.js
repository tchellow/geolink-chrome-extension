const SOLWISE_URL = 'https://www.solwise.co.uk/wireless-elevationtool.html';

// O popup fecha assim que a aba do Solwise é aberta, por isso a abertura e a
// aplicação dos pontos ficam aqui no service worker
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.tipo === 'visadaSolwise') {
    abrirVisadaSolwise(msg.pontos)
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, erro: err.message }));
    return true;
  }
});

async function abrirVisadaSolwise(pontos) {
  const tab = await chrome.tabs.create({ url: SOLWISE_URL });
  await esperarCarregamento(tab.id);

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: aplicarPontosSolwise,
    args: [pontos]
  });

  if (!result || !result.ok) {
    const erro = 'GeoLink: não foi possível gerar a visada no Solwise (' + (result ? result.erro : 'sem resposta da página') + ').';
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: msg => alert(msg), args: [erro] });
    throw new Error(erro);
  }
}

function esperarCarregamento(tabId) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(ouvir);
      reject(new Error('Tempo esgotado ao carregar o Solwise'));
    }, 30000);

    function ouvir(id, info) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(ouvir);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(ouvir);
    // Caso a aba tenha terminado de carregar antes do listener ser registrado
    chrome.tabs.get(tabId).then(tab => { if (tab.status === 'complete') ouvir(tabId, tab); });
  });
}

// Executada dentro da página do Solwise (world MAIN), usando as funções da própria ferramenta:
// é o mesmo que posicionar os dois marcadores à mão e pedir o perfil de elevação
async function aplicarPontosSolwise(pontos) {
  const espera = ms => new Promise(resolve => setTimeout(resolve, ms));
  const aguardar = async (condicao, tentativas) => {
    for (let i = 0; i < tentativas; i++) {
      if (condicao()) return true;
      await espera(500);
    }
    return condicao();
  };

  // init() da ferramenta só roda depois que o Maps e o Google Charts carregam
  const pronta = () =>
    typeof elev_resetApp === 'function' &&
    typeof placeMarker === 'function' &&
    typeof queryElevationProfile === 'function' &&
    typeof elev_map !== 'undefined' && elev_map &&
    typeof elev_chart !== 'undefined' && elev_chart &&
    typeof elevationService !== 'undefined';

  // O gráfico usa google.maps.geometry (plotElevationProfile), mas a página carrega o Maps sem
  // libraries=geometry: o módulo só aparece quando o próprio Maps o carrega sozinho. Clicando à mão
  // dá tempo; aqui o perfil chegaria antes do módulo e o gráfico falharia
  const temGeometry = () => !!(google.maps.geometry && google.maps.geometry.spherical);

  // O texto "Total Distance" é escrito pelo Solwise logo antes de desenhar o gráfico
  const graficoGerado = () => {
    const info = document.getElementById('googleChartInfo');
    return !!(info && info.innerHTML.trim());
  };

  try {
    if (!await aguardar(pronta, 40)) {
      return { ok: false, erro: 'a ferramenta do Solwise não terminou de carregar' };
    }

    if (!temGeometry() && google.maps.importLibrary) {
      await google.maps.importLibrary('geometry');
    }

    elev_resetApp();
    pontos.forEach(p => placeMarker(new google.maps.LatLng(p.lat, p.lon)));

    if (!await aguardar(temGeometry, 20)) {
      return { ok: false, erro: 'biblioteca geometry do Google Maps não carregou' };
    }

    // Pede o perfil e confere se o gráfico saiu; repete algumas vezes se a resposta falhar
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      queryElevationProfile();
      if (await aguardar(graficoGerado, 16)) return { ok: true };
    }
    return {
      ok: false,
      erro: 'o Google não devolveu o perfil de elevação; a cota usada pelo Solwise provavelmente se esgotou. ' +
        'Use o botão "Gerar visada (GeoLink)"'
    };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}
