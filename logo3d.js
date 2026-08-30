// logo3d.js — a marca do Micro Sistemas como um sólido de verdade, girando.
//
// POR QUE NÃO É UMA IMAGEM GIRANDO
// A primeira tentativa foi CSS 3D com o PNG do ícone: frente, verso e um miolo
// entre os dois. Parece funcionar de frente e desmonta de lado — uma imagem não
// tem espessura, então de perfil ela vira uma linha, e o "miolo" (que é só mais
// um plano paralelo às faces) aparece como um bloco chapado em vez de uma
// borda. O truque se entrega. Aqui a marca é geometria mesmo: os contornos do
// SVG viram um sólido extrudado, com luz batendo nas laterais.
//
// COMO O SVG VIRA GEOMETRIA SEM SVGLoader
// O three.js tem um SVGLoader, mas ele é um addon que este projeto não tem
// vendorizado. Não precisa: quem já sabe interpretar "M504.65,167.2l35.62..."
// com perfeição é o próprio navegador. Então o SVG é jogado num <svg> fora da
// tela e cada <path> é amostrado com getPointAtLength() — o resultado são os
// pontos exatos do contorno, que viram um THREE.Shape. Zero parser escrito à
// mão, zero biblioteca a mais.
//
// CUSTO
// O three.module.min.js tem 670 KB. Numa landing page isso é muito pra pagar no
// carregamento inicial, então ele só é buscado DEPOIS que a página termina de
// carregar (e nem isso, se o aparelho pediu menos movimento ou a tela for
// pequena). Quem chega na página vê o texto e o botão de baixar na hora; a
// marca 3D entra depois, sem atrapalhar.

const MONTAGEM = document.getElementById('logo3d');

// Cores: as mesmas 5 da marca (ver style.css :root).
const ROXO_ESCURO = 0x4a1d96;
const ROXO_CLARO = 0xa984e8;
const ROXO_MEIO = 0x6b2fd1;

// Quantos pontos amostrar por contorno, ANTES de simplificar.
const PONTOS_POR_CONTORNO = 220;

// Tolerância da simplificação, em unidades do viewBox (a marca ocupa ~540×510
// dele). 1.5 apaga os pontos que estão em cima da reta e não mexe nas quinas.
const TOLERANCIA = 1.5;

// ── Por que simplificar o contorno ───────────────────────────────────────────
// Os "bugs de polígono" da marca nasciam aqui. getPointAtLength() amostra por
// COMPRIMENTO, então uma reta longa do "M" recebia dezenas de pontos quase
// colineares. Três estragos, todos visíveis:
//
//   1. A triangulação (earcut, dentro do ExtrudeGeometry) transforma essa fila
//      de pontos quase alinhados numa leva de triângulos-lasca, finos como
//      papel. Eles brigam entre si no z-buffer e piscam quando a peça gira.
//   2. O bisel é construído deslocando cada ponto pra dentro. Em pontos muito
//      próximos os deslocamentos se cruzam, e o bisel vira nó — as manchas e
//      dobras que apareciam nas bordas.
//   3. Custo à toa: 4 contornos × 220 pontos × 3 segmentos de bisel é geometria
//      demais pra um desenho que tem umas 20 quinas de verdade.
//
// Ramer–Douglas–Peucker resolve os três: guarda o ponto que se afasta da reta
// mais que a tolerância e joga fora o resto. As quinas ficam (elas são o desvio
// grande), as retas viram dois pontos.
function simplificar(pontos, tolerancia) {
  if (pontos.length < 3) return pontos;
  const manter = new Array(pontos.length).fill(false);
  manter[0] = manter[pontos.length - 1] = true;

  const pilha = [[0, pontos.length - 1]];
  while (pilha.length) {
    const [ini, fim] = pilha.pop();
    const ax = pontos[ini].x, ay = pontos[ini].y;
    const dx = pontos[fim].x - ax, dy = pontos[fim].y - ay;
    const norma = Math.hypot(dx, dy) || 1;

    let maior = tolerancia, iMaior = -1;
    for (let i = ini + 1; i < fim; i++) {
      // Distância do ponto até a reta ini→fim (produto vetorial / comprimento).
      const d = Math.abs((pontos[i].x - ax) * dy - (pontos[i].y - ay) * dx) / norma;
      if (d > maior) { maior = d; iMaior = i; }
    }
    if (iMaior !== -1) {
      manter[iMaior] = true;
      pilha.push([ini, iMaior], [iMaior, fim]);
    }
  }
  return pontos.filter((_, i) => manter[i]);
}

