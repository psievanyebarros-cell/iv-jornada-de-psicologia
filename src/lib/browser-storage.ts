type StorageKind = "localStorage" | "sessionStorage";

/** Remembering fields is optional; browser privacy settings must not stop access. */
export function lerPreferencia(tipo: StorageKind, chave: string): string | null {
  try {
    return window[tipo].getItem(chave);
  } catch {
    return null;
  }
}

export function salvarPreferencia(tipo: StorageKind, chave: string, valor: string | null): void {
  try {
    if (valor === null) window[tipo].removeItem(chave);
    else window[tipo].setItem(chave, valor);
  } catch {
    // Continue in the current page without persisting anything in the browser.
  }
}