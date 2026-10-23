import { useState, useEffect, useLayoutEffect, useRef } from 'react';

function useEyes(mode, mousePos, ref) {
  const [eyeState, setEyeState] = useState({ pupil: { x: 0, y: 0 }, tilt: 0 });

  // useLayoutEffect (not useEffect): this reads the character's committed
  // DOM position via `ref`, which React only allows outside of render. Running
  // it before paint (instead of after, like useEffect) avoids a one-frame-stale
  // pupil position flashing on every mouse move.
  useLayoutEffect(() => {
    if (!ref.current) return;

    let next;
    if (mode === 'lookAtForm') {
      next = { pupil: { x: 1, y: 0.25 }, tilt: 5 };
    } else if (mode === 'shy') {
      next = { pupil: { x: -1, y: -0.5 }, tilt: -9 };
    } else if (mode === 'remind' || mode === 'glance') {
      next = { pupil: { x: 0, y: -0.75 }, tilt: 0 };
    } else if (!mousePos) {
      // No real pointer yet (e.g. touch device before the first tap) — rest
      // the eyes straight ahead instead of aiming at a stale (0,0) origin.
      next = { pupil: { x: 0, y: 0 }, tilt: 0 };
    } else {
      const rect = ref.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = mousePos.x - cx;
      const dy = mousePos.y - cy;
      const angle = Math.atan2(dy, dx);
      // Normalized 0..1 (full deflection at ~160px away); <Eyes> scales it to
      // each eye's own size so small eyes never push the pupil past the rim.
      const dist = Math.min(1, Math.hypot(dx, dy) / 110);
      next = {
        pupil: { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist },
        tilt: Math.max(-6, Math.min(6, dx / 60)),
      };
    }

    setEyeState(next);
  }, [mousePos, mode, ref]);

  return eyeState;
}

function useBlink(delay) {
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    // Both the "wait until next blink" and "eyes closed" timers are tracked
    // through one id, so unmounting mid-blink cancels whichever is pending
    // instead of leaking the inner one and setting state on an unmounted tree.
    let timeoutId;
    const scheduleBlink = () => {
      const nextBlink = 2500 + Math.random() * 3500;
      timeoutId = setTimeout(() => {
        setBlinking(true);
        timeoutId = setTimeout(() => {
          setBlinking(false);
          scheduleBlink();
        }, 140);
      }, nextBlink);
    };
    timeoutId = setTimeout(scheduleBlink, delay);
    return () => clearTimeout(timeoutId);
  }, [delay]);

  return blinking;
}

// Understated face: small, wide-set dark eyes with a single catchlight and a
// subtle smile — friendly without being juvenile, and legible at any size
// (big white eyes with pupils read as startled).
// `size` is the face scale; every part below is derived from it so the same
// face works on a 36px pencil and a 112px notebook.
const INK = '#14161c';

function Eye({ w, h, blinking, offset }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: '50%',
        background: INK,
        position: 'relative',
        transform: `translate(${offset.x}px, ${offset.y}px) scaleY(${blinking ? 0.12 : 1})`,
        transition: 'transform 0.14s ease-out',
      }}
    >
      <div style={{ position: 'absolute', top: '15%', left: '18%', width: '38%', height: '38%', borderRadius: '50%', background: '#fff' }} />
    </div>
  );
}

function Eyes({ pupil, blinking, shy, size }) {
  const w = size * 0.42;
  const h = size * 0.54;
  // Eyes drift toward whatever the character is looking at. Without a white
  // sclera to move a pupil within, the drift has to be large enough to read
  // as a direction at a glance.
  const reach = size * 0.22;
  const offset = { x: pupil.x * reach, y: pupil.y * reach };
  const blushW = size * 0.6;
  return (
    <div style={{ position: 'relative', display: 'flex', gap: size * 0.8, justifyContent: 'center', alignItems: 'center', height: h }}>
      {[0, 1].map((i) => (
        <div
          key={`blush-${i}`}
          style={{
            position: 'absolute',
            top: h * 0.78,
            left: i === 0 ? -blushW * 0.7 : undefined,
            right: i === 1 ? -blushW * 0.7 : undefined,
            width: blushW,
            height: blushW * 0.55,
            borderRadius: '50%',
            background: 'rgba(240, 110, 140, 0.55)',
            filter: 'blur(1.5px)',
            opacity: shy ? 1 : 0,
            transition: 'opacity 0.25s ease-out',
          }}
        />
      ))}
      {[0, 1].map((i) => (
        <Eye key={i} w={w} h={h} blinking={blinking} offset={offset} />
      ))}
    </div>
  );
}

const MOUTHS = {
  smile: <path d="M2 2 Q7 7 12 2" />,
  open: <ellipse cx="7" cy="4.5" rx="2" ry="2.4" fill={INK} stroke="none" />,
};

