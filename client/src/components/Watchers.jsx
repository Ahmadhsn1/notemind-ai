import { useState, useEffect, useLayoutEffect, useRef } from 'react';

// Where a character looks is derived from a *target point* in viewport
// coordinates (`aim`), never from a hardcoded direction — so it's right on
// every layout: on desktop the form is to the right of the characters, on a
// phone it's stacked below them, on a tablet it can be either.
//   aim  — the point to look at (null = rest straight ahead)
//   away — look the opposite way (shy: avert the eyes from the form)
// The origin is the character's *face*, not its body: a pencil is 200px tall
// with its eyes near the top, so measuring from the body's center made it
// look downward even when the target was level with its eyes.
function useEyes(mode, aim, away, faceRef) {
  const [eyeState, setEyeState] = useState({ pupil: { x: 0, y: 0 }, tilt: 0 });

  // useLayoutEffect (not useEffect): this reads the committed DOM position via
  // `faceRef`, which React only allows outside of render. Running before
  // paint avoids a one-frame-stale pupil position on every update.
  useLayoutEffect(() => {
    if (!faceRef.current) return;

    let next;
    if (mode === 'remind') {
      // Glancing up at the speech bubble.
      next = { pupil: { x: 0, y: -0.75 }, tilt: 0 };
    } else if (!aim) {
      next = { pupil: { x: 0, y: 0 }, tilt: 0 };
    } else {
      const rect = faceRef.current.getBoundingClientRect();
      let dx = aim.x - (rect.left + rect.width / 2);
      let dy = aim.y - (rect.top + rect.height / 2);
      if (away) {
        dx = -dx;
        dy = -dy;
      }
      const angle = Math.atan2(dy, dx);
      // Normalized 0..1 (full deflection ~110px away); <Eyes> scales it to the
      // character's own size. Averting the eyes should read clearly, so it
      // never settles below 0.8 deflection.
      const raw = Math.min(1, Math.hypot(dx, dy) / 110);
      const dist = away ? Math.max(0.8, raw) : raw;
      next = {
        pupil: { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist },
        // Lean toward what it's watching, or away from it when shy.
        tilt: Math.max(-9, Math.min(9, away ? dx / 40 : dx / 60)),
      };
    }

    setEyeState(next);
  }, [aim, away, mode, faceRef]);

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

function Face({ mode, pupil, blinking, size, faceRef }) {
  // The whole face also leans a little toward the gaze (like a head turn).
  const lean = size * 0.1;
  return (
    <div
      ref={faceRef}
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

function Pencil({ mode, aim, away, bounceKey }) {
  const ref = useRef(null);
  const faceRef = useRef(null);
  const { pupil, tilt } = useEyes(mode, aim, away, faceRef);
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
        <div className="absolute top-[18px] left-0 right-0"><Face mode={mode} pupil={pupil} blinking={blinking} faceRef={faceRef} size={16} /></div>
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

function Notebook({ mode, aim, away, bounceKey }) {
  const ref = useRef(null);
  const faceRef = useRef(null);
  const { pupil, tilt } = useEyes(mode, aim, away, faceRef);
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
      <div className="absolute top-6 left-9 right-2.5"><Face mode={mode} pupil={pupil} blinking={blinking} faceRef={faceRef} size={21} /></div>
      <div className="absolute h-[3px] rounded-[2px] bg-white/30 bottom-9 left-10 right-6" />
      <div className="absolute h-[3px] rounded-[2px] bg-white/30 bottom-6 left-10 right-4" />
    </div>
  );
}

function Bookmark({ mode, aim, away, bounceKey }) {
  const ref = useRef(null);
  const faceRef = useRef(null);
  const { pupil, tilt } = useEyes(mode, aim, away, faceRef);
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
        <div className="absolute top-11 left-0 right-0"><Face mode={mode} pupil={pupil} blinking={blinking} faceRef={faceRef} size={18} /></div>
      </div>
    </div>
  );
}

function Folder({ mode, aim, away, bounceKey }) {
  const ref = useRef(null);
  const faceRef = useRef(null);
  const { pupil, tilt } = useEyes(mode, aim, away, faceRef);
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
        <div className="absolute top-[22px] left-0 right-0"><Face mode={mode} pupil={pupil} blinking={blinking} faceRef={faceRef} size={21} /></div>
        <div className="absolute -bottom-6 -right-6 w-20 h-20 rounded-full bg-black/10 blur-md" />
      </div>
    </div>
  );
}

function Watchers({ mode, bounceKey, gazeRef }) {
  const [pointer, setPointer] = useState(null);
  const [gaze, setGaze] = useState(null);

  // Pointer tracking (mouse + touch).
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
        setPointer(latest);
      });
    };
    const handleMove = (e) => queue(e.clientX, e.clientY);
    // Touch devices never fire mousemove, so without this the "watch" eyes
    // would never get real coordinates — mirror mouse tracking with touch.
    const handleTouch = (e) => {
      if (e.touches.length > 0) queue(e.touches[0].clientX, e.touches[0].clientY);
    };
    // Once the cursor leaves the window there's nothing to follow; drop back
    // to looking at the form instead of staring at the last edge it touched.
    const handleLeave = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      setPointer(null);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchstart', handleTouch, { passive: true });
    window.addEventListener('touchmove', handleTouch, { passive: true });
    document.documentElement.addEventListener('mouseleave', handleLeave);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchstart', handleTouch);
      window.removeEventListener('touchmove', handleTouch);
      document.documentElement.removeEventListener('mouseleave', handleLeave);
      cancelAnimationFrame(frame);
    };
  }, []);

  // The form-side gaze target: the focused field if there is one, otherwise
  // the form itself. Measured from the real layout, then re-measured whenever
  // that layout can change (focus moves, resize/rotation, on-screen keyboard,
  // scroll) — so it's correct on a laptop, a phone and a tablet alike.
  useEffect(() => {
    const container = gazeRef?.current;
    if (!container) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const active = document.activeElement;
      const el = active && active !== document.body && container.contains(active) ? active : container;
      const r = el.getBoundingClientRect();
      // Wide fields: aim at where the text/caret is (the left part), not the
      // far-away geometric center.
      setGaze({ x: r.left + Math.min(r.width / 2, 120), y: r.top + r.height / 2 });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, { passive: true, capture: true });
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, { capture: true });
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, [gazeRef, mode]);

  // Idle: follow the pointer, or look at the form until there is one (a phone
  // has no hover cursor). Engaged with the form (typing, glancing at a
  // revealed password, shy): look at it — or, when shy, away from it.
  const aim = mode === 'watch' ? (pointer ?? gaze) : (gaze ?? pointer);
  const away = mode === 'shy';

  return (
    <div aria-hidden="true" data-watchers className="animate-char-rise shrink-0 flex items-end gap-[10px] relative scale-75 min-[500px]:scale-90 min-[800px]:scale-100 ml-0 min-[1100px]:ml-[-40px]">
      {mode === 'remind' && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-[14px] bg-white text-[#14161c] text-[13px] font-semibold whitespace-nowrap py-2 px-3.5 rounded-[14px] shadow-[0_6px_20px_rgba(0,0,0,0.25)] z-[3] animate-bubble-pop after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-[7px] after:border-transparent after:border-t-white">
          Hide your password...
        </div>
      )}
      {/* soft ground shadow that breathes in sync with the characters' float */}
      <div className="absolute -bottom-3 inset-x-3 h-3 rounded-[50%] bg-black/30 blur-md animate-shadow-pulse" />
      <Pencil mode={mode} aim={aim} away={away} bounceKey={bounceKey} />
      <Notebook mode={mode} aim={aim} away={away} bounceKey={bounceKey} />
      <Bookmark mode={mode} aim={aim} away={away} bounceKey={bounceKey} />
      <Folder mode={mode} aim={aim} away={away} bounceKey={bounceKey} />
    </div>
  );
}

export default Watchers;
