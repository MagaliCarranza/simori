// Esquema de la base local (IndexedDB vía Dexie). Es la única PII permitida:
// códigos de caso y niño, sin nombre, CURP, domicilio ni fecha completa.
//
// Tabla `meta`: pares clave/valor para estado global del seed
// (p. ej. { clave: 'escenarioActivo', valor: '11' }).

import Dexie from 'dexie'

export const NOMBRE_DB = 'rutaRinon'

export function crearDb(nombre = NOMBRE_DB) {
  const db = new Dexie(nombre)
  db.version(1).stores({
    localidades: 'claveInegi, nombre, gradoMarginacion',
    escuelas: 'cct, claveInegi, nombre, nivel',
    centrosSalud: 'clues, claveInegi, nombre',
    usuarios: 'id, rol, clues',
    ninos: 'codigo, sexo',
    casos: 'codigo, codigoNino, cct, clues, etapaActual, estado, fechaProximaCita, fechaTamizaje',
    eventos: '++id, codigoCaso, etapa, fecha, tipo',
    avisos: '++id, codigoCaso, estado, fecha',
    bitacora: '++id, fechaHora, entidad, usuarioId, accion',
    meta: 'clave',
  })
  return db
}
