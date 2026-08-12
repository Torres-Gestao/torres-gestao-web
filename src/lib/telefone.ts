import { onlyDigits, formatPhone } from "@/lib/money";

export interface Pais {
  ddi: string; // sem "+"
  nome: string;
  bandeira: string;
}

// Lista enxuta e prática (Brasil primeiro), cobrindo os destinos mais comuns.
export const PAISES: Pais[] = [
  { ddi: "55", nome: "Brasil", bandeira: "🇧🇷" },
  { ddi: "1", nome: "EUA / Canadá", bandeira: "🇺🇸" },
  { ddi: "351", nome: "Portugal", bandeira: "🇵🇹" },
  { ddi: "34", nome: "Espanha", bandeira: "🇪🇸" },
  { ddi: "44", nome: "Reino Unido", bandeira: "🇬🇧" },
  { ddi: "353", nome: "Irlanda", bandeira: "🇮🇪" },
  { ddi: "33", nome: "França", bandeira: "🇫🇷" },
  { ddi: "39", nome: "Itália", bandeira: "🇮🇹" },
  { ddi: "49", nome: "Alemanha", bandeira: "🇩🇪" },
  { ddi: "41", nome: "Suíça", bandeira: "🇨🇭" },
  { ddi: "31", nome: "Holanda", bandeira: "🇳🇱" },
  { ddi: "32", nome: "Bélgica", bandeira: "🇧🇪" },
  { ddi: "54", nome: "Argentina", bandeira: "🇦🇷" },
  { ddi: "56", nome: "Chile", bandeira: "🇨🇱" },
  { ddi: "57", nome: "Colômbia", bandeira: "🇨🇴" },
  { ddi: "58", nome: "Venezuela", bandeira: "🇻🇪" },
  { ddi: "595", nome: "Paraguai", bandeira: "🇵🇾" },
  { ddi: "598", nome: "Uruguai", bandeira: "🇺🇾" },
  { ddi: "591", nome: "Bolívia", bandeira: "🇧🇴" },
  { ddi: "51", nome: "Peru", bandeira: "🇵🇪" },
  { ddi: "52", nome: "México", bandeira: "🇲🇽" },
  { ddi: "61", nome: "Austrália", bandeira: "🇦🇺" },
  { ddi: "81", nome: "Japão", bandeira: "🇯🇵" },
  { ddi: "244", nome: "Angola", bandeira: "🇦🇴" },
  { ddi: "258", nome: "Moçambique", bandeira: "🇲🇿" },
];

export const DDI_PADRAO = "55";

/** Formata conforme o país: Brasil usa a máscara local, os demais só dígitos. */
export function formatTelefoneLocal(ddi: string, valor: string): string {
  if (ddi === DDI_PADRAO) return formatPhone(valor);
  return onlyDigits(valor).slice(0, 15);
}

/** Número completo em E.164 sem o "+" (ex.: 5562999998888). */
export function telefoneE164(ddi: string, local: string): string {
  const d = onlyDigits(local);
  if (!d) return "";
  return `${onlyDigits(ddi)}${d}`;
}

export function isTelefoneValido(ddi: string, local: string): boolean {
  const d = onlyDigits(local);
  if (ddi === DDI_PADRAO) return d.length === 10 || d.length === 11;
  const completo = telefoneE164(ddi, local);
  return completo.length >= 7 && completo.length <= 15;
}
