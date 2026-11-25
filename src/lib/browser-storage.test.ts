import { afterEach, describe, expect, it, vi } from "vitest";
import { lerPreferencia, salvarPreferencia } from "./browser-storage";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe.each(["localStorage", "sessionStorage"] as const)("Optional %s persistence", (tipo) => {
  it("reads, writes and removes remembered values when available", () => {
    salvarPreferencia(tipo, "teste", "valor");
    expect(lerPreferencia(tipo, "teste")).toBe("valor");
    salvarPreferencia(tipo, "teste", null);
    expect(lerPreferencia(tipo, "teste")).toBeNull();
  });

  it("does not crash when the browser blocks access to storage", () => {
    vi.spyOn(window, tipo, "get").mockImplementation(() => {
      throw new DOMException("Blocked by privacy settings", "SecurityError");
    });
    expect(lerPreferencia(tipo, "teste")).toBeNull();
    expect(() => salvarPreferencia(tipo, "teste", "valor")).not.toThrow();
    expect(() => salvarPreferencia(tipo, "teste", null)).not.toThrow();
  });

  it("does not crash when browser storage is full", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage full", "QuotaExceededError");
    });
    expect(() => salvarPreferencia(tipo, "teste", "valor")).not.toThrow();
    expect(lerPreferencia(tipo, "teste")).toBeNull();
  });
});