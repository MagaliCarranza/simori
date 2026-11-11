// Instancia única de Dexie para el resto de la app.

import { crearDb } from './schema.js'

export const db = crearDb()
export { NOMBRE_DB } from './schema.js'
