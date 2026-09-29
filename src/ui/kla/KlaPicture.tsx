/**
 * น้องกล้า as one still picture (all parts in one SVG): the small companion,
 * skin previews and the app icon use this. The big talking coach moves the
 * parts separately instead (KlaStage.tsx).
 *
 * The picture is `width` wide and 1.2 × `width` tall (the 200 × 240 canvas);
 * the character stands in the lower `width` × `width` square and hats may rise
 * into the top part.
 */
import { useId } from 'react';
import Svg from 'react-native-svg';
import type { BuddyMood } from '../../domain/buddy';
import type { SkinId } from '../../domain/skins';
import { KlaArm, KlaBack, KlaDefs, KlaExtras, KlaEyes, KlaGlasses, KlaGround, KlaHead, KlaMouth, KLA_H, KLA_W } from './art';

export function KlaPicture({
  skin,
  mood = 'calm',
  width,
  blink,
  onDark = false,
  extras = true,
  ground = true,
}: {
  skin: SkinId;
  mood?: BuddyMood;
  width: number;
  blink?: boolean;
  onDark?: boolean;
  /** Z's, sparkles or thought bubbles for the mood. */
  extras?: boolean;
  ground?: boolean;
}) {
  const id = `k${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={width} height={(width * KLA_H) / KLA_W} viewBox={`0 0 ${KLA_W} ${KLA_H}`}>
      <KlaDefs id={id} skin={skin} onDark={onDark} />
      {ground ? <KlaGround id={id} /> : null}
      <KlaBack id={id} skin={skin} />
      <KlaArm id={id} skin={skin} side="L" mood={mood} />
      <KlaArm id={id} skin={skin} side="R" mood={mood} />
      <KlaHead id={id} skin={skin} mood={mood} />
      <KlaEyes id={id} mood={mood} closed={blink} />
      <KlaGlasses skin={skin} />
      <KlaMouth mood={mood} skin={skin} />
      {extras ? <KlaExtras mood={mood} /> : null}
    </Svg>
  );
}
