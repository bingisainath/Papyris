// src/components/common/Gradient.tsx
// A diagonal two-colour gradient that fills its parent (put it first inside a View with overflow hidden).

import React, { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

const Gradient: React.FC<{ from: string; to: string }> = ({ from, to }) => {
  const id = `g${useId().replace(/:/g, '')}`;
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
};

/** The purple used for the big summary cards (Expenses, a chat's position). */
export const CARD_GRADIENT = { from: '#4a376e', to: '#705798' };

// Initials sit on one of these, picked from the name, so a person keeps the same colour everywhere (same as web)
const TONES: [string, string][] = [
  ['#7964a6', '#4b376e'], // purple
  ['#cf8490', '#9b4e5a'], // rose
  ['#e1a34b', '#a75a13'], // amber
  ['#5c91c9', '#36618d'], // blue
  ['#51a676', '#27714a'], // green
  ['#8995a8', '#586477'], // slate
];

export function toneFor(name: string): [string, string] {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return TONES[Math.abs(hash) % TONES.length];
}

export default Gradient;
