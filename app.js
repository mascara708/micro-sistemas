// app.js — o pouco de comportamento que a página tem.
//
// Tudo aqui é enfeite ou conveniência: com o JavaScript desligado, a página
// continua legível e todo botão de comprar/baixar continua funcionando (são
// links de verdade). O carrossel só para no primeiro quadro e a vitrine mostra
// todos os programas sem filtro — que é o estado certo mesmo.

(function () {
  'use strict';

  var menosMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Menu do celular ──────────────────────────────────────────────────────
  var botao = document.getElementById('menu-botao');
  var menu = document.querySelector('.menu');
  if (botao && menu) {
    botao.addEventListener('click', function () {
      var aberto = menu.classList.toggle('e-aberto');
      botao.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    });
    menu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        menu.classList.remove('e-aberto');
        botao.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ── Carrossel do hero ────────────────────────────────────────────────────
  // As telas trocam sozinhas a cada 4,5s. Para quando o mouse está em cima
  // (a pessoa está olhando aquela), quando o teclado entra no bloco, quando a
  // aba sai de foco (senão o navegador acumula troca pra fazer de uma vez ao
  // voltar) e pra quem pediu menos movimento no sistema.
  var slides = [].slice.call(document.querySelectorAll('.slide'));
  var pontos = [].slice.call(document.querySelectorAll('.ponto'));
  if (slides.length > 1) {
    var atual = 0;
    var timer = null;
    var parado = false;

    function mostrar(i) {
      atual = (i + slides.length) % slides.length;
      slides.forEach(function (s, n) {
        var e = n === atual;
        s.classList.toggle('e-ativo', e);
        // O slide fora do ar some por opacity, mas continuaria sendo lido em
        // voz alta sem isto — as cinco legendas seguidas, como se a tela
        // mostrasse as cinco.
        if (e) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
      });
      pontos.forEach(function (p, n) {
        var e = n === atual;
        p.classList.toggle('e-ativo', e);
        p.setAttribute('aria-selected', e ? 'true' : 'false');
        // Roving tabindex: Tab entra e sai do grupo de abas numa parada só; a
        // troca entre elas é com as setas, logo abaixo.
        p.tabIndex = e ? 0 : -1;
      });
    }
    function tocar() {
      // document.hidden entra aqui, e não só no visibilitychange lá embaixo,
      // porque aquele evento só dispara na MUDANÇA: quem abre a página numa
      // aba de fundo (clique do meio, sessão restaurada) já nasce escondido,
      // nunca dispara nada, e o carrossel girava sozinho numa aba que ninguém
      // está vendo — acumulando justamente as trocas que ele existe pra evitar.
      if (timer || parado || menosMovimento || document.hidden) return;
      timer = setInterval(function () { mostrar(atual + 1); }, 4500);
    }
    function pausar() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    pontos.forEach(function (p) {
      p.addEventListener('click', function () {
        mostrar(parseInt(p.dataset.ir, 10));
        pausar(); tocar();
      });
    });

    // Setas entre as abas, como manda o padrão de tablist. Move o foco junto
    // com a seleção, senão o foco fica pra trás numa aba que não é mais a ativa.
    var grupo = document.querySelector('.pontos');
    if (grupo) {
      grupo.addEventListener('keydown', function (e) {
        var passo =
          e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 :
          e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        var destino =
          passo ? atual + passo :
          e.key === 'Home' ? 0 :
          e.key === 'End' ? slides.length - 1 : null;
        if (destino === null) return;
        e.preventDefault();
        mostrar(destino);
        pontos[atual].focus();
      });
    }

    var palco = document.getElementById('carrossel');
    if (palco) {
      palco.addEventListener('mouseenter', function () { parado = true; pausar(); });
      palco.addEventListener('mouseleave', function () { parado = false; tocar(); });
    }

    // WCAG 2.2.2 (Pausar, Parar, Ocultar): quem navega pelo teclado não tem
    // "mouse em cima" pra segurar o carrossel. Sem isto a tela troca sozinha
    // embaixo de quem acabou de chegar numa aba com Tab. O foco em qualquer
    // ponto do bloco para o giro, e ele só volta quando o foco sai.
    var bloco = palco && palco.closest('.hero-app');
    if (bloco) {
      bloco.addEventListener('focusin', function () { parado = true; pausar(); });
      bloco.addEventListener('focusout', function (e) {
        if (bloco.contains(e.relatedTarget)) return;
        parado = false; tocar();
      });
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pausar(); else tocar();
    });

    tocar();
  }

  // ── Fundo que responde ao ponteiro ───────────────────────────────────────
  // Duas coisas de uma vez, no MESMO rAF: a lanterna que segue o cursor pelo
  // primeiro quadro da página (--mx/--my, lidas pelo .hero-lanterna no CSS) e
  // a inclinação da janela do app, que passa a acompanhar o ponteiro em vez de
  // ter só dois estados de hover.
  //
  // Um laço só, e que PARA sozinho: o quadro só é reagendado enquanto a janela
  // ainda não assentou no alvo. Parado o mouse, nada roda.
  //
  // Nada disso existe onde não há cursor (telefone) nem pra quem pediu menos
  // movimento — nesses casos o CSS sozinho já deixa a página certa.
  var hero = document.querySelector('.hero');
  var janela = document.querySelector('.janela');
  var temCursor = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (hero && temCursor && !menosMovimento) {
    var luzX = 50, luzY = 38;
    var incX = 0, incY = 0, incXAlvo = 0, incYAlvo = 0;
    var pendente = 0;

    if (janela) janela.classList.add('janela--vivo');

    function passo() {
      pendente = 0;
      hero.style.setProperty('--mx', luzX.toFixed(1) + '%');
      hero.style.setProperty('--my', luzY.toFixed(1) + '%');

      incX += (incXAlvo - incX) * 0.09;
      incY += (incYAlvo - incY) * 0.09;
      if (janela) {
        // -6°/+2° são o repouso que o CSS já usava; o ponteiro só desvia disso.
        janela.style.setProperty('--ry', (-6 + incX * 5).toFixed(2) + 'deg');
        janela.style.setProperty('--rx', (2 - incY * 3.5).toFixed(2) + 'deg');
      }
      // Reagenda só enquanto ainda está indo. Sem isto o laço rodaria pra
      // sempre depois do primeiro movimento do mouse.
      if (Math.abs(incXAlvo - incX) > 0.002 || Math.abs(incYAlvo - incY) > 0.002) {
        pendente = requestAnimationFrame(passo);
      }
    }

    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      // Sem medida não dá pra normalizar: a divisão sairia NaN, e "NaN%" é um
      // valor que o custom property ACEITA guardar mas que invalida o
      // radial-gradient na hora de calcular — a lanterna sumiria calada, sem
      // erro nenhum no console. Acontece com o hero dentro de um ancestral
      // display:none, ou com a janela reduzida a zero.
      if (!r.width || !r.height) return;
      var px = (e.clientX - r.left) / r.width;
      var py = (e.clientY - r.top) / r.height;
      luzX = px * 100;
      luzY = py * 100;
      incXAlvo = px * 2 - 1;
      incYAlvo = py * 2 - 1;
      if (!pendente) pendente = requestAnimationFrame(passo);
    }, { passive: true });

    hero.addEventListener('pointerleave', function () {
      incXAlvo = 0; incYAlvo = 0;      // volta ao repouso, amortecido
      if (!pendente) pendente = requestAnimationFrame(passo);
    }, { passive: true });
  }

  // ── Filtro da vitrine ────────────────────────────────────────────────────
  var chips = [].slice.call(document.querySelectorAll('.chip'));
  var cards = [].slice.call(document.querySelectorAll('#vitrine .sis'));
  var vazio = document.getElementById('vitrine-vazio');
  if (chips.length && cards.length) {
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var filtro = chip.dataset.filtro;
        chips.forEach(function (c) { c.classList.toggle('e-ativo', c === chip); });

        var visiveis = 0;
        cards.forEach(function (card) {
          var mostra =
            filtro === 'todos' ? true :
            filtro === 'gratis' ? card.dataset.gratis === '1' :
            (' ' + card.dataset.cat + ' ').indexOf(' ' + filtro + ' ') !== -1;
          card.hidden = !mostra;
          if (mostra) visiveis++;
        });
        if (vazio) vazio.hidden = visiveis > 0;
      });
    });
  }

  // ── Aparecer ao rolar ────────────────────────────────────────────────────
  var surgem = [].slice.call(document.querySelectorAll('.e-surge'));
  if (surgem.length) {
    if (menosMovimento || !('IntersectionObserver' in window)) {
      surgem.forEach(function (el) { el.classList.add('e-visivel'); });
    } else {
      var olho = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (entrada) {
          if (!entrada.isIntersecting) return;
          entrada.target.classList.add('e-visivel');
          olho.unobserve(entrada.target);
        });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });
      surgem.forEach(function (el) { olho.observe(el); });
    }
  }

  // ── Rede de segurança da marca ───────────────────────────────────────────
  // A reserva da marca nasce invisível (ver .logo3d-reserva no style.css) e
  // quem a liga é o logo3d.js. Só que o logo3d.js é type="module": navegador
  // que não entende módulo simplesmente NÃO EXECUTA aquele arquivo, e ninguém
  // ligaria a reserva — sobraria um buraco no lugar da marca. O mesmo vale se
  // o three.js não chegar (rede caiu, 404 no vendor/).
  //
  // Este arquivo é script clássico e roda em todo lugar. Se passado um tempo
  // do load a marca não se pronunciou — nem montou (--pronto) nem desistiu
  // (--sem3d) — mostra a parada. Se o 3D chegar depois, o --pronto apaga ela
  // de novo, porque aquela regra vem por último no CSS.
  var caixaMarca = document.getElementById('logo3d');
  if (caixaMarca) {
    var conferir = function () {
      setTimeout(function () {
        var c = caixaMarca.classList;
        if (!c.contains('logo3d--pronto') && !c.contains('logo3d--sem3d')) {
          c.add('logo3d--sem3d');
        }
      }, 1200);
    };
    if (document.readyState === 'complete') conferir();
    else window.addEventListener('load', conferir);
  }

  // ── Ano e versão no rodapé ───────────────────────────────────────────────
  var ano = document.getElementById('ano');
  if (ano) ano.textContent = new Date().getFullYear();
  var versao = document.getElementById('rodape-versao');
  if (versao) versao.textContent = document.body.dataset.versao || '—';
})();
