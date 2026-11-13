// Datos del panel del mapa (M9). Solo une catálogos con la fila de
// resumenPorGrupo; las cifras ya vienen enmascaradas del dominio.

import { COLORES_SEMAFORO, enmascararMenorQue5 } from '../../domain/index.js'
import { atiende } from '../supervision/catalogos.js'

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

const tieneCoordenadas = (x) => Number.isFinite(x.lat) && Number.isFinite(x.lng)

// Centro que atiende a la localidad (cluesOperativo), aunque esté en otra.
// El nombre se deja tal como viene en CLUES.
function centroDe(localidad, centros) {
  const c = centros.find((centro) => atiende(localidad, centro))
  if (!c) return null
  return {
    clues: c.clues,
    nombre: c.nombre,
    institucion: c.institucion ?? null,
    distanciaKm: Number.isFinite(localidad.distanciaKm) ? localidad.distanciaKm : null,
    ubicacionAproximada: Boolean(c.ubicacionAproximada),
  }
}

// Centros que atienden a alguna localidad, con coordenadas, para el mapa.
export function centrosEnMapa(localidades, centros) {
  return centros
    .filter((c) => tieneCoordenadas(c) && localidades.some((l) => atiende(l, c)))
    .map((c) => ({
      clues: c.clues,
      nombre: c.nombre,
      coordenadas: [c.lat, c.lng],
      ubicacionAproximada: Boolean(c.ubicacionAproximada),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

// Un panel por localidad del catálogo, ordenado por nombre.
export function panelesPorLocalidad({ localidades, escuelas, centros }, porLocalidad) {
  const grupoPorClave = new Map(porLocalidad.map((g) => [g.clave, g]))
  return localidades
    .map((l) => ({
      claveInegi: l.claveInegi,
      nombre: l.nombre,
      gradoMarginacion: l.gradoMarginacion ?? null,
      poblacion5a14: l.poblacion5a14 ?? null,
      coordenadas: tieneCoordenadas(l) ? [l.lat, l.lng] : null,
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
      centro: centroDe(l, centros),
      pendientes: pendientesDe(grupoPorClave.get(l.claveInegi)),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}
