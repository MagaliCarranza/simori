// Datos del panel del mapa (M9). Solo une catálogos con la fila de
// resumenPorGrupo; las cifras ya vienen enmascaradas del dominio.

import { calcularPrioridad, COLORES_SEMAFORO, enmascararMenorQue5 } from '../../domain/index.js'
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

// Grupo k-means de la localidad, tomado de grupos_localidades.json (salida de
// scripts/agrupar_localidades.py). Devuelve null si el JSON no cargó, no
// tiene la forma esperada o la localidad no quedó en ningún grupo (le faltaba
// alguna variable); así el panel simplemente no muestra la línea.
function agrupacionPorClave(gruposLocalidades) {
  const vacio = new Map()
  if (!gruposLocalidades || typeof gruposLocalidades !== 'object') return vacio
  const { grupos, localidades } = gruposLocalidades
  if (!Array.isArray(grupos) || !Array.isArray(localidades) || grupos.length === 0) return vacio

  const porNumero = new Map(grupos.filter((g) => g && Number.isInteger(g.grupo)).map((g) => [g.grupo, g]))
  const totalGrupos = Number.isInteger(gruposLocalidades.kElegida) ? gruposLocalidades.kElegida : grupos.length
  const r = new Map()
  for (const l of localidades) {
    const g = l && porNumero.get(l.grupo)
    if (!g || typeof g.descripcion !== 'string' || !Number.isInteger(g.tamano)) continue
    r.set(l.claveInegi, {
      grupo: g.grupo,
      totalGrupos,
      descripcion: g.descripcion,
      parecidas: Math.max(g.tamano - 1, 0),
    })
  }
  return r
}

// "Grupo 1 de 3: <descripción> (otras 12 localidades con perfil parecido)".
export function textoAgrupacion({ grupo, totalGrupos, descripcion, parecidas }) {
  const otras =
    parecidas === 0
      ? 'sin otras localidades con perfil parecido'
      : parecidas === 1
        ? 'otra localidad con perfil parecido'
        : `otras ${parecidas} localidades con perfil parecido`
  return `Grupo ${grupo} de ${totalGrupos}: ${descripcion} (${otras})`
}

// Un panel por localidad del catálogo, ordenado por nombre.
// `localidadesMarco` es el conjunto amplio (todas las del municipio sin
// totales del ITER) que calcularPrioridad usa para normalizar min-max y
// ordenar el lugar en el alcance. Si no se pasa un marco válido (p. ej. el
// JSON no cargó por falta de red y tampoco está en el precache de la PWA),
// NO se calcula prioridad: normalizar solo con las 3 localidades daría
// puntajes distorsionados. En ese caso cada panel trae `prioridad: null` y
// la UI decide cómo comunicar que falta el índice.
// `gruposLocalidades` es el contenido de grupos_localidades.json; si falta,
// cada panel trae `agrupacion: null`.
export function panelesPorLocalidad(
  { localidades, escuelas, centros },
  porLocalidad,
  localidadesMarco,
  gruposLocalidades,
) {
  const grupoPorClave = new Map(porLocalidad.map((g) => [g.clave, g]))
  const agrupacion = agrupacionPorClave(gruposLocalidades)
  const marcoValido = Array.isArray(localidadesMarco) && localidadesMarco.length > 0
  const prioridadPorClave = marcoValido
    ? new Map(
        calcularPrioridad(localidades, undefined, undefined, undefined, localidadesMarco).map((p) => [
          p.claveInegi,
          p,
        ]),
      )
    : null
  return localidades
    .map((l) => {
      const p = prioridadPorClave?.get(l.claveInegi)
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
        agrupacion: agrupacion.get(l.claveInegi) ?? null,
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
      }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}
