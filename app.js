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
  // (a pessoa está olhando aquela), quando a aba sai de foco (senão o
  // navegador acumula troca pra fazer de uma vez ao voltar) e pra quem pediu
  // menos movimento no sistema.
  var slides = [].slice.call(document.querySelectorAll('.slide'));
  var pontos = [].slice.call(document.querySelectorAll('.ponto'));
  if (slides.length > 1) {
    var atual = 0;
    var timer = null;
    var parado = false;

    function mostrar(i) {
      atual = (i + slides.length) % slides.length;
      slides.forEach(function (s, n) { s.classList.toggle('e-ativo', n === atual); });
      pontos.forEach(function (p, n) { p.classList.toggle('e-ativo', n === atual); });
    }
    function tocar() {
      if (timer || parado || menosMovimento) return;
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

    var palco = document.getElementById('carrossel');
    if (palco) {
      palco.addEventListener('mouseenter', function () { parado = true; pausar(); });
      palco.addEventListener('mouseleave', function () { parado = false; tocar(); });
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pausar(); else tocar();
    });

    tocar();
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

  // ── Ano e versão no rodapé ───────────────────────────────────────────────
  var ano = document.getElementById('ano');
  if (ano) ano.textContent = new Date().getFullYear();
  var versao = document.getElementById('rodape-versao');
  if (versao) versao.textContent = document.body.dataset.versao || '—';
})();
