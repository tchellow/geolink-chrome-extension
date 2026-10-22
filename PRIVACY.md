# Política de Privacidade — GeoLink

Última atualização: 22 de outubro de 2026

O GeoLink é uma extensão para o Google Chrome que leva coordenadas do Google Maps ao topographic-map.com e gera a visada (perfil de elevação) entre dois pontos. Esta política explica quais dados a extensão usa e para quê.

## Resumo

- O GeoLink **não coleta, não armazena em servidores e não vende** dados pessoais.
- O GeoLink **não tem servidor próprio**, não usa contas de usuário nem ferramentas de análise ou rastreamento.
- As coordenadas só são enviadas a serviços de terceiros quando **você clica** num botão da extensão, e apenas para a função escolhida.

## Dados usados pela extensão

| Dado | Quando | Para quê | Para onde vai |
|---|---|---|---|
| Texto da área de transferência | Ao abrir o popup | Detectar uma coordenada copiada (ex.: `-23.55052, -46.63330`) | Não sai do seu computador. Só a coordenada encontrada é usada, e só se você clicar no botão |
| Endereço (URL) da aba ativa | Ao abrir o popup | Saber se a aba é do Google Maps ou do topographic-map.com e ler a coordenada da URL | Não sai do seu computador |
| Pontos da medição "Medir distância" do Google Maps | Ao abrir o popup numa aba do Google Maps | Mostrar os pontos A e B e gerar a visada | Não sai do seu computador, a menos que você clique num botão de visada |
| Coordenadas dos pontos | Ao clicar em um botão | Abrir o local ou gerar a visada | Para o serviço escolhido (veja abaixo) |
| Altura das antenas e frequência | Ao editar na página da visada | Lembrar os últimos valores usados | Armazenamento local do navegador (não sai do seu computador) |

## Serviços de terceiros

As coordenadas são enviadas somente ao serviço correspondente ao botão clicado:

- **Abrir Mapa Topográfico** → [topographic-map.com](https://pt-br.topographic-map.com) (a coordenada vai na URL da página aberta).
- **Abrir esta localização no Google Maps** → [Google Maps](https://www.google.com/maps).
- **Gerar visada (GeoLink)** → coordenadas de pontos ao longo da linha entre A e B são enviadas a [OpenTopoData](https://www.opentopodata.org) e, se ele estiver indisponível, ao [Open-Meteo](https://open-meteo.com), apenas para obter a altitude do terreno.
- **Gerar visada no Solwise** → os dois pontos são aplicados na ferramenta [Solwise](https://www.solwise.co.uk/wireless-elevationtool.html), que consulta o serviço de elevação do Google.

Cada um desses serviços tem a sua própria política de privacidade. Nenhum outro dado (nome, e-mail, histórico de navegação etc.) é enviado.

## Permissões

- `clipboardRead`: ler a coordenada copiada, ao abrir o popup.
- `activeTab`: acessar a aba ativa somente quando você clica no ícone da extensão.
- `scripting`: ler a medição de distância no Google Maps, abrir a visada sobre o mapa e aplicar os pontos no Solwise.
- Acesso a `solwise.co.uk`, `api.opentopodata.org` e `api.open-meteo.com`: usar esses serviços conforme descrito acima.

## Contato

Dúvidas ou solicitações: abra uma *issue* em https://github.com/tchellow/geolink-chrome-extension/issues

## Alterações

Mudanças nesta política serão publicadas nesta página, com a data de atualização.
