import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearDb } from '../../db/schema.js'
import { NOTA_MAX, registrarVisita, validarVisita, visitasDelCaso } from './visitas.js'

const HOY = '2026-11-14'
const usuario = { id: 'USR-CAM-AC', rol: 'campo', clues: 'PROV-AC-01' }

let db
let n = 0

function caso(codigo, extra = {}) {
  return {
    codigo,
    codigoNino: codigo.replace('PON', 'NIN'),
    cct: '14DPR1710G',
    clues: 'PROV-AC-01',
    fechaTamizaje: '2026-01-10',
    etapaActual: 1,
    estado: 'en_seguimiento',
    fechaProximaCita: null,
    simulado: true,
    ...extra,
  }
}

beforeEach(async () => {
  db = crearDb(`test-visitas-${n++}`)
  await db.casos.bulkAdd([
    caso('PON-AC-0001', { fechaProximaCita: '2026-10-01' }), // rojo, 44 días
    caso('PON-AC-0002', { fechaProximaCita: '2026-11-04', etapaActual: 2 }), // amarillo, 10 días
  ])
})

afterEach(async () => {
  await db.delete()
})

describe('validarVisita', () => {
  it('acepta una visita completa', () => {
    expect(validarVisita({ visitaResultado: 'localizada', fecha: HOY, nota: 'Se dejó recado' }, HOY)).toEqual({
      valido: true,
      errores: [],
    })
  })

  it('pide el resultado', () => {
    expect(validarVisita({ fecha: HOY }, HOY).valido).toBe(false)
    expect(validarVisita({ visitaResultado: 'visitada', fecha: HOY }, HOY).valido).toBe(false)
  })

  it('rechaza fechas inválidas o futuras', () => {
    expect(validarVisita({ visitaResultado: 'localizada', fecha: '2026-02-30' }, HOY).valido).toBe(false)
    expect(validarVisita({ visitaResultado: 'localizada', fecha: '14/11/2026' }, HOY).valido).toBe(false)
    expect(validarVisita({ visitaResultado: 'localizada', fecha: '2026-11-15' }, HOY).errores).toEqual([
      'La fecha de la visita no puede ser futura.',
    ])
  })

  it('limita el largo de la nota', () => {
    const nota = 'a'.repeat(NOTA_MAX + 1)
    expect(validarVisita({ visitaResultado: 'localizada', fecha: HOY, nota }, HOY).valido).toBe(false)
  })
})

describe('registrarVisita', () => {
  it('guarda el evento de visita con la etapa del caso y deja bitácora', async () => {
    const res = await registrarVisita(
      { codigoCaso: 'PON-AC-0002', visitaResultado: 'localizada', fecha: HOY, nota: '  Irán el lunes  ', usuario, hoyISO: HOY },
      db,
    )
    expect(res.ok).toBe(true)
    expect(res.pasoASinSeguimiento).toBe(false)

    const [ev] = await db.eventos.toArray()
    expect(ev).toMatchObject({
      codigoCaso: 'PON-AC-0002',
      usuarioId: 'USR-CAM-AC',
      etapa: 2,
      fecha: HOY,
      tipo: 'visita',
      visitaResultado: 'localizada',
      nota: 'Irán el lunes',
    })
    const [b] = await db.bitacora.toArray()
    expect(b).toMatchObject({ usuarioId: 'USR-CAM-AC', rol: 'campo', accion: 'crear', entidad: 'visita', entidadId: 'PON-AC-0002' })
  })

  it('no guarda nada si la visita no es válida', async () => {
    const res = await registrarVisita(
      { codigoCaso: 'PON-AC-0002', visitaResultado: 'localizada', fecha: '2026-12-01', usuario, hoyISO: HOY },
      db,
    )
    expect(res.ok).toBe(false)
    expect(await db.eventos.count()).toBe(0)
    expect(await db.bitacora.count()).toBe(0)
  })

  it('un caso que no existe regresa error', async () => {
    const res = await registrarVisita(
      { codigoCaso: 'PON-AC-9999', visitaResultado: 'localizada', fecha: HOY, usuario, hoyISO: HOY },
      db,
    )
    expect(res).toMatchObject({ ok: false, errores: ['No se encontró el caso.'] })
  })

  it('rojo + segunda visita sin localizar → pasa a sin seguimiento', async () => {
    const datos = { codigoCaso: 'PON-AC-0001', visitaResultado: 'no_localizada', usuario, hoyISO: HOY }
    const primera = await registrarVisita({ ...datos, fecha: '2026-11-01' }, db)
    expect(primera.pasoASinSeguimiento).toBe(false)
    expect((await db.casos.get('PON-AC-0001')).estado).toBe('en_seguimiento')

    const segunda = await registrarVisita({ ...datos, fecha: HOY }, db)
    expect(segunda.pasoASinSeguimiento).toBe(true)
    expect((await db.casos.get('PON-AC-0001')).estado).toBe('sin_seguimiento')
  })

  it('amarillo con 2 visitas sin localizar todavía no pasa', async () => {
    const datos = { codigoCaso: 'PON-AC-0002', visitaResultado: 'no_localizada', usuario, hoyISO: HOY }
    await registrarVisita({ ...datos, fecha: '2026-11-10' }, db)
    const segunda = await registrarVisita({ ...datos, fecha: HOY }, db)
    expect(segunda.pasoASinSeguimiento).toBe(false)
  })

  it('una visita localizada no reactiva un caso sin seguimiento', async () => {
    await db.casos.update('PON-AC-0001', { estado: 'sin_seguimiento' })
    await registrarVisita(
      { codigoCaso: 'PON-AC-0001', visitaResultado: 'localizada', fecha: HOY, usuario, hoyISO: HOY },
      db,
    )
    expect((await db.casos.get('PON-AC-0001')).estado).toBe('sin_seguimiento')
  })
})

describe('visitasDelCaso', () => {
  it('regresa solo las visitas, en orden de fecha', async () => {
    await db.eventos.add({ codigoCaso: 'PON-AC-0001', tipo: 'resultado', etapa: 1, fecha: '2026-01-10' })
    const datos = { codigoCaso: 'PON-AC-0001', usuario, hoyISO: HOY }
    await registrarVisita({ ...datos, visitaResultado: 'localizada', fecha: HOY }, db)
    await registrarVisita({ ...datos, visitaResultado: 'no_localizada', fecha: '2026-11-01' }, db)

    const visitas = await visitasDelCaso('PON-AC-0001', db)
    expect(visitas.map((v) => [v.fecha, v.visitaResultado])).toEqual([
      ['2026-11-01', 'no_localizada'],
      [HOY, 'localizada'],
    ])
  })
})