async function lerContornosDoSvg(url) {
  const texto = await fetch(url).then((r) => r.text());

  // O <svg> precisa estar no documento pra getPointAtLength() funcionar: fora
  // da árvore, o navegador não calcula geometria. Vai escondido e sai no fim.
  const caixa = document.createElement('div');
  caixa.setAttribute('aria-hidden', 'true');
  caixa.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;left:-9999px';
  caixa.innerHTML = texto;
  document.body.appendChild(caixa);

  const svg = caixa.querySelector('svg');
  const caixaVista = svg.viewBox.baseVal;   // 0 0 595.28 841.89
  const contornos = [];

  for (const path of svg.querySelectorAll('path')) {
    const comprimento = path.getTotalLength();
    const pontos = [];
    for (let i = 0; i < PONTOS_POR_CONTORNO; i++) {
      const p = path.getPointAtLength((i / PONTOS_POR_CONTORNO) * comprimento);
      // Centraliza na origem e inverte o Y: no SVG ele cresce pra baixo, no
      // three.js cresce pra cima. Sem isso a marca sai de cabeça pra baixo.
      pontos.push({
        x: p.x - caixaVista.width / 2,
        y: -(p.y - caixaVista.height / 2),
      });
    }
    contornos.push(simplificar(pontos, TOLERANCIA));
  }

  caixa.remove();
  return contornos;
}

