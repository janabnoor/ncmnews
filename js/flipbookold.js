/**
 * flipbook.js  — Canvas-based realistic page-curl flip engine
 * ─────────────────────────────────────────────────────────────────────
 * Draws a genuine page-curl animation on an overlay <canvas> while
 * swapping the visible page underneath. No CSS rotateY tricks.
 *
 * Three ways to turn a page:
 *   1. Click / tap the LEFT or RIGHT edge arrow buttons
 *   2. Swipe left / right anywhere on the page
 *   3. Drag from the bottom-right (or bottom-left) corner
 *
 * Public API
 *   Flipbook.init(canvases, container, onPageChange)
 *   Flipbook.goTo(index, skipAnim?)
 *   Flipbook.next() / prev() / first() / last()
 *   Flipbook.currentPage  (getter)
 *   Flipbook.totalPages   (getter)
 * ─────────────────────────────────────────────────────────────────────
 */

const Flipbook = (() => {

  /* ── State ─────────────────────────────────────────────────────── */
  let _canvases     = [];
  let _container    = null;   // #flipbook-container
  let _overlay      = null;   // overlay <canvas> for flip anim
  let _ctx          = null;
  let _pageEls      = [];     // .fb-page divs
  let _current      = 0;
  let _total        = 0;
  let _flipping     = false;
  let _onPageChange = null;

  /* ── Config ────────────────────────────────────────────────────── */
  const FLIP_MS         = 600;    // animation duration
  const CORNER_ZONE     = 80;     // px square corner hit-zone
  const SWIPE_THRESH    = 50;
  const ARROW_SIZE      = 52;     // edge arrow button size (px)
  const ARROW_MARGIN    = 12;

  /* ── Arrow button DOM refs ─────────────────────────────────────── */
  let _arrowLeft  = null;
  let _arrowRight = null;

  /* ── Touch / mouse drag ────────────────────────────────────────── */
  const ptr = {
    down: false, corner: false,
    startX: 0, startY: 0,
    x: 0, y: 0,
    dir: 0   // +1 next, -1 prev
  };

  /* ── Page element helpers ───────────────────────────────────────── */
  function _showPage (index) {
    _pageEls.forEach((el, i) => {
      el.style.display = i === index ? 'block' : 'none';
    });
  }

  /* ── Arrow buttons ─────────────────────────────────────────────── */
  function _buildArrows () {
    _arrowLeft  = _makeArrow('◀', 'fb-arrow fb-arrow-left');
    _arrowRight = _makeArrow('▶', 'fb-arrow fb-arrow-right');

    _container.appendChild(_arrowLeft);
    _container.appendChild(_arrowRight);

    _arrowLeft.addEventListener('click',  e => { e.stopPropagation(); prev(); });
    _arrowRight.addEventListener('click', e => { e.stopPropagation(); next(); });

    _updateArrows();
  }

  function _makeArrow (symbol, cls) {
    const btn = document.createElement('button');
    btn.className   = cls;
    btn.textContent = symbol;
    btn.setAttribute('aria-label', cls.includes('left') ? 'Previous page' : 'Next page');
    return btn;
  }

  function _updateArrows () {
    if (!_arrowLeft) return;
    _arrowLeft.style.display  = _current > 0           ? 'flex' : 'none';
    _arrowRight.style.display = _current < _total - 1  ? 'flex' : 'none';
  }

  /* ── Overlay canvas setup ───────────────────────────────────────── */
  function _buildOverlay () {
    _overlay = document.createElement('canvas');
    _overlay.className = 'fb-overlay';
    _overlay.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;' +
      'pointer-events:none;z-index:20;display:none;';
    _container.appendChild(_overlay);
    _ctx = _overlay.getContext('2d');
  }

  function _syncOverlay () {
    const w = _container.offsetWidth;
    const h = _container.offsetHeight;
    _overlay.width  = w;
    _overlay.height = h;
    _overlay.style.display = 'block';
  }

  /* ═══════════════════════════════════════════════════════════════
     CANVAS PAGE-CURL ANIMATION
     ═══════════════════════════════════════════════════════════════
     Renders a physically-inspired page curl using:
       • A shadow gradient on the receiving page
       • A folded trapezoid that represents the turning leaf
       • A triangular back-of-page reveal with a gradient
       • A corner shadow
  ═══════════════════════════════════════════════════════════════ */

  /**
   * @param {HTMLCanvasElement} fromCanvas  – page going away
   * @param {HTMLCanvasElement} toCanvas    – page arriving
   * @param {boolean}           forward     – true = next, false = prev
   * @param {Function}          onDone
   */
  function _runFlipAnim (fromCanvas, toCanvas, forward, onDone) {
    _syncOverlay();

    const W = _overlay.width;
    const H = _overlay.height;
    const start = performance.now();

    // For forward flip: curl from right edge.
    // For backward flip: curl from left edge (mirror).
    const animate = (now) => {
      const t = Math.min((now - start) / FLIP_MS, 1);
      const ease = _easeInOut(t);

      _ctx.clearRect(0, 0, W, H);

      if (forward) {
        _drawCurl(W, H, ease, fromCanvas, toCanvas, false);
      } else {
        _drawCurlMirror(W, H, ease, fromCanvas, toCanvas);
      }

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        _ctx.clearRect(0, 0, W, H);
        _overlay.style.display = 'none';
        onDone();
      }
    };

    requestAnimationFrame(animate);
  }

  /** Ease in-out cubic */
  function _easeInOut (t) {
    return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
  }

  /**
   * Draw forward (right-to-left) page curl.
   * t = 0 → no curl, t = 1 → page fully turned.
   */
  function _drawCurl (W, H, t, fromCv, toCv, mirror) {
    // The fold line moves from x=W (right edge) to x=0 (left edge)
    const foldX = W * (1 - t);

    // ── 1. Draw the "from" page (underneath, left portion visible) ──
    _ctx.save();
    _ctx.beginPath();
    _ctx.rect(0, 0, foldX, H);
    _ctx.clip();
    _ctx.drawImage(fromCv, 0, 0, W, H);
    _ctx.restore();

    // ── 2. Draw the "to" page (revealed on right of fold line) ──────
    _ctx.save();
    _ctx.beginPath();
    _ctx.rect(foldX, 0, W - foldX, H);
    _ctx.clip();
    _ctx.drawImage(toCv, 0, 0, W, H);
    _ctx.restore();

    // ── 3. Shadow on the "to" page near the fold ────────────────────
    const shadowW = Math.min(80, W * 0.12);
    const shadowGrad = _ctx.createLinearGradient(foldX, 0, foldX + shadowW, 0);
    shadowGrad.addColorStop(0,   'rgba(0,0,0,0.55)');
    shadowGrad.addColorStop(0.4, 'rgba(0,0,0,0.18)');
    shadowGrad.addColorStop(1,   'rgba(0,0,0,0)');
    _ctx.fillStyle = shadowGrad;
    _ctx.fillRect(foldX, 0, shadowW, H);

    // ── 4. The folded half (trapezoid of remaining fromCv) ───────────
    const curlW = Math.min((W - foldX) * 0.9, W * 0.5);  // how wide the fold looks
    const skew  = 0.08 * Math.sin(t * Math.PI);           // paper bend at peak

    _ctx.save();

    // Clip to the folded region (right of foldX)
    _ctx.beginPath();
    _ctx.moveTo(foldX,         0 + H * skew);
    _ctx.lineTo(foldX + curlW, 0);
    _ctx.lineTo(foldX + curlW, H);
    _ctx.lineTo(foldX,         H - H * skew);
    _ctx.closePath();
    _ctx.clip();

    // Scale fromCv into this trapezoid (mirror it = back of page)
    _ctx.save();
    _ctx.translate(foldX + curlW, 0);
    _ctx.scale(-1, 1);   // mirror horizontally
    _ctx.drawImage(fromCv, 0, 0, curlW, H);
    _ctx.restore();

    // Gradient overlay simulating lighting on the folded surface
    const foldGrad = _ctx.createLinearGradient(foldX, 0, foldX + curlW, 0);
    foldGrad.addColorStop(0,   'rgba(255,255,255,0.25)');
    foldGrad.addColorStop(0.3, 'rgba(255,255,255,0.05)');
    foldGrad.addColorStop(1,   'rgba(0,0,0,0.40)');
    _ctx.fillStyle = foldGrad;
    _ctx.fill();   // fills the clipped trapezoid path

    _ctx.restore();

    // ── 5. Fold-line highlight (bright edge) ─────────────────────────
    _ctx.save();
    _ctx.beginPath();
    _ctx.moveTo(foldX, H * skew);
    _ctx.lineTo(foldX, H - H * skew);
    _ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    _ctx.lineWidth = 1.5;
    _ctx.stroke();
    _ctx.restore();

    // ── 6. Shadow cast by the fold onto the from-page ────────────────
    const castW = 30 * (1 - t);
    const castGrad = _ctx.createLinearGradient(foldX - castW, 0, foldX, 0);
    castGrad.addColorStop(0, 'rgba(0,0,0,0)');
    castGrad.addColorStop(1, 'rgba(0,0,0,0.28)');
    _ctx.fillStyle = castGrad;
    _ctx.fillRect(foldX - castW, 0, castW, H);
  }

  /** Mirror _drawCurl for backward (left-to-right) flip */
  function _drawCurlMirror (W, H, t, fromCv, toCv) {
    _ctx.save();
    _ctx.translate(W, 0);
    _ctx.scale(-1, 1);
    _drawCurl(W, H, t, fromCv, toCv, true);
    _ctx.restore();
  }

  /* ── Core flip trigger ──────────────────────────────────────────── */
  function _doFlip (targetIndex, forward) {
    if (_flipping) return;
    if (targetIndex < 0 || targetIndex >= _total) return;

    _flipping = true;

    const fromCanvas = _canvases[_current];
    const toCanvas   = _canvases[targetIndex];

    // Show BOTH pages briefly during animation; overlay handles visuals
    _showPage(_current);

    _runFlipAnim(fromCanvas, toCanvas, forward, () => {
      _current = targetIndex;
      _showPage(_current);
      _flipping = false;
      _updateArrows();
      _onPageChange && _onPageChange(_current, _total);
    });
  }

  /* ── Navigation ─────────────────────────────────────────────────── */
  function next  () { if (_current < _total - 1) _doFlip(_current + 1, true);  }
  function prev  () { if (_current > 0)           _doFlip(_current - 1, false); }
  function first () { if (_current > 0)           _doFlip(0, false); }
  function last  () { if (_current < _total - 1)  _doFlip(_total - 1, true);   }

  function goTo (index, skipAnim = false) {
    if (index < 0 || index >= _total || index === _current) return;
    if (skipAnim) {
      _current = index;
      _showPage(_current);
      _updateArrows();
      _onPageChange && _onPageChange(_current, _total);
    } else {
      _doFlip(index, index > _current);
    }
  }

  /* ── Corner drag-to-flip ────────────────────────────────────────── */
  function _inCornerZone (x, y) {
    const W = _container.offsetWidth;
    const H = _container.offsetHeight;
    const inBR = x > W - CORNER_ZONE && y > H - CORNER_ZONE;  // bottom-right → next
    const inBL = x < CORNER_ZONE     && y > H - CORNER_ZONE;  // bottom-left  → prev
    if (inBR && _current < _total - 1) return +1;
    if (inBL && _current > 0)          return -1;
    return 0;
  }

  function _relativePos (e) {
    const r = _container.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  }

  /* ── Pointer events (touch + mouse) ────────────────────────────── */
  function _onPointerDown (e) {
    if (e.type === 'mousedown' && e.button !== 0) return;
    const pos  = _relativePos(e);
    const dir  = _inCornerZone(pos.x, pos.y);

    ptr.down   = true;
    ptr.corner = dir !== 0;
    ptr.dir    = dir;
    ptr.startX = pos.x;
    ptr.startY = pos.y;
    ptr.x      = pos.x;
    ptr.y      = pos.y;
  }

  function _onPointerMove (e) {
    if (!ptr.down) return;
    const pos = _relativePos(e);
    ptr.x = pos.x;
    ptr.y = pos.y;
  }

  function _onPointerUp (e) {
    if (!ptr.down) return;
    ptr.down = false;

    const dx = ptr.x - ptr.startX;
    const dy = ptr.y - ptr.startY;

    if (ptr.corner && Math.hypot(dx, dy) > 20) {
      // Dragged from corner
      ptr.dir > 0 ? next() : prev();
    } else if (Math.abs(dx) > SWIPE_THRESH && Math.abs(dx) > Math.abs(dy)) {
      // Horizontal swipe anywhere
      dx < 0 ? next() : prev();
    }

    ptr.corner = false;
    ptr.dir    = 0;
  }

  /* ── Keyboard ───────────────────────────────────────────────────── */
  function _onKey (e) {
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ':
        e.preventDefault(); next(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
        e.preventDefault(); prev(); break;
      case 'Home': e.preventDefault(); first(); break;
      case 'End':  e.preventDefault(); last();  break;
    }
  }

  /* ── Init ───────────────────────────────────────────────────────── */
  function init (canvases, container, onPageChange) {
    _canvases     = canvases;
    _container    = container;
    _total        = canvases.length;
    _current      = 0;
    _onPageChange = onPageChange;

    // Build .fb-page divs
    _pageEls = canvases.map((cv, i) => {
      const div = document.createElement('div');
      div.className = 'fb-page';
      div.style.display = i === 0 ? 'block' : 'none';
      div.appendChild(cv);
      container.appendChild(div);
      return div;
    });

    _buildOverlay();
    _buildArrows();

    // Events – listen on document so drag outside container still works
    container.addEventListener('mousedown',  _onPointerDown);
    container.addEventListener('touchstart', _onPointerDown, { passive: true });
    document.addEventListener('mousemove',   _onPointerMove);
    document.addEventListener('touchmove',   _onPointerMove, { passive: true });
    document.addEventListener('mouseup',     _onPointerUp);
    document.addEventListener('touchend',    _onPointerUp);
    document.addEventListener('keydown',     _onKey);

    // Cursor hint on corner hover
    container.addEventListener('mousemove', _updateCursor);

    _onPageChange && _onPageChange(0, _total);
  }

  function _updateCursor (e) {
    const pos = _relativePos(e);
    const dir = _inCornerZone(pos.x, pos.y);
    _container.style.cursor = dir !== 0 ? 'pointer' : 'default';
  }

  /* ── Public ─────────────────────────────────────────────────────── */
  return {
    init, next, prev, first, last, goTo,
    get currentPage () { return _current; },
    get totalPages  () { return _total;   },
  };

})();
