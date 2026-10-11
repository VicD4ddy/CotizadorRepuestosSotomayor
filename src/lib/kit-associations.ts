/**
 * Helper utilities for managing many-to-many associations between Clutch Kits and Motor Kits.
 * 
 * Storage format in kit.description:
 * e.g., "PLATO: 1930 | DISCO: 811 | COLLARIN: CT24H [MOTORES: Chevrolet 350 (VORTEC), Chevrolet 350 (TBI)]"
 * 
 * Benefits:
 * 1. Immediate persistence without breaking database schema or requiring DDL migrations.
 * 2. Instant client-side search across all fields (typing "350" matches the description text immediately).
 * 3. Human-readable description when viewed in any external tool or DB backup.
 */

export interface ParsedKitDescription {
  cleanDescription: string;
  associatedMotors: string[];
}

const MOTORES_REGEX = /\[MOTORES:\s*([^\]]+)\]/i;

/**
 * Parses a kit description into a clean description (without tags) and an array of motor names.
 */
export function parseKitDescription(rawDescription?: string | null): ParsedKitDescription {
  if (!rawDescription) {
    return { cleanDescription: '', associatedMotors: [] };
  }

  const match = rawDescription.match(MOTORES_REGEX);
  let associatedMotors: string[] = [];

  if (match && match[1]) {
    associatedMotors = match[1]
      .split(',')
      .map((m) => m.trim())
      .filter((m) => m.length > 0);
  }

  // Remove the [MOTORES: ...] tag and clean up any trailing pipes, spaces, or commas
  let cleanDescription = rawDescription.replace(MOTORES_REGEX, '').trim();
  cleanDescription = cleanDescription.replace(/\|\s*$/, '').trim();

  return { cleanDescription, associatedMotors };
}

/**
 * Re-assembles a kit description with the specified motor names tag.
 */
export function formatKitDescription(cleanDescription: string, motorNames: string[]): string {
  const clean = (cleanDescription || '').trim();
  const validMotors = Array.from(new Set(motorNames.map((m) => m.trim()))).filter(Boolean);

  if (validMotors.length === 0) {
    return clean;
  }

  const motorsTag = `[MOTORES: ${validMotors.join(', ')}]`;
  if (!clean) {
    return motorsTag;
  }

  return `${clean} ${motorsTag}`;
}

/**
 * Checks if a specific motor name matches any of the associated motors of a clutch kit.
 */
export function isMotorAssociatedWithClutch(clutchDescription: string | null | undefined, motorName: string): boolean {
  if (!clutchDescription || !motorName) return false;
  const { associatedMotors } = parseKitDescription(clutchDescription);
  const target = motorName.toLowerCase().trim();
  return associatedMotors.some((m) => m.toLowerCase().trim() === target);
}
