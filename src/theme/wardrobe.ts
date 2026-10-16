/**
 * Cosmetic manifest: genders, hairstyles, outfits as pieces, and the closed colour palette.
 * Nothing here reaches balance.ts or the run: it only changes how the character is drawn.
 */
export const GENDERS = ['m', 'f', 'n'] as const;
export type Gender = (typeof GENDERS)[number];

export const HAIRSTYLES = ['courte', 'longue', 'attachee', 'rasee'] as const;
export type Hairstyle = (typeof HAIRSTYLES)[number];

export type Top = 'polo' | 'veste' | 'sweat' | 'combinaison' | 'tshirt' | 'robe' | 'maillot';
export type Legs = 'survet' | 'pantalon' | 'jogging' | 'none' | 'short' | 'chaussettes';
export type Shoes = 'bulle' | 'ville' | 'basses' | 'bottes' | 'tongs' | 'crampons';
export type Head = 'none' | 'casquette' | 'casque_tissu';
export type Accessory = 'none' | 'sacoche' | 'cravate';

export interface Outfit {
  top: Top;
  legs: Legs;
  shoes: Shoes;
  head: Head;
  accessory: Accessory;
  /** The dress lets the player pick between two shoes. */
  shoeChoice?: readonly Shoes[];
}

export const OUTFITS = {
  depart: { top: 'polo', legs: 'survet', shoes: 'bulle', head: 'casquette', accessory: 'sacoche' },
  costume: { top: 'veste', legs: 'pantalon', shoes: 'ville', head: 'none', accessory: 'cravate' },
  jogging: { top: 'sweat', legs: 'jogging', shoes: 'basses', head: 'none', accessory: 'none' },
  chantier: { top: 'combinaison', legs: 'none', shoes: 'bottes', head: 'casque_tissu', accessory: 'none' },
  plage: { top: 'tshirt', legs: 'short', shoes: 'tongs', head: 'none', accessory: 'none' },
  robe: { top: 'robe', legs: 'none', shoes: 'basses', head: 'none', accessory: 'none', shoeChoice: ['basses', 'bulle'] },
  foot: { top: 'maillot', legs: 'chaussettes', shoes: 'crampons', head: 'none', accessory: 'none' },
} as const satisfies Record<string, Outfit>;

export type OutfitId = keyof typeof OUTFITS;
export const OUTFIT_IDS = Object.keys(OUTFITS) as OutfitId[];

/** Twelve bright fabric colours. Index stored in the save. */
export const FABRIC_COLOURS = [
  '#2a9d8f', '#e63946', '#1d4ed8', '#f4a261', '#ffc531', '#7c3aed',
  '#16a34a', '#ec4899', '#0ea5e9', '#f97316', '#1b1d2a', '#f5f5f5',
] as const;

export interface Look {
  gender: Gender;
  hair: Hairstyle;
  outfit: OutfitId;
  /** Indices into FABRIC_COLOURS: torso, legs, shoes. */
  colours: [number, number, number];
  /** Shoes picked for the dress, when it offers a choice. */
  shoes: Shoes | null;
}

export function defaultLook(): Look {
  return { gender: 'n', hair: 'courte', outfit: 'depart', colours: [0, 10, 11], shoes: null };
}

export function colourAt(index: number): string {
  return FABRIC_COLOURS[((index % FABRIC_COLOURS.length) + FABRIC_COLOURS.length) % FABRIC_COLOURS.length] ?? FABRIC_COLOURS[0];
}

export function shoesOf(look: Look): Shoes {
  const o: Outfit = OUTFITS[look.outfit];
  if (o.shoeChoice && look.shoes && o.shoeChoice.includes(look.shoes)) return look.shoes;
  return o.shoes;
}