async function montar() {
  const THREE = await import('./vendor/three.module.min.js');
  const contornos = await lerContornosDoSvg('img/logo-marca.svg');

  const largura = MONTAGEM.clientWidth;
  const altura = MONTAGEM.clientHeight;

  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, largura / altura, 1, 3000);
  camera.position.set(0, 0, 780);

  const renderizador = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderizador.setSize(largura, altura);
  // Trava em 2x: em telas 3x o ganho não se vê e o custo de GPU triplica.
  renderizador.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderizador.toneMapping = THREE.ACESFilmicToneMapping;
  // ACES dá highlights bonitos mas comprime tudo pra baixo: com exposição 1 a
  // marca saía chumbo em vez de roxo. 1.45 devolve a cor da paleta sem estourar
  // o branco das quinas.
  renderizador.toneMappingExposure = 1.45;
  MONTAGEM.appendChild(renderizador.domElement);

  // ── A marca ────────────────────────────────────────────────────────────────
  const grupo = new THREE.Group();

  // ── Ambiente pra refletir ──────────────────────────────────────────────────
  // Material metálico reflete o ambiente. Antes não existia ambiente nenhum, e
  // por isso o metalness tinha que ficar baixo (0.12): sem nada pra refletir,
  // metal fica PRETO. Carregar um HDRI resolveria, mas seriam mais centenas de
  // KB em cima dos 670 do three.js.
  //
  // A saída é fabricar o ambiente aqui: um "estúdio" de três painéis coloridos
  // que o PMREMGenerator converte no mapa que o material consulta. Custo em
  // bytes: zero. Custo em tempo: uma renderização, uma vez, na montagem.
  function estudio() {
    const palco = new THREE.Scene();
    const plano = new THREE.PlaneGeometry(1, 1);
    const painel = (cor, forca, pos, escala, giro) => {
      const m = new THREE.Mesh(plano, new THREE.MeshBasicMaterial({ color: cor }));
      m.material.color.multiplyScalar(forca);
      m.position.set(...pos);
      m.scale.set(...escala, 1);
      if (giro) m.rotation.set(...giro);
      palco.add(m);
      return m;
    };
    // Chave branca em cima-esquerda, do mesmo lado de onde a luz "vem" no resto
    // da página (ver .hero-brilho no style.css).
    painel(0xffffff, 3.2, [-3, 4, 2], [7, 5], [-0.5, 0.5, 0]);
    // Preenchimento roxo na direita: é o que mantém a peça dentro da paleta
    // mesmo na metade do giro em que a chave não bate.
    painel(ROXO_CLARO, 1.5, [4.5, -0.5, 1.5], [6, 6], [0, -0.9, 0]);
    // Piso escuro. Sem ele o reflexo fica uniforme e a peça perde o "em cima /
    // embaixo" — é o contraste que faz o brilho ANDAR quando ela gira.
    painel(ROXO_ESCURO, 0.5, [0, -5, 0], [12, 6], [Math.PI / 2.4, 0, 0]);
    return palco;
  }

  const pmrem = new THREE.PMREMGenerator(renderizador);
  const palco = estudio();
  cena.environment = pmrem.fromScene(palco, 0.03).texture;
  pmrem.dispose();
  palco.traverse((o) => { if (o.isMesh) o.material.dispose(); });

  // ── Os dois materiais ──────────────────────────────────────────────────────
  // O ExtrudeGeometry separa a geometria em dois grupos: 0 = as tampas (frente
  // e verso), 1 = a lateral inteira, bisel incluído. Passando um ARRAY de
  // materiais pro Mesh, cada grupo pega o seu — é assim que a face fica roxa e
  // o canto fica branco, sem precisar de duas malhas.
  const material = new THREE.MeshPhysicalMaterial({
    color: ROXO_MEIO,
    // Subiu de 0.12 pra 0.42 porque AGORA existe ambiente: o que antes deixava
    // a peça preta hoje é o que dá o reflexo pedido.
    metalness: 0.42,
    roughness: 0.26,
    envMapIntensity: 1.15,
    clearcoat: 1,
    clearcoatRoughness: 0.16,
    emissive: new THREE.Color(ROXO_MEIO),
    emissiveIntensity: 0.3,
  });

  // A lateral branca. Roughness bem baixo e metalness alto: é a parte que o
  // olho lê como "polido", e é onde o reflexo do estúdio aparece mais nítido.
  // Um resto de emissive impede que ela apague de vez na metade escura do giro
  // — foi pra isso que existia o contorno de linha, que agora saiu.
  const materialLado = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.55,
    roughness: 0.12,
    envMapIntensity: 1.5,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.10,
  });

  for (const pontos of contornos) {
    const forma = new THREE.Shape(pontos.map((p) => new THREE.Vector2(p.x, p.y)));
    const geometria = new THREE.ExtrudeGeometry(forma, {
      depth: 46,
      bevelEnabled: true,
      // O BISEL É O CONTORNO. Não dá pra engrossar linha em WebGL (o linewidth
      // do LineBasicMaterial é ignorado, e o Line2 é addon que este projeto não
      // vendoriza), então o contorno grosso aqui é geometria de verdade: o
      // bisel branco contorna a face roxa por todo o perímetro. Sendo sólido,
      // ele ainda pega luz e reflexo, coisa que linha nenhuma faria.
      //
      // 9 dá uma borda que se lê de longe sem comer o miolo do desenho. Passar
      // de ~12 e os biséis de duas quinas vizinhas começam a se encontrar nos
      // braços finos do "M".
      bevelThickness: 7,
      bevelSize: 9,
      // 2 segmentos, não 3: com o contorno já simplificado, o bisel é quina
      // viva: mais segmentos só arredondariam a borda que a gente quer chapada.
      bevelSegments: 2,
      curveSegments: 6,
    });
    // Centra a espessura no eixo Z pra peça girar em torno de si mesma, e não
    // em torno da face de trás (que faria ela "orbitar" em vez de girar).
    geometria.translate(0, 0, -23);

    grupo.add(new THREE.Mesh(geometria, [material, materialLado]));
  }

  // A marca ocupa só um pedaço do viewBox (que é uma folha A4 de pé). Em vez de
  // chutar escala e posição, mede a geometria pronta e encaixa ela na tela.
  const limites = new THREE.Box3().setFromObject(grupo);
  const centro = limites.getCenter(new THREE.Vector3());
  const tamanho = limites.getSize(new THREE.Vector3());
  for (const malha of grupo.children) {
    malha.geometry.translate(-centro.x, -centro.y, -centro.z);
  }
  // 340 unidades num quadro que mostra ~537 (2·780·tan(19°), da câmera acima):
  // a peça ocupa 63% da altura visível. Era 300 (56%), e sobrava moldura vazia
  // demais em volta. Não dá pra subir muito mais: no pico do balanço ela chega
  // a ~186 unidades do centro contra 268 de meia-altura, e passar disso começa
  // a cortar o "M" na hora que ele inclina.
  const escala = 340 / Math.max(tamanho.x, tamanho.y);
  grupo.scale.setScalar(escala);

  cena.add(grupo);

  // ── Luz ────────────────────────────────────────────────────────────────────
  // Mesma receita da tela de login do app (login3d-mobile.js): uma ambiente
  // fraca pra nada ficar preto puro, e pontuais coloridas pra marca ganhar
  // brilho nas quinas quando gira.
  cena.add(new THREE.AmbientLight(0x8f7ac4, 1.6));

  // A principal é branca e vem de cima-esquerda (de onde a luz "vem" no resto
  // da página, ver o .hero-brilho no style.css). As duas roxas são de
  // preenchimento: tiram o preto das faces viradas pro outro lado e mantêm a
  // peça na paleta mesmo na metade escura do giro.
  const luzes = [];
  for (const [cor, forca, posicao] of [
    [0xffffff, 3.4, [-280, 340, 520]],
    [ROXO_CLARO, 2.8, [340, -120, 400]],
    [ROXO_MEIO, 2.2, [-120, -320, -260]],
  ]) {
    const luz = new THREE.PointLight(cor, forca, 3000);
    luz.position.set(...posicao);
    cena.add(luz);
    luzes.push(luz);
  }

  // ── Animação ───────────────────────────────────────────────────────────────
  // O que estava aqui antes era um metrônomo: rotation.y = tempo * 0.55, sempre
  // a mesma volta na mesma velocidade, pra sempre. Objeto de verdade não se
  // move assim. Três coisas mudam isso, e nenhuma delas é "mais rotação":
  //
  //   1. A peça REPARA em quem está olhando. Inclina na direção do ponteiro
  //      com mola amortecida, então tem peso: parte devagar e assenta.
  //   2. A LUZ anda. Duas das pontuais orbitam, e o reflexo varre os biséis. É
  //      isso que faz ler como peça usinada em vez de render parado — sem isso
  //      o brilho fica cravado na mesma quina a visita inteira.
  //   3. A velocidade RESPIRA. Os senos têm frequências incomensuráveis (0.37,
  //      0.61, 0.23, 0.89), então o movimento nunca fecha um período visível.
  let visivel = true;
  let laco = 0;
  let tempo = 0;

  // Ângulo acumulado, e não derivado do tempo: é o que deixa a velocidade
  // variar sem a peça dar um salto no quadro em que ela muda.
  let anguloY = 0;

  // Alvo do ponteiro (-1..1) e o valor amortecido que de fato é aplicado.
  const alvo = { x: 0, y: 0 };
  const suave = { x: 0, y: 0 };
  let proximidade = 0;        // 0 = ponteiro longe, 1 = em cima da marca
  let proximidadeSuave = 0;

  // Entrada: a marca chega girando e assenta, em vez de simplesmente aparecer.
  const ENTRADA = 1.7;
  let entrada = 0;
  const escalaFinal = escala;
  grupo.scale.setScalar(0.0001);
  // A lateral branca entra acendendo junto com a escala. Era o contorno de
  // linha que fazia esse papel antes de ele virar bisel sólido.
  const EMISSIVO_LADO = materialLado.emissiveIntensity;
  materialLado.emissiveIntensity = 0;

  // Só escuta o ponteiro onde ele existe. Em telefone não há cursor, e a peça
  // fica no movimento próprio — que já basta.
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener('pointermove', (e) => {
      // Normaliza pela janela: a marca acompanha o ponteiro pela primeira tela
      // inteira, e não só quando ele passa por cima dela (que é área pequena).
      alvo.x = (e.clientX / window.innerWidth) * 2 - 1;
      alvo.y = (e.clientY / window.innerHeight) * 2 - 1;

      // Distância até o centro da marca, medida em raios dela. Perto = acorda.
      const r = MONTAGEM.getBoundingClientRect();
      const d = Math.hypot(e.clientX - (r.left + r.width / 2),
                           e.clientY - (r.top + r.height / 2));
      proximidade = Math.max(0, 1 - d / (r.width * 2.4));
    }, { passive: true });

    document.addEventListener('pointerleave', () => {
      alvo.x = 0; alvo.y = 0; proximidade = 0;
    }, { passive: true });
  }

  const relogio = new THREE.Clock();

  // Fora da tela o laço PARA de verdade. Antes ele continuava agendando quadro
  // pra cair no `if (!girando) return` logo em seguida — o desenho era pulado,
  // mas o rAF seguia na fila do navegador a visita inteira. Cancelar de fato
  // tira a página da lista de quem pede quadro.
  function acordar() {
    if (laco) return;
    relogio.getDelta();               // descarta o tempo parado
    laco = requestAnimationFrame(quadro);
  }
  function dormir() {
    if (laco) { cancelAnimationFrame(laco); laco = 0; }
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      visivel = e.isIntersecting;
      if (visivel && !document.hidden) acordar(); else dormir();
    }).observe(MONTAGEM);
  }
  // Aba escondida não compõe quadro: o navegador engasga o rAF e entrega tudo
  // de uma vez ao voltar. Melhor parar e recomeçar limpo.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && visivel) acordar(); else dormir();
  });

  function quadro() {
    laco = requestAnimationFrame(quadro);
    // Teto no passo: se a aba engasgou um instante, dt não vem gigante e a peça
    // não dá meia volta num quadro só.
    const dt = Math.min(relogio.getDelta(), 0.05);
    tempo += dt;

    // ── Entrada ──
    if (entrada < 1) {
      entrada = Math.min(1, entrada + dt / ENTRADA);
      // easeOutBack: passa um triz do tamanho final e volta. É o "assentar".
      const t = entrada - 1;
      grupo.scale.setScalar(escalaFinal * (1 + 2.15 * t * t * t + 1.35 * t * t));
      materialLado.emissiveIntensity = EMISSIVO_LADO * entrada;
      // Chega girando: uma volta e meia que desacelera até parar no lugar.
      anguloY = -Math.PI * 1.5 * (1 - entrada) * (1 - entrada);
    } else {
      // Base 0.5 rad/s variando ±0.16, mais um empurrão quando o ponteiro
      // chega perto: a peça acelera de leve, como se tivesse notado.
      anguloY += (0.5 + Math.sin(tempo * 0.37) * 0.16 + proximidadeSuave * 0.55) * dt;
    }

    // ── Mola do ponteiro ──
    // Amortecimento corrigido pelo dt (1-e^-k·dt): mesmo tempo de acomodação
    // em tela de 60Hz e de 144Hz. Com fator fixo por quadro, monitor rápido
    // acomoda rápido demais e a peça fica nervosa.
    const k = 1 - Math.exp(-4.2 * dt);
    suave.x += (alvo.x - suave.x) * k;
    suave.y += (alvo.y - suave.y) * k;
    proximidadeSuave += (proximidade - proximidadeSuave) * (1 - Math.exp(-3 * dt));

    // A inclinação do ponteiro entra como DESVIO por cima do giro, nunca somada
    // ao acumulador — somar faria a peça tombar de vez em vez de voltar.
    grupo.rotation.y = anguloY + suave.x * 0.32;
    grupo.rotation.x = Math.sin(tempo * 0.61) * 0.14 + suave.y * 0.34;
    grupo.rotation.z = Math.sin(tempo * 0.23) * 0.05 - suave.x * 0.06;

    // Flutua, e desliza um triz CONTRA o ponteiro: paralaxe ao contrário dá a
    // leitura de que a peça está num plano mais fundo que o cursor.
    grupo.position.y = Math.sin(tempo * 0.89) * 7 - suave.y * 9;
    grupo.position.x = -suave.x * 11;

    // ── A luz anda ──
    luzes[1].position.set(
      Math.cos(tempo * 0.34) * 430,
      Math.sin(tempo * 0.27) * 260 - 60,
      Math.sin(tempo * 0.34) * 300 + 320,
    );
    luzes[2].position.set(
      Math.cos(tempo * -0.19 + 2.1) * 380,
      Math.sin(tempo * 0.41 + 1.2) * 300 - 140,
      Math.cos(tempo * 0.22) * 260 - 200,
    );

    // O verniz esquenta com o ponteiro perto. Sutil de propósito: 0.3 → 0.62 o
    // olho percebe, e além disso vira pisca-pisca.
    material.emissiveIntensity = 0.3 + proximidadeSuave * 0.32;

    renderizador.render(cena, camera);
  }
  acordar();

  window.addEventListener('resize', () => {
    const l = MONTAGEM.clientWidth;
    const a = MONTAGEM.clientHeight;
    if (!l || !a) return;
    renderizador.setSize(l, a);
    camera.aspect = l / a;
    camera.updateProjectionMatrix();
  });

  MONTAGEM.classList.add('logo3d--pronto');
}

