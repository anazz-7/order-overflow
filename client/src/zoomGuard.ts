/**
 * Browser Zoom Guard Utility for OrderFlow Pro
 * - Restricts accidental Ctrl + mouse-wheel zooming
 * - Intercepts Ctrl/Cmd + (+, -, =, 0) zoom key combinations when not in text fields
 * - Prevents accidental multi-touch pinch-to-zoom on touch screens
 * - Prevents Safari iOS gesture zoom events
 * - Prevents rapid double-tap to zoom while preserving normal clicks, single taps, and form inputs
 * - Preserves accessibility, vertical scrolling, and text input editing
 */

export function setupZoomGuard(): () => void {
  if (typeof window === 'undefined') return () => {};

  // 1. Prevent accidental Ctrl / Cmd + mouse wheel zooming
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

  // 3. Prevent accidental multi-touch pinch-to-zoom gestures
  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches && e.touches.length > 1) {
      e.preventDefault();
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches && e.touches.length > 1) {
      e.preventDefault();
    }
  };

  // 4. Prevent Safari iOS gesture zoom events (gesturestart / gesturechange / gestureend)
  const handleGesture = (e: Event) => {
    e.preventDefault();
  };

  // 5. Prevent accidental double-tap to zoom on mobile while keeping inputs and buttons fully usable
  let lastTouchEndTime = 0;
  const handleTouchEnd = (e: TouchEvent) => {
    const now = Date.now();
    const target = e.target as HTMLElement | null;
    const isTextInput =
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable);

    if (now - lastTouchEndTime <= 300 && !isTextInput) {
      e.preventDefault();
    }
    lastTouchEndTime = now;
  };

  // Register listeners with non-passive options to allow preventDefault
  window.addEventListener('wheel', handleWheel, { passive: false });
  window.addEventListener('keydown', handleKeyDown, { capture: true });
  window.addEventListener('touchstart', handleTouchStart, { passive: false });
  window.addEventListener('touchmove', handleTouchMove, { passive: false });
  window.addEventListener('touchend', handleTouchEnd, { passive: false });

  document.addEventListener('gesturestart', handleGesture, { passive: false });
  document.addEventListener('gesturechange', handleGesture, { passive: false });
  document.addEventListener('gestureend', handleGesture, { passive: false });

  return () => {
    window.removeEventListener('wheel', handleWheel);
    window.removeEventListener('keydown', handleKeyDown, { capture: true });
    window.removeEventListener('touchstart', handleTouchStart);
    window.removeEventListener('touchmove', handleTouchMove);
    window.removeEventListener('touchend', handleTouchEnd);

    document.removeEventListener('gesturestart', handleGesture);
    document.removeEventListener('gesturechange', handleGesture);
    document.removeEventListener('gestureend', handleGesture);
  };
}
