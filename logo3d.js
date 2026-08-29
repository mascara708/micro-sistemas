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

// Quantos pontos amostrar por contorno. 220 deixa as curvas do "M" lisas sem
// gerar geometria à toa — dobrar isso não muda nada visível.
const PONTOS_POR_CONTORNO = 220;

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
    contornos.push(pontos);
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

  // metalness BAIXO de propósito. A primeira versão usava 0.55 e a marca saía
  // quase preta: material metálico reflete o ambiente, e aqui não existe
  // ambiente nenhum pra refletir (não temos envMap — carregar um HDRI seria
  // mais peso ainda no que já são 670 KB). Sem nada refletindo, metal = escuro.
  // A tela de login do app usa metalness 0.96 porque LÁ o efeito procurado é
  // justamente um metal escuro perdido no fundo; aqui a marca tem que ler como
  // roxo da paleta, então ela é quase dielétrica, com o clearcoat dando o
  // brilho de verniz nas quinas.
  const material = new THREE.MeshPhysicalMaterial({
    color: ROXO_MEIO,
    metalness: 0.12,
    roughness: 0.34,
    clearcoat: 1,
    clearcoatRoughness: 0.18,
    emissive: new THREE.Color(ROXO_MEIO),
    emissiveIntensity: 0.3,
  });

  for (const pontos of contornos) {
    const forma = new THREE.Shape(pontos.map((p) => new THREE.Vector2(p.x, p.y)));
    const geometria = new THREE.ExtrudeGeometry(forma, {
      depth: 46,
      bevelEnabled: true,
      bevelThickness: 5,
      bevelSize: 4,
      bevelSegments: 3,
      curveSegments: 6,
    });
    // Centra a espessura no eixo Z pra peça girar em torno de si mesma, e não
    // em torno da face de trás (que faria ela "orbitar" em vez de girar).
    geometria.translate(0, 0, -23);
    grupo.add(new THREE.Mesh(geometria, material));
  }

  // A marca ocupa só um pedaço do viewBox (que é uma folha A4 de pé). Em vez de
  // chutar escala e posição, mede a geometria pronta e encaixa ela na tela.
  const limites = new THREE.Box3().setFromObject(grupo);
  const centro = limites.getCenter(new THREE.Vector3());
  const tamanho = limites.getSize(new THREE.Vector3());
  for (const malha of grupo.children) {
    malha.geometry.translate(-centro.x, -centro.y, -centro.z);
  }
  const escala = 300 / Math.max(tamanho.x, tamanho.y);
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
  const luzes = [
    [0xffffff, 3.4, [-280, 340, 520]],
    [ROXO_CLARO, 2.8, [340, -120, 400]],
    [ROXO_MEIO, 2.2, [-120, -320, -260]],
  ];
  for (const [cor, forca, posicao] of luzes) {
    const luz = new THREE.PointLight(cor, forca, 3000);
    luz.position.set(...posicao);
    cena.add(luz);
  }

  // ── Animação ───────────────────────────────────────────────────────────────
  let girando = true;
  let tempo = 0;

  // Não gasta GPU com a marca fora da tela: quando ela sai do campo de visão,
  // o laço para de desenhar. Numa landing page longa isso é a maior parte do
  // tempo de visita.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { girando = e.isIntersecting; })
      .observe(MONTAGEM);
  }

  const relogio = new THREE.Clock();

  function quadro() {
    requestAnimationFrame(quadro);
    if (!girando) return;
    tempo += relogio.getDelta();
    grupo.rotation.y = tempo * 0.55;
    // Balanço leve nos outros dois eixos: sem isso a peça parece presa num
    // espeto. Com isso ela parece flutuando.
    grupo.rotation.x = Math.sin(tempo * 0.6) * 0.18;
    grupo.position.y = Math.sin(tempo * 0.9) * 8;
    renderizador.render(cena, camera);
  }
  quadro();

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
// página, o aparelho pediu menos movimento, ou não tem WebGL. Em qualquer um
// deles o <img> de reserva que já está no HTML continua ali, e a página fica
// certa do mesmo jeito — só sem o giro.
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
  const comecar = () => montar().catch((e) => console.warn('[logo3d] não consegui montar:', e));
  if (document.readyState === 'complete') comecar();
  else window.addEventListener('load', comecar);
}
