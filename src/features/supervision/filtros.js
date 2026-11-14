// Filtros de supervisión (RF08): localidad → escuela → centro.
// Solo relaciona casos con catálogos; las reglas viven en src/domain/.

import { atiende } from './catalogos.js'

export const FILTROS_INICIALES = { localidad: '', cct: '', clues: '' }

// Localidad de un caso: la de su escuela (las escuelas traen claveInegi).
export function localidadDeCaso(caso, escuelasPorCct) {
  return escuelasPorCct.get(caso.cct)?.claveInegi ?? null
}

export function filtrarCasos(casos, filtros, escuelasPorCct) {
  return casos.filter((c) => {
    if (filtros.localidad && localidadDeCaso(c, escuelasPorCct) !== filtros.localidad) return false
    if (filtros.cct && c.cct !== filtros.cct) return false
    if (filtros.clues && c.clues !== filtros.clues) return false
    return true
  })
}

const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es')

// El centro de una localidad es el que la atiende (cluesOperativo), aunque
// esté en otra localidad.
function centroDeLocalidad(claveInegi, localidades, centro) {
  const localidad = localidades.find((l) => l.claveInegi === claveInegi)
  return Boolean(localidad) && atiende(localidad, centro)
}

// Opciones de cada select; escuelas y centros se limitan a la localidad elegida.
export function opcionesFiltros({ localidades, escuelas, centros }, filtros) {
  const enLocalidad = (e) => !filtros.localidad || e.claveInegi === filtros.localidad
  const atiendeLocalidad = (c) => !filtros.localidad || centroDeLocalidad(filtros.localidad, localidades, c)
  return {
    localidades: [...localidades].sort(porNombre),
    escuelas: escuelas.filter(enLocalidad).sort(porNombre),
    centros: centros.filter(atiendeLocalidad).sort(porNombre),
  }
}

// Al cambiar la localidad se limpian escuela y centro si ya no pertenecen a ella.
export function cambiarFiltro(filtros, cambio, { localidades, escuelas, centros }) {
  const nuevo = { ...filtros, ...cambio }
  if ('localidad' in cambio && nuevo.localidad) {
    const escuela = escuelas.find((e) => e.cct === nuevo.cct)
    if (escuela && escuela.claveInegi !== nuevo.localidad) nuevo.cct = ''
    const centro = centros.find((c) => c.clues === nuevo.clues)
    if (centro && !centroDeLocalidad(nuevo.localidad, localidades, centro)) nuevo.clues = ''
  }
  return nuevo
}
