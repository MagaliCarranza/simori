// Catálogos que usan supervisión y el mapa. El catálogo de localidades trae
// todo el municipio (incluida la fila "Total del Municipio"); aquí se dejan
// solo las localidades en alcance, sus escuelas y los centros que las atienden.

// Un centro atiende a una localidad si es su centro operativo.
export const atiende = (localidad, centro) => localidad.cluesOperativo === centro.clues

export function catalogosEnAlcance({ localidades = [], escuelas = [], centros = [] }) {
  const enAlcance = localidades.filter((l) => l.enAlcance === true)
  const claves = new Set(enAlcance.map((l) => l.claveInegi))
  const clues = new Set(enAlcance.map((l) => l.cluesOperativo).filter(Boolean))
  return {
    localidades: enAlcance,
    escuelas: escuelas.filter((e) => claves.has(e.claveInegi)),
    centros: centros.filter((c) => clues.has(c.clues)),
  }
}
