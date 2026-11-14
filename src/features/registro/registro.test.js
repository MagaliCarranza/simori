import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearDb } from '../../db/schema.js'
import {
  codigosPara,
  construirRegistro,
  registrarCaso,
  siguienteNumero,
  validarFormulario,
} from './registro.js'

const HOY = '2026-11-14'
const captura = { id: 'USR-CAP-01', rol: 'captura', clues: 'JCSSA004213' }

const formValido = {
  cct: '14DPR1710G',
  fechaTamizaje: '2026-11-10',
  tiraMgL: 50,
  sexo: 'F',
  mesNacimiento: '4',
  anioNacimiento: '2016',
  consentimientoTutor: true,
  asentimientoNino: true,
}

describe('siguienteNumero y codigosPara', () => {
  it('toma el máximo de casos y niños de la misma localidad', () => {
    const existentes = ['PON-AC-0001', 'PON-AC-0007', 'NIN-AC-0009', 'PON-SPI-0050']
    expect(siguienteNumero(existentes, 'AC')).toBe(10)
    expect(siguienteNumero(existentes, 'SPI')).toBe(51)
    expect(siguienteNumero(existentes, 'CHA')).toBe(1)
  })

  it('arma códigos con 4 dígitos y el mismo número para caso y niño', () => {
    expect(codigosPara('CHA', 7)).toEqual({ codigoCaso: 'PON-CHA-0007', codigoNino: 'NIN-CHA-0007' })
  })
})

describe('validarFormulario', () => {
  it('acepta un formulario completo', () => {
    expect(validarFormulario(formValido, HOY)).toEqual({ valido: true, errores: [] })
  })

  it('rechaza una tira negativa (0 mg/L)', () => {
    const r = validarFormulario({ ...formValido, tiraMgL: 0 }, HOY)
    expect(r.valido).toBe(false)
    expect(r.errores[0]).toMatch(/Solo se registran tamizajes positivos/)
  })

  it('pide sexo, mes y un año de nacimiento razonable', () => {
    const r = validarFormulario({ ...formValido, sexo: '', mesNacimiento: '', anioNacimiento: '2025' }, HOY)
    expect(r.errores).toEqual([
      'Elige si es niña o niño.',
      'Elige el mes de nacimiento.',
      'El año de nacimiento debe estar entre 2009 y 2023.',
    ])
  })
})

describe('construirRegistro', () => {
  it('crea el caso en etapa 1 con cita de confirmación a 12 semanas', () => {
    const { nino, caso, evento } = construirRegistro(formValido, {
      usuario: captura,
      codigoCaso: 'PON-AC-0001',
      codigoNino: 'NIN-AC-0001',
    })
    expect(nino).toEqual({ codigo: 'NIN-AC-0001', sexo: 'F', mesNacimiento: 4, anioNacimiento: 2016 })
    expect(caso).toMatchObject({
      codigo: 'PON-AC-0001',
      clues: 'JCSSA004213',
      etapaActual: 1,
      estado: 'en_seguimiento',
      fechaProximaCita: '2027-02-02', // 84 días después del 2026-11-10
      simulado: true,
    })
    expect(evento).toEqual({
      codigoCaso: 'PON-AC-0001',
      usuarioId: 'USR-CAP-01',
      etapa: 1,
      fecha: '2026-11-10',
      tipo: 'resultado',
      tiraMgL: 50,
    })
  })

  it('no guarda datos sensibles aunque vengan en el formulario', () => {
    const { nino, caso } = construirRegistro(
      { ...formValido, nombre: 'X', curp: 'Y', domicilio: 'Z' },
      { usuario: captura, codigoCaso: 'PON-AC-0001', codigoNino: 'NIN-AC-0001' },
    )
    for (const campo of ['nombre', 'curp', 'domicilio', 'fechaNacimiento']) {
      expect(nino).not.toHaveProperty(campo)
      expect(caso).not.toHaveProperty(campo)
    }
  })
})

describe('registrarCaso (con base local)', () => {
  let db
  let n = 0

  beforeEach(async () => {
    db = crearDb(`test-registro-${n++}`)
    await db.escuelas.add({ cct: '14DPR1710G', nombre: 'Emiliano Zapata', claveInegi: '140660002' })
    await db.centrosSalud.add({ clues: 'JCSSA004213', nombre: 'CS San Pedro Itzicán', claveInegi: '140660031' })
    await db.casos.add({ codigo: 'PON-AC-0041', codigoNino: 'NIN-AC-0041', cct: '14DPR1710G' })
  })

  afterEach(async () => {
    await db.delete()
  })

  it('guarda niño, caso, evento y bitácora con el siguiente código', async () => {
    const res = await registrarCaso({ form: formValido, usuario: captura, hoyISO: HOY }, db)
    expect(res.ok).toBe(true)
    expect(res.caso.codigo).toBe('PON-AC-0042')
    expect(await db.ninos.get('NIN-AC-0042')).toBeTruthy()
    expect(await db.eventos.where('codigoCaso').equals('PON-AC-0042').count()).toBe(1)
    const [b] = await db.bitacora.toArray()
    expect(b).toMatchObject({ accion: 'crear', entidad: 'caso', entidadId: 'PON-AC-0042', usuarioId: 'USR-CAP-01' })
  })

  it('no guarda nada si falta el consentimiento', async () => {
    const res = await registrarCaso(
      { form: { ...formValido, consentimientoTutor: false }, usuario: captura, hoyISO: HOY },
      db,
    )
    expect(res.ok).toBe(false)
    expect(res.errores).toContain('Falta el consentimiento del tutor')
    expect(await db.casos.count()).toBe(1)
    expect(await db.bitacora.count()).toBe(0)
  })

  it('rechaza una fecha de tamizaje futura y una escuela fuera del catálogo', async () => {
    const res = await registrarCaso(
      { form: { ...formValido, fechaTamizaje: '2026-12-01', cct: '14DPR9999Z' }, usuario: captura, hoyISO: HOY },
      db,
    )
    expect(res.errores).toEqual(
      expect.arrayContaining(['La CCT no está en el catálogo de escuelas', 'La fecha de tamizaje no puede ser futura']),
    )
  })
})
