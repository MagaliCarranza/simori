import { describe, expect, it } from 'vitest'
import {
  DIAS_CONFIRMACION,
  DIA_SUPUESTO_NACIMIENTO,
  ENMASCARAR_MENOR_QUE,
  PASOS_ENTRE_ETAPAS,
  SEMAFORO_CON_CITA,
  SEMAFORO_SIN_CITA,
  UMBRAL_POSITIVO_MGL,
  UMBRAL_SIN_SEGUIMIENTO_DIAS,
  VIGILANCIA_MESES,
  VISITAS_NO_LOCALIZADAS,
} from './config.js'

describe('config', () => {
  it('conserva los valores decididos con el equipo', () => {
    expect(UMBRAL_POSITIVO_MGL).toBe(20)
    expect(DIAS_CONFIRMACION).toBe(84)
    expect(VIGILANCIA_MESES).toBe(6)
    expect(UMBRAL_SIN_SEGUIMIENTO_DIAS).toBe(84)
    expect(VISITAS_NO_LOCALIZADAS).toBe(2)
    expect(ENMASCARAR_MENOR_QUE).toBe(5)
    expect(PASOS_ENTRE_ETAPAS).toBe(3)
    expect(DIA_SUPUESTO_NACIMIENTO).toBe(15)
  })

  it('tiene cortes de semáforo coherentes', () => {
    expect(SEMAFORO_CON_CITA).toEqual({ amarilloDesde: 1, rojoDesde: 29 })
    expect(SEMAFORO_SIN_CITA).toEqual({ amarilloDesde: 15, rojoDesde: 43 })
  })
})
