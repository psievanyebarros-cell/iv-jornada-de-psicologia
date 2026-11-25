import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ identificar: vi.fn(), entrar: vi.fn(), navigate: vi.fn() }));

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...await importOriginal<typeof import("@tanstack/react-router")>(),
  useNavigate: () => mocks.navigate,
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/components/SiteHeader", () => ({
  SiteHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  CategoriaBadge: () => null,
}));
vi.mock("@/lib/jornada.functions", () => ({
  identificarAvaliador: mocks.identificar,
  entrarAdmin: mocks.entrar,
  adicionarAvaliador: vi.fn(), adicionarTrabalho: vi.fn(), atualizarAvaliacaoAdmin: vi.fn(),
  dadosAdmin: vi.fn(), removerRegistro: vi.fn(),
}));

import { Route as InicioRoute } from "@/routes/index";
import { Route as AdminRoute } from "@/routes/admin";

function autofill(input: HTMLElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("Input value setter unavailable");
  setter.call(input, value);
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe("Access forms with browser autofill", () => {
  it("submits the actual evaluator name even without a change event", async () => {
    mocks.identificar.mockResolvedValue({ id: "avaliador-teste", nome: "Maria Silva" });
    const Inicio = InicioRoute.options.component as ComponentType;
    render(<Inicio />);
    autofill(screen.getByLabelText("Digite seu Nome Completo"), "Maria Silva");
    fireEvent.click(screen.getByRole("button", { name: /Acessar Painel/ }));
    await waitFor(() => expect(mocks.identificar).toHaveBeenCalledWith({ data: { nome: "Maria Silva" } }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/avaliador/$avaliadorId", params: { avaliadorId: "avaliador-teste" },
    }));
  });

  it("submits the actual admin password even without a change event", async () => {
    mocks.entrar.mockRejectedValue(new Error("Senha incorreta."));
    const Admin = AdminRoute.options.component as ComponentType;
    render(<Admin />);
    autofill(screen.getByLabelText("Senha de acesso"), "senha-de-teste");
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => expect(mocks.entrar).toHaveBeenCalledWith({ data: { senha: "senha-de-teste" } }));
    await screen.findByText("Senha incorreta.");
  });
});