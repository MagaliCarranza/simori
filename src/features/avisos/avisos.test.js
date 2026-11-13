import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearDb } from '../../db/schema.js'
import { avisosDelCaso, crearAviso, marcarEntregado } from './avisos.js'
import { construirAviso, fechaLarga, motivoCita } from './mensaje.js'

const HOY = '2026-11-14'
const centro = { clues: 'PROV-AC-01', nombre: 'Centro de Salud Agua Caliente' }
const usuario = { id: 'USR-CAM-AC', rol: 'campo', clues: 'PROV-AC-01' }

const fila = (extra = {}) => ({
  codigo: 'PON-AC-0001',
  siguientePaso: 'Confirmación',
  fechaProximaCita: '2026-11-20',
  ...extra,
})

describe('fechaLarga', () => {
  it('escribe la fecha completa en español', () => {
    expect(fechaLarga('2026-11-20')).toBe('viernes 20 de noviembre de 2026')
    expect(fechaLarga('2027-02-28')).toBe('domingo 28 de febrero de 2027')
  })
})

describe('motivoCita', () => {
  it('explica qué se hará en la cita según la etapa', () => {
    expect(motivoCita('Confirmación')).toBe('repetir la prueba de orina')
    expect(motivoCita('Valoración')).toMatch(/análisis de sangre/)
    expect(motivoCita('Revisión periódica')).toBe('su revisión de seguimiento')
    expect(motivoCita('Otra')).toBe('continuar su seguimiento')
  })
})

describe('construirAviso', () => {
  it('con cita futura incluye fecha, lugar y motivo', () => {
    const a = construirAviso({ fila: fila(), centro, hoyISO: HOY })
    expect(a.fechaCita).toBe('2026-11-20')
    expect(a.lugarCita).toBe('Centro de Salud Agua Caliente')
    expect(a.texto).toContain('Su cita es el viernes 20 de noviembre de 2026 en Centro de Salud Agua Caliente.')
    expect(a.texto).toContain('tiene pendiente repetir la prueba de orina')
    expect(a.texto).toContain('PON-AC-0001')
  })

  it('explica por qué ir aunque se vea sano', () => {
    const a = construirAviso({ fila: fila(), centro, hoyISO: HOY })
    expect(a.texto).toMatch(/Aunque su niña o niño se vea sano, es importante ir/)
  })

  it('si la cita ya pasó o no hay cita, pide acudir a acordar fecha', () => {
    for (const fechaProximaCita of ['2026-10-01', null]) {
      const a = construirAviso({ fila: fila({ fechaProximaCita }), centro, hoyISO: HOY })
      expect(a.fechaCita).toBeNull()
      expect(a.texto).toContain('Por favor acérquese a Centro de Salud Agua Caliente para acordar la fecha de su cita.')
    }
  })

  it('una cita de hoy sigue vigente', () => {
    expect(construirAviso({ fila: fila({ fechaProximaCita: HOY }), centro, hoyISO: HOY }).fechaCita).toBe(HOY)
  })

  it('no usa palabras de diagnóstico', () => {
    const a = construirAviso({ fila: fila({ siguientePaso: 'Clasificación' }), centro, hoyISO: HOY })
    expect(a.texto).not.toMatch(/enfermedad|diagn|insuficiencia|daño|grave|urgente|ERC|riñón/i)
  })

  it('el audio no lee el código del caso', () => {
    const a = construirAviso({ fila: fila(), centro, hoyISO: HOY })
    expect(a.textoAudio).not.toContain('PON-AC-0001')
    expect(a.textoAudio).toContain('Su cita es el viernes 20 de noviembre de 2026')
  })
})

describe('crearAviso / marcarEntregado', () => {
  let db
  let n = 0

  beforeEach(() => {
    db = crearDb(`test-avisos-${n++}`)
  })

  afterEach(async () => {
    await db.delete()
  })

  const aviso = () => construirAviso({ fila: fila(), centro, hoyISO: HOY })

  it('guarda el aviso pendiente con el esquema de docs/02 y bitácora', async () => {
    const nuevo = await crearAviso({ aviso: aviso(), canal: 'mensaje', usuario, hoyISO: HOY }, db)
    expect(await db.avisos.get(nuevo.id)).toMatchObject({
      codigoCaso: 'PON-AC-0001',
      usuarioId: 'USR-CAM-AC',
      fecha: HOY,
      canal: 'mensaje',
      fechaCita: '2026-11-20',
      lugarCita: 'Centro de Salud Agua Caliente',
      estado: 'pendiente',
      simulado: true,
    })
    expect(await db.bitacora.toArray()).toEqual([
      expect.objectContaining({ accion: 'crear', entidad: 'aviso', entidadId: 'PON-AC-0001', rol: 'campo' }),
    ])
  })

  it('rechaza canales que no existen', async () => {
    await expect(crearAviso({ aviso: aviso(), canal: 'correo', usuario, hoyISO: HOY }, db)).rejects.toThrow()
  })

  it('marca como entregado una sola vez', async () => {
    const { id } = await crearAviso({ aviso: aviso(), canal: 'recado', usuario, hoyISO: HOY }, db)
    await marcarEntregado({ id, usuario }, db)
    await marcarEntregado({ id, usuario }, db)
    expect((await db.avisos.get(id)).estado).toBe('entregado')
    expect(await db.bitacora.where('accion').equals('modificar').count()).toBe(1)
  })

  it('lista los avisos del caso, el más reciente primero', async () => {
    const a = await crearAviso({ aviso: aviso(), canal: 'mensaje', usuario, hoyISO: '2026-11-10' }, db)
    const b = await crearAviso({ aviso: aviso(), canal: 'visita', usuario, hoyISO: HOY }, db)
    const lista = await avisosDelCaso('PON-AC-0001', db)
    expect(lista.map((x) => x.id)).toEqual([b.id, a.id])
  })
})
