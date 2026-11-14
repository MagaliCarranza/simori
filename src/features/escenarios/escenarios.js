// M10 · Escenarios de pérdida (RF11).
//
// Tres escenarios simulados (11 %, 30 %, 50 %) con los casos generados por
// scripts/simular_casos.py. Al cambiar, se vuelve a cargar el dataset del
// escenario elegido y se conservan los casos que haya registrado el usuario
// desde M3 (los códigos del usuario no están en los JSON del escenario).

import { registrar } from '../../db/bitacora.js'
import { db as dbDefault } from '../../db/index.js'
import { cargarEscenario } from '../../db/seed.js'

export const ESCENARIOS = [
  { numero: 11, etiqueta: '11 %', descripcion: 'Pérdida de 11 % en cada paso' },
  { numero: 30, etiqueta: '30 %', descripcion: 'Pérdida de 30 % en cada paso' },
  { numero: 50, etiqueta: '50 %', descripcion: 'Pérdida de 50 % en cada paso' },
]

export const ESCENARIO_DEFAULT = 11

const ruta_casos = (n) => `/data/casos_${n}.json`

export function etiquetaEscenario(numero) {
  const e = ESCENARIOS.find((x) => x.numero === Number(numero))
  return e ? e.etiqueta : `${numero} %`
}

// Fetch del dataset del escenario. Si la red falla y el precache no lo tiene,
// lanza y el llamador muestra el mensaje offline.
async function fetchCasos(numero, fetchImpl) {
  const respuesta = await fetchImpl(ruta_casos(numero))
  if (!respuesta || !respuesta.ok) throw new Error('fetch-escenario')
  return respuesta.json()
}

// Cambia el escenario activo: reemplaza los casos simulados y conserva los
// del usuario (se encarga cargarEscenario). Registra la operación en la
// bitácora. Devuelve el número aplicado.
export async function cambiarEscenario({
  numero,
  usuario = null,
  fetchImpl = fetch,
  db = dbDefault,
} = {}) {
  const destino = Number(numero)
  if (!ESCENARIOS.some((e) => e.numero === destino)) {
    throw new Error(`Escenario no soportado: ${numero}`)
  }

  const entradaAntes = await db.meta.get('escenarioActivo')
  const antes = entradaAntes ? entradaAntes.valor : null

  const datos = await fetchCasos(destino, fetchImpl)
  await cargarEscenario(destino, datos, db)

  await registrar(
    {
      usuarioId: usuario?.id ?? null,
      rol: usuario?.rol ?? null,
      accion: 'modificar',
      entidad: 'escenario',
      entidadId: antes ? `${antes}->${destino}` : String(destino),
    },
    { db },
  )

  return destino
}
