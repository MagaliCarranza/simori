// Lógica pura de las secciones de Captura: Pacientes tamizados (todos),
// Muestras y lab, y Guardados en el equipo. Las reglas (semáforo, siguiente
// etapa) vienen de src/domain/; aquí solo se combinan, filtran y ordenan.
// Sin React ni Dexie.

import { calcularSemaforo, estadoDerivado, siguienteEtapa } from '../../domain/index.js'
import { agruparEventosPorCaso } from '../pendientes/pendientes.js'

// Nombres para mostrar (no son reglas).
export const NOMBRES_ETAPA = {
  1: 'Tamizaje',
  2: 'Confirmación',
  3: 'Valoración',
  4: 'Clasificación',
  5: 'Salida',
}

const TEXTO_ESTADO = {
  en_seguimiento: 'En seguimiento',
  sin_seguimiento: 'Sin seguimiento',
  vigilancia: 'En vigilancia',
  alta: 'Cerrado: alta',
  referido: 'Cerrado: referido',
}

const ACTIVOS = new Set(['en_seguimiento', 'sin_seguimiento'])

// Todos los casos tamizados del centro, incluidos los cerrados.
export function filasTamizados({ casos, eventos, clues, hoyISO }) {
  const eventosPorCaso = agruparEventosPorCaso(eventos)
  return casos
    .filter((c) => c.clues === clues)
    .map((c) => {
      const eventosCaso = eventosPorCaso.get(c.codigo) || []
      // El estado sale del dominio (el evento manda), igual que en el semáforo.
      const estado = estadoDerivado(c, eventosCaso)
      return {
        codigo: c.codigo,
        cct: c.cct,
        fechaTamizaje: c.fechaTamizaje ?? null,
        fechaProximaCita: c.fechaProximaCita ?? null,
        etapaActual: c.etapaActual ?? 1,
        etapaTexto: NOMBRES_ETAPA[c.etapaActual] ?? 'Tamizaje',
        estado,
        estadoTexto: TEXTO_ESTADO[estado] ?? estado,
        semaforo: calcularSemaforo(c, eventosCaso, hoyISO),
      }
    })
}

// Más reciente primero; en empate, por código.
export function ordenarTamizados(filas) {
  return [...filas].sort((a, b) => {
    const fa = a.fechaTamizaje ?? ''
    const fb = b.fechaTamizaje ?? ''
    if (fa !== fb) return fa < fb ? 1 : -1
    return a.codigo.localeCompare(b.codigo)
  })
}

// Busca por código sin importar mayúsculas: "0131", "ac-0131" o "PON-AC-0131".
export function coincideCodigo(codigo, texto) {
  const buscado = (texto ?? '').trim().toUpperCase().replace(/\s+/g, '')
  if (!buscado) return true
  return codigo.toUpperCase().includes(buscado)
}

export function filtrarTamizados(filas, { texto = '', cct = '' } = {}) {
  return ordenarTamizados(filas.filter((f) => coincideCodigo(f.codigo, texto) && (!cct || f.cct === cct)))
}

// Qué muestra o estudio espera cada etapa (texto para la pantalla).
export const MUESTRA_POR_ETAPA = {
  2: { titulo: 'Confirmación', detalle: 'Segunda tira de orina, 12 semanas después del tamizaje.' },
  3: { titulo: 'Valoración', detalle: 'Creatinina en sangre, talla, peso y presión arterial.' },
  4: { titulo: 'Clasificación', detalle: 'Cociente albúmina/creatinina en orina. La confirma el personal de salud.' },
}

// Casos activos que esperan una muestra o estudio, agrupados por la etapa
// que sigue. Dentro de cada grupo, la cita más próxima primero.
export function gruposMuestras(filas) {
  const porEtapa = new Map(Object.keys(MUESTRA_POR_ETAPA).map((e) => [Number(e), []]))
  for (const f of filas) {
    if (!ACTIVOS.has(f.estado)) continue
    const siguiente = siguienteEtapa(f.etapaActual)
    if (porEtapa.has(siguiente)) porEtapa.get(siguiente).push(f)
  }
  return [...porEtapa.entries()].map(([etapa, casos]) => ({
    etapa,
    ...MUESTRA_POR_ETAPA[etapa],
    casos: [...casos].sort((a, b) => {
      if (a.fechaProximaCita === b.fechaProximaCita) return a.codigo.localeCompare(b.codigo)
      if (!a.fechaProximaCita) return 1
      if (!b.fechaProximaCita) return -1
      return a.fechaProximaCita < b.fechaProximaCita ? -1 : 1
    }),
  }))
}

const TEXTO_MOVIMIENTO = {
  'caso:crear': 'Caso registrado',
  'caso:modificar': 'Resultado o cambio del caso',
  'caso:importar': 'Caso importado',
  'visita:crear': 'Visita registrada',
  'aviso:crear': 'Aviso preparado',
  'aviso:modificar': 'Aviso actualizado',
}

// Lo que se guardó en este equipo (bitácora: crear, modificar, importar),
// del más reciente al más antiguo. `enviadosHasta` es el id de bitácora hasta
// el que ya se hizo el envío simulado.
export function movimientosGuardados(bitacora, enviadosHasta = 0) {
  return bitacora
    .filter((b) => b.accion !== 'consultar')
    .map((b) => ({
      id: b.id,
      codigo: b.entidadId,
      fechaHora: b.fechaHora,
      texto: TEXTO_MOVIMIENTO[`${b.entidad}:${b.accion}`] ?? 'Cambio guardado',
      enviado: b.id <= enviadosHasta,
    }))
    .sort((a, b) => (a.fechaHora === b.fechaHora ? b.id - a.id : a.fechaHora < b.fechaHora ? 1 : -1))
}