function Mouth({ mode, size }) {
  return (
    <svg
      width={size * 0.46}
      height={size * 0.28}
      viewBox="0 0 14 9"
      fill="none"
      stroke={INK}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ marginTop: size * 0.22, overflow: 'visible' }}
    >
      {MOUTHS[mode === 'remind' ? 'open' : 'smile']}
    </svg>
  );
}

function Face({ mode, pupil, blinking, size }) {
  // The whole face also leans a little toward the gaze (like a head turn).
  const lean = size * 0.1;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        transform: `translate(${pupil.x * lean}px, ${pupil.y * lean}px)`,
        transition: 'transform 0.2s ease-out',
      }}
    >
      <Eyes pupil={pupil} blinking={blinking} shy={mode === 'shy'} size={size} />
      <Mouth mode={mode} size={size} />
    </div>
  );
}

function getCharClasses(mode, bounceKey) {
  const classes = ['relative', 'transition-transform', 'duration-[400ms]', 'ease-out', 'animate-char-float'];
  if (mode === 'shy' || mode === 'remind') classes.push('animate-char-wiggle!');
  if (bounceKey) classes.push('animate-char-bounce!');
  return classes.join(' ');
}

// Shared drop-shadow (filter, not box-shadow) so it hugs each character's
// actual silhouette — including the ones clipped to a non-rectangular shape
// (Bookmark's ribbon notch), where a box-shadow would just draw a rectangle.
const CHAR_SHADOW = 'drop-shadow-[0_10px_22px_rgba(0,0,0,0.35)]';

function Pencil({ mode, mousePos, bounceKey }) {
  const ref = useRef(null);
  const { pupil, tilt } = useEyes(mode, mousePos, ref);
  const blinking = useBlink(400);
  return (
    <div
      ref={ref}
      className={`${getCharClasses(mode, bounceKey)} ${CHAR_SHADOW} flex flex-col items-center mr-[-4px] z-[2]`}
      style={{ '--tilt': `${tilt - 4}deg` }}
      key={`pencil-${bounceKey}`}
    >
      {/* eraser */}
      <div
        className="w-9 h-7 rounded-t-[10px] relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #ffb3cd 0%, #fd79a8 60%, #f4568e 100%)' }}
      >
        <div className="absolute top-1 left-1.5 right-4 h-1.5 rounded-full bg-white/45" />
      </div>
      {/* ferrule */}
      <div
        className="w-9 h-2.5 relative"
        style={{ background: 'linear-gradient(180deg, #eef2f3 0%, #c2ccd0 45%, #96a3a8 100%)' }}
      >
        <div className="absolute inset-x-0 top-[3px] h-px bg-black/20" />
        <div className="absolute inset-x-0 bottom-[3px] h-px bg-black/20" />
      </div>
      {/* body */}
      <div
        className="w-9 h-[142px] relative overflow-hidden"
        style={{ background: 'linear-gradient(90deg, #e8a82e 0%, #ffd45c 40%, #ffe48a 60%, #e8a82e 100%)' }}
      >
        <div className="absolute top-[18px] left-0 right-0"><Face mode={mode} pupil={pupil} blinking={blinking} size={16} /></div>
      </div>
      {/* wood tip + graphite point */}
      <div className="relative">
        <div
          className="w-0 h-0 border-l-[18px] border-l-transparent border-r-[18px] border-r-transparent border-t-[22px]"
          style={{ borderTopColor: '#f0c894' }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 top-[14px] w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[9px]"
          style={{ borderTopColor: '#3a3632' }}
        />
      </div>
    </div>
  );
}

function Notebook({ mode, mousePos, bounceKey }) {
  const ref = useRef(null);
  const { pupil, tilt } = useEyes(mode, mousePos, ref);
  const blinking = useBlink(1200);
  return (
    <div
      ref={ref}
      className={`${getCharClasses(mode, bounceKey)} ${CHAR_SHADOW} [animation-delay:-1s] w-[112px] h-[142px] rounded-[16px] mr-[-8px] z-[3] relative overflow-hidden`}
      style={{ '--tilt': `${tilt + 3}deg`, background: 'linear-gradient(155deg, var(--color-accent) 0%, var(--color-accent-2) 100%)' }}
      key={`notebook-${bounceKey}`}
    >
      {/* soft sheen, top-left */}
      <div className="absolute -top-4 -left-4 w-16 h-16 rounded-full bg-white/15 blur-md" />
      {/* corner ribbon bookmark */}
      <div
        className="absolute -top-1 right-4 w-3 h-6"
        style={{ background: '#ffd45c', clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 75%, 0 100%)' }}
      />
      {/* spiral binding */}
      <div className="absolute left-2.5 top-3 bottom-3 flex flex-col justify-between">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: 'linear-gradient(160deg, #ffffff, rgba(255,255,255,0.4))', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.35)' }}
          />
        ))}
      </div>
      <div className="absolute top-6 left-9 right-2.5"><Face mode={mode} pupil={pupil} blinking={blinking} size={21} /></div>
      <div className="absolute h-[3px] rounded-[2px] bg-white/30 bottom-9 left-10 right-6" />
      <div className="absolute h-[3px] rounded-[2px] bg-white/30 bottom-6 left-10 right-4" />
    </div>
  );
}

