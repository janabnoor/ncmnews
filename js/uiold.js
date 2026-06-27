/**
 * ui.js
 * ─────────────────────────────────────────────────────────────────────
 * Manages:
 *   • Auto-hiding top / bottom bars
 *   • Navigation buttons (prev / next / first / last)
 *   • Page counter + jump-to-page input
 *   • Page flip sound
 *   • Loading screen progress
 *   • Responsive container sizing
 * ─────────────────────────────────────────────────────────────────────
 */

const UI = (() => {

  /* ── DOM refs ─────────────────────────────────────────────────── */
  const $  = id => document.getElementById(id);
  const el = {
    loadingScreen : $('loading-screen'),
    errorScreen   : $('error-screen'),
    errorMsg      : $('error-message'),
    flipStage     : $('flipbook-stage'),
    topBar        : $('top-bar'),
    bottomBar     : $('bottom-bar'),
    pageCounter   : $('page-counter'),
    pageJumpInput : $('page-jump-input'),
    pageJumpTotal : $('page-jump-total'),
    pageJumpGo    : $('page-jump-go'),
    btnFirst      : $('btn-first'),
    btnPrev       : $('btn-prev'),
    btnNext       : $('btn-next'),
    btnLast       : $('btn-last'),
    viewport      : $('flipbook-viewport'),
    container     : $('flipbook-container'),
    flipSound     : $('flip-sound'),
    // Loading screen elements — must be in el so setProgress works
    progressBar   : $('progress-bar'),
    loaderStatus  : $('loader-status'),
    progressLabel : $('progress-label'),
  };

  /* ── Auto-hide ────────────────────────────────────────────────── */
  let _hideTimer = null;
  const HIDE_DELAY = 3500;

  function _showBars () {
    el.topBar.classList.remove('ui-hidden');
    el.bottomBar.classList.remove('ui-hidden');
    _resetHideTimer();
  }

  function _hideBars () {
    el.topBar.classList.add('ui-hidden');
    el.bottomBar.classList.add('ui-hidden');
  }

  function _resetHideTimer () {
    clearTimeout(_hideTimer);
    _hideTimer = setTimeout(_hideBars, HIDE_DELAY);
  }

  /* ── Loading helpers ──────────────────────────────────────────── */
  function setProgress (pct, label) {
    el.progressBar.style.width   = `${Math.min(pct, 100)}%`;
    el.progressLabel.textContent = `${Math.round(pct)}%`;
    if (label) el.loaderStatus.textContent = label;
  }

  function showError (message) {
    el.loadingScreen.classList.add('hidden');
    if (message) el.errorMsg.textContent = message;
    el.errorScreen.classList.remove('hidden');
  }

  /* ── Layout sizing ────────────────────────────────────────────── */
  function sizeContainer (pageWidth, pageHeight) {
    const vpW = el.viewport.clientWidth  - 60;  // 60 = room for arrows
    const vpH = el.viewport.clientHeight - 16;

    const aspect   = pageWidth / pageHeight;
    const vpAspect = vpW / vpH;

    let w, h;
    if (aspect > vpAspect) { w = vpW;  h = vpW / aspect; }
    else                   { h = vpH;  w = vpH * aspect; }

    el.container.style.width  = `${Math.floor(w)}px`;
    el.container.style.height = `${Math.floor(h)}px`;
  }

  /* ── Page-turn sound ──────────────────────────────────────────── */
  function playFlipSound () {
    try {
      el.flipSound.currentTime = 0;
      el.flipSound.play().catch(() => {});
    } catch (_) {}
  }

  /* ── Page-change callback ─────────────────────────────────────── */
  function onPageChange (current, total) {
    const humanPage = current + 1;
    el.pageCounter.textContent   = `${humanPage} / ${total}`;
    el.pageJumpInput.value       = humanPage;
    el.pageJumpTotal.textContent = `/ ${total}`;
    el.pageJumpInput.max         = total;

    el.btnFirst.disabled = current === 0;
    el.btnPrev.disabled  = current === 0;
    el.btnNext.disabled  = current === total - 1;
    el.btnLast.disabled  = current === total - 1;

    playFlipSound();
    _showBars();
  }

  /* ── Wire controls ────────────────────────────────────────────── */
  let _pageWidth  = 0;
  let _pageHeight = 0;
  let _resizeTimer = null;

  function _bindControls () {
    el.btnFirst.addEventListener('click', () => Flipbook.first());
    el.btnPrev.addEventListener( 'click', () => Flipbook.prev());
    el.btnNext.addEventListener( 'click', () => Flipbook.next());
    el.btnLast.addEventListener( 'click', () => Flipbook.last());

    el.pageJumpGo.addEventListener('click', _doJump);
    el.pageJumpInput.addEventListener('keydown', e => { if (e.key === 'Enter') _doJump(); });

    ['mousemove','touchstart','keydown','click'].forEach(ev =>
      document.addEventListener(ev, () => _showBars(), { passive: true })
    );

    window.addEventListener('resize', () => {
      clearTimeout(_resizeTimer);
      _resizeTimer = setTimeout(() => sizeContainer(_pageWidth, _pageHeight), 120);
    });
    screen.orientation && screen.orientation.addEventListener('change', () => {
      setTimeout(() => sizeContainer(_pageWidth, _pageHeight), 200);
    });
  }

  function _doJump () {
    const v = parseInt(el.pageJumpInput.value, 10);
    if (!isNaN(v)) Flipbook.goTo(v - 1);
  }

  /* ── Reveal flipbook ──────────────────────────────────────────── */
  function showFlipbook (pageWidth, pageHeight, title = 'Newsletter') {
    _pageWidth  = pageWidth;
    _pageHeight = pageHeight;

    $('book-title').textContent = title;

    el.loadingScreen.classList.add('hidden');
    el.flipStage.classList.remove('hidden');

    sizeContainer(pageWidth, pageHeight);
    _bindControls();
    _showBars();
  }

  /* ── Public ───────────────────────────────────────────────────── */
  return {
    setProgress, showError, showFlipbook, onPageChange, sizeContainer,
    get container () { return el.container; },
  };

})();
