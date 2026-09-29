/**
 * Stand-in for react-native-svg when drawing น้องกล้า as a plain SVG file
 * (for the app icon and splash). Maps each component to the SVG element of
 * the same name and turns react-native-svg's `rotation` + `origin` into a
 * `transform`.
 */
import { createElement, type ReactNode } from 'react';

type Props = Record<string, unknown> & { children?: ReactNode };

function clean(props: Props): Props {
  const { rotation, origin, style: _style, ...rest } = props;
  if (rotation !== undefined) {
    const [ox, oy] = String(origin ?? '0, 0')
      .split(',')
      .map((v) => Number(v.trim()));
    rest.transform = `rotate(${rotation} ${ox} ${oy})`;
  }
  return rest;
}

const el = (tag: string) =>
  function SvgPart(props: Props) {
    return createElement(tag, clean(props));
  };

export default function Svg(props: Props) {
  return createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', ...clean(props) });
}
export const Circle = el('circle');
export const Ellipse = el('ellipse');
export const G = el('g');
export const Path = el('path');
export const Rect = el('rect');
export const Defs = el('defs');
export const LinearGradient = el('linearGradient');
export const RadialGradient = el('radialGradient');
export const Stop = el('stop');