function Bookmark({ mode, mousePos, bounceKey }) {
  const ref = useRef(null);
  const { pupil, tilt } = useEyes(mode, mousePos, ref);
  const blinking = useBlink(2100);
  return (
    <div
      ref={ref}
      className={`${getCharClasses(mode, bounceKey)} ${CHAR_SHADOW} [animation-delay:-2s] mr-[-6px] z-[2]`}
      style={{ '--tilt': `${tilt - 3}deg` }}
      key={`bookmark-${bounceKey}`}
    >
      <div
        className="w-16 h-[132px] relative"
        style={{
          background: 'linear-gradient(160deg, #6ff0cf 0%, var(--color-growth) 55%, color-mix(in srgb, var(--color-growth) 75%, black) 100%)',
          clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)',
        }}
      >
        <div className="absolute inset-y-0 left-1/2 w-px bg-black/10" />
        <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full" style={{ boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.6)' }} />
        <div className="absolute top-11 left-0 right-0"><Face mode={mode} pupil={pupil} blinking={blinking} size={18} /></div>
      </div>
    </div>
  );
}

function Folder({ mode, mousePos, bounceKey }) {
  const ref = useRef(null);
  const { pupil, tilt } = useEyes(mode, mousePos, ref);
  const blinking = useBlink(1700);
  return (
    <div
      ref={ref}
      className={`${getCharClasses(mode, bounceKey)} [animation-delay:-0.5s] z-[1] relative`}
      style={{ '--tilt': `${tilt + 4}deg` }}
      key={`folder-${bounceKey}`}
    >
      {/* paper peeking out from behind the tab */}
      <div className="absolute -top-2 left-4 right-4 h-6 rounded-t-[6px] bg-white/85" />
      <div
        className="w-12 h-4 rounded-t-[8px] ml-1.5 relative"
        style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--color-accent) 45%, white), color-mix(in srgb, var(--color-accent) 75%, white))' }}
      />
      <div
        className={`w-32 h-24 rounded-[4px_14px_14px_14px] relative overflow-hidden ${CHAR_SHADOW}`}
        style={{ background: 'linear-gradient(155deg, color-mix(in srgb, var(--color-accent) 40%, white) 0%, color-mix(in srgb, var(--color-accent) 70%, white) 55%, color-mix(in srgb, var(--color-accent) 55%, black) 100%)' }}
      >
        <div className="absolute top-0 inset-x-0 h-px bg-white/25" />
        <div className="absolute top-[22px] left-0 right-0"><Face mode={mode} pupil={pupil} blinking={blinking} size={21} /></div>
        <div className="absolute -bottom-6 -right-6 w-20 h-20 rounded-full bg-black/10 blur-md" />
      </div>
    </div>
  );
}

function Watchers({ mode, bounceKey }) {
  const [mousePos, setMousePos] = useState(null);

  useEffect(() => {
    // Pointer events can fire several times per frame, and every update
    // re-renders all four characters (each reads layout). Coalesce to at
    // most one state update per animation frame.
    let frame = 0;
    let latest = null;
    const queue = (x, y) => {
      latest = { x, y };
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setMousePos(latest);
      });
    };
    const handleMove = (e) => queue(e.clientX, e.clientY);
    // Touch devices never fire mousemove, so without this the "watch" eyes
    // would never get real coordinates — mirror mouse tracking with touch.
    const handleTouch = (e) => {
      if (e.touches.length > 0) queue(e.touches[0].clientX, e.touches[0].clientY);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchstart', handleTouch, { passive: true });
    window.addEventListener('touchmove', handleTouch, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchstart', handleTouch);
      window.removeEventListener('touchmove', handleTouch);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div aria-hidden="true" data-watchers className="animate-char-rise shrink-0 flex items-end gap-[10px] relative scale-75 min-[500px]:scale-90 min-[800px]:scale-100 ml-0 min-[1100px]:ml-[-40px]">
      {mode === 'remind' && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-[14px] bg-white text-[#14161c] text-[13px] font-semibold whitespace-nowrap py-2 px-3.5 rounded-[14px] shadow-[0_6px_20px_rgba(0,0,0,0.25)] z-[3] animate-bubble-pop after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-[7px] after:border-transparent after:border-t-white">
          Hide your password...
        </div>
      )}
      {/* soft ground shadow that breathes in sync with the characters' float */}
      <div className="absolute -bottom-3 inset-x-3 h-3 rounded-[50%] bg-black/30 blur-md animate-shadow-pulse" />
      <Pencil mode={mode} mousePos={mousePos} bounceKey={bounceKey} />
      <Notebook mode={mode} mousePos={mousePos} bounceKey={bounceKey} />
      <Bookmark mode={mode} mousePos={mousePos} bounceKey={bounceKey} />
      <Folder mode={mode} mousePos={mousePos} bounceKey={bounceKey} />
    </div>
  );
}

export default Watchers;
