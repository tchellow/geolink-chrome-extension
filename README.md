# GeoLink

<img src="icon128.png" alt="GeoLink" width="64">

Extensão para Google Chrome que alterna rapidamente uma coordenada entre o **Google Maps** e o **[topographic-map.com](https://pt-br.topographic-map.com)**.

## Funcionalidades

- **Google Maps → Mapa topográfico**: copie uma coordenada (ex.: `-23.55052, -46.63330`, como o Google Maps copia ao clicar no ponto) e abra o popup da extensão. Ela detecta a coordenada na área de transferência e o botão **Abrir Mapa Topográfico** abre o local no topographic-map.com, com zoom 12 e marcador. As coordenadas são truncadas para 5 casas decimais.
- **Mapa topográfico → Google Maps**: com uma página do topographic-map.com aberta (com um ponto marcado, parâmetro `popup` na URL), o botão **Abrir esta localização no Google Maps** abre o mesmo ponto no Google Maps.

## Instalação

1. Clone ou baixe este repositório.
2. Acesse `chrome://extensions` e ative o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta do projeto.

## Permissões

| Permissão | Uso |
|---|---|
| `clipboardRead` | Ler a coordenada copiada |
| `tabs` / `activeTab` | Ler a URL da aba atual e abrir novas abas |

## Estrutura

- `manifest.json` — manifesto da extensão (Manifest V3)
- `popup.html` / `popup.js` — interface e lógica do popup
- `icon*.png`, `geolink.png` — ícones
