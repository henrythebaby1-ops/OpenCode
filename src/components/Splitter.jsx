/**
 * Drag handle for resizing a panel. `onResize` receives the pointer's total movement
 * since the drag started (dx, dy); double-click calls `onReset`.
 */
export default function Splitter({ direction = 'vertical', onStart, onResize, onReset, label }) {
  const onPointerDown = e => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    onStart?.();
    document.body.classList.add('resizing', direction === 'vertical' ? 'resizing-x' : 'resizing-y');
    const move = ev => onResize(ev.clientX - startX, ev.clientY - startY);
    const up = () => {
      document.body.classList.remove('resizing', 'resizing-x', 'resizing-y');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div
      className={`splitter ${direction}`}
      role="separator"
      aria-orientation={direction}
      aria-label={label}
      title={`${label} · double-click to reset`}
      onPointerDown={onPointerDown}
      onDoubleClick={onReset}
    />
  );
}
