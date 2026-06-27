/**
 * app.js
 * ─────────────────────────────────────────────────────────────────────
 * Entry point. Orchestrates:
 *   1. PDF loading  (PDFLoader)
 *   2. UI reveal    (UI)
 *   3. Flipbook init (Flipbook)
 *
 * Runs automatically on DOMContentLoaded.
 * ─────────────────────────────────────────────────────────────────────
 */

(async function main () {

  // Guard: ensure all modules are available
  if (typeof PDFLoader === 'undefined' ||
      typeof Flipbook  === 'undefined' ||
      typeof UI        === 'undefined') {
    console.error('[App] One or more modules failed to load.');
    UI.showError('Application failed to initialise. Please refresh the page.');
    return;
  }

  try {
    // ── 1. Load + render all PDF pages ──────────────────────────
    const result = await PDFLoader.load({
      url: PDFLoader.PDF_PATH,

      onProgress (pct, label) {
        UI.setProgress(pct, label);
      },

      onError (err) {
        UI.showError(
          `Could not load the PDF: ${err.message || err}. ` +
          `Ensure ./pdf/newsletter.pdf is present on the server.`
        );
      },
    });

    // If PDFLoader returned null, onError already showed the error screen — stop here.
    if (!result) return;

    const { canvases, pageCount, pageWidth, pageHeight } = result;

    if (!canvases || canvases.length === 0) {
      throw new Error('No pages were rendered from the PDF.');
    }

    // ── 2. Reveal the flipbook stage ─────────────────────────────
    UI.showFlipbook(pageWidth, pageHeight, 'Newsletter');

    // ── 3. Initialise the flipbook engine ────────────────────────
    Flipbook.init(
      canvases,
      UI.container,
      (current, total) => UI.onPageChange(current, total)
    );

    console.log(`[App] Flipbook ready — ${pageCount} pages loaded.`);

  } catch (err) {
    console.error('[App] Unhandled error:', err);
    // UI.showError already called by onError; just log if it wasn't
  }

})();
