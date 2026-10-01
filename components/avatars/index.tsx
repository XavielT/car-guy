import type { ComponentType } from 'react';

import type { AvatarId } from '@/lib/avatars';
import type { AvatarArtProps } from './base';
import { CarCoupe, CarHatch, CarKei, CarPickup, CarWagon } from './cars';
import { HelmetFull, HelmetKart, HelmetOpen } from './helmets';
import { Turbo, TireSmoke, Wheel, WrenchSpanner } from './parts';
import { Checkered, KanjiHashiru, KanjiKai, KanjiTouge } from './symbols';

/** The drawing for each avatar id (ids and labels: lib/avatars.ts). */
export const AVATAR_ART: Record<AvatarId, ComponentType<AvatarArtProps>> = {
  helmet_full: HelmetFull,
  helmet_open: HelmetOpen,
  helmet_kart: HelmetKart,
  car_coupe: CarCoupe,
  car_hatch: CarHatch,
  car_kei: CarKei,
  car_pickup: CarPickup,
  car_wagon: CarWagon,
  wheel: Wheel,
  turbo: Turbo,
  checkered: Checkered,
  kanji_kai: KanjiKai,
  kanji_hashiru: KanjiHashiru,
  kanji_touge: KanjiTouge,
  wrench_spanner: WrenchSpanner,
  tire_smoke: TireSmoke,
};

export type { AvatarArtProps } from './base';