// ── Quando (e se) vale a pena ────────────────────────────────────────────────
// Três motivos pra nem carregar os 670 KB: o elemento não existe naquela
// página, o aparelho pediu menos movimento, ou não tem WebGL.
//
// Nesses casos quem entra em cena é a marca parada — mas ela precisa ser
// LIGADA, e não apenas "continuar ali": desde 29/08/2026 a reserva nasce com
// opacity 0 no CSS, pra não piscar na cara de quem vai receber o 3D daqui a
// meio segundo. Sem este aviso, quem não tem WebGL ficaria com um buraco.
function semTresD() {
  if (MONTAGEM) MONTAGEM.classList.add('logo3d--sem3d');
}

function temWebGL() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch (e) {
    return false;
  }
}

if (MONTAGEM && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && temWebGL()) {
  // Depois do load: primeiro a página fica usável (texto, botão de baixar),
  // e só então a marca 3D entra.
  const comecar = () => montar().catch((e) => {
    console.warn('[logo3d] não consegui montar:', e);
    semTresD();   // falhou no meio do caminho: mostra a marca parada
  });
  if (document.readyState === 'complete') comecar();
  else window.addEventListener('load', comecar);
} else {
  // Não vai ter 3D nenhum: liga a marca parada agora.
  semTresD();
}
