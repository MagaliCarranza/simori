// Datos del panel del mapa (M9). Solo une catálogos con la fila de
// resumenPorGrupo; las cifras ya vienen enmascaradas del dominio.

import { calcularPrioridad, COLORES_SEMAFORO, enmascararMenorQue5 } from '../../domain/index.js'

// Una localidad sin casos no aparece en resumenPorGrupo: su 0 se muestra como
// "menos de 5" (limitación conocida: no entra en la supresión por columna).
const SIN_CASOS = enmascararMenorQue5(0)

function pendientesDe(grupo) {
  if (!grupo) {
    return {
      total: SIN_CASOS,
      enSeguimiento: SIN_CASOS,
      semaforo: Object.fromEntries(COLORES_SEMAFORO.map((c) => [c, SIN_CASOS])),
      sinSeguimiento: SIN_CASOS,
    }
  }
  return {
    total: grupo.total,
    enSeguimiento: grupo.salidas.en_seguimiento,
    semaforo: grupo.semaforo,
    sinSeguimiento: grupo.salidas.sin_seguimiento,
  }
}

// El catálogo trae "(provisional)" en el nombre; el panel ya lo dice con su etiqueta.
const nombreCentro = (c) => (c.provisional ? c.nombre.replace(/\s*\(provisional\)\s*$/i, '') : c.nombre)

const tieneCoordenadas = (l) => Number.isFinite(l.lat) && Number.isFinite(l.lng)

// Un panel por localidad del catálogo, ordenado por nombre.
// `localidadesMarco` es el conjunto amplio (todas las del municipio sin
// totales del ITER) que calcularPrioridad usa para normalizar min-max y
// ordenar el lugar en el alcance. Si no se pasa, se usa el mismo catálogo
// (menos marco, menos informativo).
export function panelesPorLocalidad(
  { localidades, escuelas, centros },
  porLocalidad,
  localidadesMarco,
) {
  const grupoPorClave = new Map(porLocalidad.map((g) => [g.clave, g]))
  const marco = localidadesMarco && localidadesMarco.length > 0 ? localidadesMarco : localidades
  const prioridadPorClave = new Map(
    calcularPrioridad(localidades, undefined, undefined, undefined, marco).map((p) => [
      p.claveInegi,
      p,
    ]),
  )
  return localidades
    .map((l) => {
      const p = prioridadPorClave.get(l.claveInegi)
      return {
        claveInegi: l.claveInegi,
        nombre: l.nombre,
        gradoMarginacion: l.gradoMarginacion ?? null,
        poblacion5a14: l.poblacion5a14 ?? null,
        coordenadas: tieneCoordenadas(l) ? [l.lat, l.lng] : null,
        prioridad: p
          ? {
              nivel: p.nivel,
              puntaje: p.puntaje,
              lugarAlcance: p.lugarAlcance,
              totalAlcance: p.totalAlcance,
              razon: p.razon,
            }
          : null,
        escuelas: escuelas
          .filter((e) => e.claveInegi === l.claveInegi)
          .map((e) => ({
            cct: e.cct,
            nombre: e.nombre,
            turno: e.turno ?? null,
            matricula: e.matricula ?? null,
            ubicacionAproximada: Boolean(e.ubicacionAproximada),
          }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
        centros: centros
          .filter((c) => c.claveInegi === l.claveInegi)
          .map((c) => ({ clues: c.clues, nombre: nombreCentro(c), provisional: Boolean(c.provisional) })),
        pendientes: pendientesDe(grupoPorClave.get(l.claveInegi)),
      }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}
