// Normaliza texto para busca fuzzy: minúsculas, sem acentos e sem
// caracteres não alfanuméricos. Assim "Pizzaria do João" e
// "pizzaria-do-joao" viram ambos "pizzariadojoao".
export function normalizarBusca(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}
