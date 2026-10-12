/**
 * The home screen's single attention slot (MindPay ใหม่): at most ONE card
 * above the money card, so the money is always the first thing seen.
 *
 * Money items come first and stay until they are dealt with (a load error, the
 * automatic slip scan, slips waiting to be confirmed). New rewards the user just
 * earned come next. Everything promotional (the month's story, the Halloween
 * invitation, what's new) is limited to one per day: the one chosen in the
 * morning stays for the day; closing it leaves the slot empty until tomorrow.
 */

export type MoneyItem = 'error' | 'autoscan' | 'drafts';
export type PromoItem = 'recap' | 'halloween' | 'whatsnew';
export type AttentionItem = MoneyItem | 'rewards' | PromoItem;

export const MONEY_ORDER: MoneyItem[] = ['error', 'autoscan', 'drafts'];
export const PROMO_ORDER: PromoItem[] = ['recap', 'halloween', 'whatsnew'];

/** Which promotional item had today's turn (remembered on this phone). */
export interface PromoTurn {
  day: string;
  item: PromoItem | null;
  closed: boolean;
}

export function pickAttention(p: {
  money: MoneyItem[];
  rewards: boolean;
  promos: PromoItem[];
  turn: PromoTurn | null;
  today: string;
}): { item: AttentionItem | null; turn: PromoTurn } {
  const pendingPromo = PROMO_ORDER.find((x) => p.promos.includes(x)) ?? null;
  // Today's promotional turn: kept for the whole day once chosen.
  let turn: PromoTurn;
  if (p.turn && p.turn.day === p.today) {
    turn = p.turn.item === null && !p.turn.closed && pendingPromo ? { ...p.turn, item: pendingPromo } : p.turn;
  } else {
    turn = { day: p.today, item: pendingPromo, closed: false };
  }
  const money = MONEY_ORDER.find((x) => p.money.includes(x));
  if (money) return { item: money, turn };
  if (p.rewards) return { item: 'rewards', turn };
  const promo = !turn.closed && turn.item && p.promos.includes(turn.item) ? turn.item : null;
  return { item: promo, turn };
}
