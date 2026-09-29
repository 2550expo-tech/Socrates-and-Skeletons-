/**
 * The app icon, splash and favicon pictures, drawn from the same น้องกล้า
 * parts the app uses (src/ui/kla/art.tsx), as SVG text.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { KlaArm, KlaBack, KlaDefs, KlaEyes, KlaGlasses, KlaGround, KlaHead, KlaMouth } from '../../src/ui/kla/art';

const FOREST_TOP = '#1E6A4B';
const FOREST = '#0E3B2C';
const FOREST_DEEP = '#072319';

function Kla({ id, onDark, ground = true }: { id: string; onDark: boolean; ground?: boolean }) {
  return (
    <g>
      <KlaDefs id={id} skin="classic" onDark={onDark} />
      {ground ? <KlaGround id={id} /> : null}
      <KlaBack id={id} skin="classic" />
      <KlaArm id={id} skin="classic" side="L" mood="happy" />
      <KlaArm id={id} skin="classic" side="R" mood="happy" />
      <KlaHead id={id} skin="classic" mood="happy" />
      <KlaEyes id={id} mood="happy" />
      <KlaGlasses skin="classic" />
      <KlaMouth mood="happy" />
    </g>
  );
}

/** น้องกล้า scaled so its body (canvas y 30…236) fills `height` px, centred at (cx, top). */
function placed(cx: number, top: number, height: number, child: React.ReactNode) {
  const k = height / 206;
  return <g transform={`translate(${cx - 100 * k} ${top - 30 * k}) scale(${k})`}>{child}</g>;
}

function Backdrop({ size, round = 0 }: { size: number; round?: number }) {
  return (
    <>
      <defs>
        <radialGradient id="bg" cx="50%" cy="38%" r="75%">
          <stop offset="0" stopColor={FOREST_TOP} />
          <stop offset="0.55" stopColor={FOREST} />
          <stop offset="1" stopColor={FOREST_DEEP} />
        </radialGradient>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#F2C94C" stopOpacity={0.38} />
          <stop offset="0.6" stopColor="#F2C94C" stopOpacity={0.1} />
          <stop offset="1" stopColor="#F2C94C" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={size} height={size} rx={round} fill="url(#bg)" />
      <ellipse cx={size / 2} cy={size * 0.42} rx={size * 0.42} ry={size * 0.4} fill="url(#glow)" />
    </>
  );
}

const svg = (size: number, body: React.ReactNode) =>
  renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {body}
    </svg>,
  );

/** iOS and general icon: square, no transparency (the system rounds the corners). */
export const icon = (size = 1024) =>
  svg(
    size,
    <>
      <Backdrop size={size} />
      {placed(size / 2, size * 0.09, size * 0.84, <Kla id="i" onDark />)}
    </>,
  );

/** Android adaptive icon foreground: only the middle 61% is sure to show. */
export const adaptiveForeground = (size = 1024) => svg(size, placed(size / 2, size * 0.2, size * 0.6, <Kla id="a" onDark ground={false} />));

/** Android adaptive icon background. */
export const adaptiveBackground = (size = 1024) => svg(size, <Backdrop size={size} />);

/** Splash: น้องกล้า alone (app.json paints the forest green behind it). */
export const splash = (size = 1024) => svg(size, placed(size / 2, size * 0.04, size * 0.92, <Kla id="s" onDark />));

/** Favicon and web app icons. */
export const webIcon = (size: number, round = 0) =>
  svg(
    size,
    <>
      <Backdrop size={size} round={round} />
      {placed(size / 2, size * 0.1, size * 0.82, <Kla id="w" onDark />)}
    </>,
  );
