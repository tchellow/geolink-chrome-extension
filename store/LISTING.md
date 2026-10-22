# Chrome Web Store — textos para o cadastro

Copie cada bloco para o campo correspondente do Developer Dashboard.

## Aba "Store listing"

**Nome:** GeoLink

**Resumo** (vem do manifest, máx. 132 caracteres):
Leva coordenadas do Google Maps ao topographic-map.com e gera a visada (perfil de elevação e Fresnel) entre 2 pontos medidos.

**Categoria:** Ferramentas (Tools)

**Idioma:** Português (Brasil)

**Descrição:**

```
O GeoLink agiliza o trabalho com coordenadas no Google Maps e o planejamento de enlaces de rádio (LoRa, MeshCore, Wi-Fi, rádio enlace).

▶ GOOGLE MAPS → MAPA TOPOGRÁFICO
Copie uma coordenada no Google Maps (botão direito no ponto → clique na coordenada) e abra o GeoLink: um clique abre o mesmo ponto no topographic-map.com, com marcador.

▶ MAPA TOPOGRÁFICO → GOOGLE MAPS
Com um ponto marcado no topographic-map.com, um clique abre o mesmo local no Google Maps.

▶ VISADA ENTRE 2 PONTOS
Use "Medir distância" no Google Maps entre dois pontos e abra o GeoLink. Ele lê os pontos A e B e gera a visada sobre o próprio mapa:
• perfil do terreno (SRTM 30 m), com a curvatura da Terra (k = 4/3);
• linha de visada entre o topo das antenas e 1ª zona de Fresnel;
• diagnóstico: visada livre, Fresnel obstruída ou visada obstruída, com o ponto crítico marcado;
• distância, desnível, folga mínima e % de Fresnel livre;
• altura das antenas e frequência editáveis (padrão 915 MHz), com recálculo instantâneo.
Só são aceitas medições com exatamente 2 pontos. Também é possível abrir a visada na ferramenta de elevação do Solwise, já com os dois pontos.

Cada função tem um botão "?" no GeoLink explicando o passo a passo.

PRIVACIDADE
O GeoLink não tem servidor, não coleta dados pessoais e não usa rastreamento. As coordenadas só são enviadas ao serviço que você escolher ao clicar (topographic-map.com, Google Maps, OpenTopoData/Open-Meteo para altitudes, ou Solwise).

Código aberto: https://github.com/tchellow/geolink-chrome-extension
```

## Aba "Privacy practices"

**Single purpose (finalidade única):**
```
Ferramenta de coordenadas para o Google Maps: transfere coordenadas entre o Google Maps e o topographic-map.com e gera o perfil de visada (elevação do terreno e zona de Fresnel) entre dois pontos medidos no Google Maps, para planejamento de enlaces de rádio.
```

**Justificativa — clipboardRead:**
```
Ao abrir o popup, a extensão lê a área de transferência para detectar uma coordenada copiada no Google Maps (ex.: "-23.55052, -46.63330") e oferecer abri-la no topographic-map.com. O texto não é armazenado nem enviado; só a coordenada é usada, e apenas se o usuário clicar no botão.
```

**Justificativa — activeTab:**
```
Usada quando o usuário clica no ícone da extensão, para ler a URL da aba ativa (identificar se é Google Maps ou topographic-map.com e ler a coordenada da URL) e para ler a medição de distância aberta no Google Maps.
```

**Justificativa — scripting:**
```
Executa scripts somente após ação do usuário: (1) na aba do Google Maps, lê os dois pontos da medição "Medir distância" (que o Google Maps não expõe na URL) e abre a página da visada sobre o mapa; (2) na aba do Solwise aberta pela extensão, posiciona os dois marcadores e solicita o perfil de elevação.
```

**Justificativa — permissões de host:**
```
solwise.co.uk: aplicar os dois pontos na ferramenta de elevação do Solwise, quando o usuário escolhe essa opção.
api.opentopodata.org e api.open-meteo.com: obter a altitude do terreno ao longo da linha entre os dois pontos para desenhar o perfil de visada.
```

**Remote code:** "No, I am not using remote code" (todo o JavaScript está no pacote).

**Data usage — marque:**
- [x] Location (localização): coordenadas escolhidas pelo usuário, enviadas às APIs de elevação/sites escolhidos.
- [x] Website content (conteúdo do site): leitura da medição no Google Maps e da área de transferência.

E marque as três declarações:
- [x] Não vendo nem transfiro dados a terceiros fora dos casos de uso aprovados
- [x] Não uso nem transfiro dados para fins não relacionados à finalidade única
- [x] Não uso nem transfiro dados para determinar crédito ou para empréstimos

**Privacy policy URL:**
https://github.com/tchellow/geolink-chrome-extension/blob/main/PRIVACY.md

## Imagens necessárias

| Item | Tamanho | Obrigatório |
|---|---|---|
| Ícone da loja | 128×128 PNG | Sim (usar `icon128.png`) |
| Capturas de tela | 1280×800 ou 640×400, 1 a 5 | Sim, ao menos 1 |
| Bloco promocional pequeno | 440×280 | Recomendado |
| Bloco de destaque (marquee) | 1400×560 | Opcional |

Sugestões de capturas: (1) popup com os pontos A e B detectados; (2) visada livre sobre o Google Maps; (3) visada obstruída com o ponto crítico; (4) popup com a ajuda "?" aberta.
