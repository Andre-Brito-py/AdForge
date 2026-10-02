// Rótulos traduzidos do catálogo (objetivos, plataformas, estilos), com fallback
// para campanhas antigas que gravaram texto livre em vez das chaves.

type Translator = { (key: string): string; has(key: string): boolean };

export function objectiveLabel(t: Translator, key: string | null | undefined) {
  if (!key) return "—";
  return t.has(`objectives.${key}.label`) ? t(`objectives.${key}.label`) : key;
}

export function platformLabel(t: Translator, key: string | null | undefined) {
  if (!key) return "—";
  return t.has(`platforms.${key}.label`) ? t(`platforms.${key}.label`) : key;
}

export function styleLabel(t: Translator, key: string | null | undefined) {
  if (!key) return "—";
  return t.has(`styles.${key}`) ? t(`styles.${key}`) : key;
}
