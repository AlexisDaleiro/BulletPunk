import { WEAPONS, isWeaponId } from '../combat/weapons.ts';
import { KEY_INFO } from '../config.ts';
import type { PickupComponent } from '../ecs/components.ts';
import { IMPLANTS, isImplantId } from '../shop/implants.ts';
import type { WeaponType } from '../types.ts';

export interface PickupAppearance {
  color: number;
  name: string;
  icon: PickupComponent['kind'];
  weaponType?: WeaponType;
  cacheKey: string;
}

export function pickupAppearance(p: PickupComponent): PickupAppearance {
  const key = `loot:${p.kind}:${p.id ?? ''}`;
  switch (p.kind) {
    case 'WEAPON': {
      const weapon = p.id && isWeaponId(p.id) ? WEAPONS[p.id] : undefined;
      return { color: 0xebc778, name: weapon?.name ?? 'ARMA', icon: p.kind, weaponType: weapon?.type ?? 'PISTOL', cacheKey: key };
    }
    case 'AMMO': return { color: 0xdab37b, name: 'MUNICIÓN', icon: p.kind, cacheKey: key };
    case 'HEAL': return { color: 0xff8297, name: 'BOTIQUÍN', icon: p.kind, cacheKey: key };
    case 'IMPLANT': return { color: 0xc5a1f2, name: p.id && isImplantId(p.id) ? IMPLANTS[p.id].name : 'IMPLANTE', icon: p.kind, cacheKey: key };
    case 'KEY': {
      const info = KEY_INFO[p.id as keyof typeof KEY_INFO];
      return { color: info?.color ?? 0xebc778, name: info?.name ?? 'TARJETA DE ACCESO', icon: p.kind, cacheKey: key };
    }
    case 'CREDITS': return { color: 0x9ad4ae, name: `CRÉDITOS +${p.amount}`, icon: p.kind, cacheKey: key };
  }
}
