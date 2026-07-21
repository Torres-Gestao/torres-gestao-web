// Calcula se a loja está aberta agora com base em `horarios_funcionamento`.
// Formato gravado pelo PDV on-premise (exemplo):
//   { "dom": {"abre":"10:00","fecha":"21:45"},
//     "seg": {"abre":"18:00","fecha":"23:00"},
//     ...,
//     "tz": "America/Sao_Paulo" }
//
// Também aceita array de janelas por dia:
//   { "sex": [{"abre":"11:00","fecha":"14:00"}, {"abre":"18:00","fecha":"23:00"}] }
//
// Fallback: se horarios_funcionamento estiver vazio/ausente ou não tiver
// entrada para o dia atual, usa loja.loja_aberta.

export type Janela = { abre: string; fecha: string };
export type DiaHorario = Janela | Janela[] | null;

export interface HorariosFuncionamento {
  dom?: DiaHorario;
  seg?: DiaHorario;
  ter?: DiaHorario;
  qua?: DiaHorario;
  qui?: DiaHorario;
  sex?: DiaHorario;
  sab?: DiaHorario;
  tz?: string;
  [k: string]: unknown;
}

const DIAS: Array<keyof HorariosFuncionamento> = [
  "dom",
  "seg",
  "ter",
  "qua",
  "qui",
  "sex",
  "sab",
];

const DEFAULT_TZ = "America/Sao_Paulo";

// Retorna { weekday: 0..6, minutes: 0..1439 } no timezone informado.
function nowInTz(tz: string): { weekday: number; minutes: number } {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(new Date());
    const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
    const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    const map: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    // Intl às vezes devolve "24" — normaliza.
    const hour = hh === 24 ? 0 : hh;
    return { weekday: map[wd] ?? 0, minutes: hour * 60 + mm };
  } catch {
    const d = new Date();
    return { weekday: d.getDay(), minutes: d.getHours() * 60 + d.getMinutes() };
  }
}

function parseHHMM(s: string | undefined | null): number | null {
  if (!s || typeof s !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h < 0 || h > 24 || mi < 0 || mi > 59) return null;
  return h * 60 + mi;
}

function janelaContem(janela: Janela, minutosAgora: number): boolean {
  const ini = parseHHMM(janela.abre);
  const fim = parseHHMM(janela.fecha);
  if (ini == null || fim == null) return false;
  if (fim > ini) {
    return minutosAgora >= ini && minutosAgora < fim;
  }
  // Janela cruza meia-noite (ex.: 22:00 → 02:00).
  return minutosAgora >= ini || minutosAgora < fim;
}

function normalizarDia(v: DiaHorario | undefined): Janela[] | null {
  if (!v) return null;
  if (Array.isArray(v)) return v.length ? v : null;
  if (typeof v === "object" && "abre" in v && "fecha" in v) return [v as Janela];
  return null;
}

export interface LojaStatusInput {
  loja_aberta?: boolean | null;
  horarios_funcionamento?: HorariosFuncionamento | null;
}

export function isLojaAberta(loja: LojaStatusInput): boolean {
  const h = loja.horarios_funcionamento;
  if (!h || typeof h !== "object") {
    return !!loja.loja_aberta;
  }
  const tz = typeof h.tz === "string" && h.tz ? h.tz : DEFAULT_TZ;
  const { weekday, minutes } = nowInTz(tz);
  const chave = DIAS[weekday];
  const janelas = normalizarDia(h[chave] as DiaHorario | undefined);
  // Se cruza meia-noite, também considera janelas do dia anterior.
  const chaveAnterior = DIAS[(weekday + 6) % 7];
  const janelasAnt = normalizarDia(h[chaveAnterior] as DiaHorario | undefined);

  const abertaHoje = janelas?.some((j) => janelaContem(j, minutes)) ?? false;
  const abertaOntemAtravessando =
    janelasAnt?.some((j) => {
      const ini = parseHHMM(j.abre);
      const fim = parseHHMM(j.fecha);
      if (ini == null || fim == null) return false;
      // Só interessa se cruza meia-noite; senão minutosAgora do dia atual não conta.
      if (fim > ini) return false;
      return minutes < fim;
    }) ?? false;

  // Se não há entrada nenhuma para o dia (nem anterior atravessando), usa fallback.
  if (!janelas && !janelasAnt) return !!loja.loja_aberta;

  return abertaHoje || abertaOntemAtravessando;
}
