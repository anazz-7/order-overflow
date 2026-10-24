/**
 * Browser Zoom Guard Utility for OrderFlow Pro
 * - Restricts accidental Ctrl + mouse-wheel zooming
 * - Intercepts Ctrl/Cmd + (+, -, =, 0) zoom key combinations when not in text fields
 * - Preserves native accessibility, screen readers, and mobile pinch-to-zoom
 */

export function setupZoomGuard(): () => void {
  if (typeof window === 'undefined') return () => {};

  // 1. Prevent accidental Ctrl + mouse wheel zooming
  const handleWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
    }
  };

  // 2. Intercept Ctrl + (+, -, =, 0) zoom shortcuts when user is not typing in an input
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;

    // Check if focused element is a text field where typing should never be blocked
    const activeEl = document.activeElement;
    const isTextInput =
      activeEl &&
      (activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        (activeEl as HTMLElement).isContentEditable);

    const zoomKeys = ['=', '+', '-', '_', '0'];
    const zoomCodes = ['Equal', 'Minus', 'Digit0', 'NumpadAdd', 'NumpadSubtract', 'Numpad0'];

    if (zoomKeys.includes(e.key) || zoomCodes.includes(e.code)) {
      if (!isTextInput) {
        e.preventDefault();
      }
    }
  };

  // Register listeners with non-passive wheel to allow preventDefault
  window.addEventListener('wheel', handleWheel, { passive: false });
  window.addEventListener('keydown', handleKeyDown, { capture: true });

  return () => {
    window.removeEventListener('wheel', handleWheel);
    window.removeEventListener('keydown', handleKeyDown, { capture: true });
  };
}
