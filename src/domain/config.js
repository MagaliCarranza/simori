// Plazos y umbrales del dominio. Fuente única; se validan con personal de salud.
// Los valores viven en config.json para que Python (scripts/) use la misma fuente.
// Las decisiones y referencias están en ruta-rinon-contexto/docs/preguntas-abiertas.md.

import config from './config.json'

export const UMBRAL_POSITIVO_MGL = config.UMBRAL_POSITIVO_MGL
export const DIAS_CONFIRMACION = config.DIAS_CONFIRMACION
export const VIGILANCIA_MESES = config.VIGILANCIA_MESES

// Semáforo con cita: días de retraso respecto a la fecha de cita.
// Verde: hoy <= cita (0 o negativo). Amarillo: 1..28. Rojo: >=29.
export const SEMAFORO_CON_CITA = config.SEMAFORO_CON_CITA

// Semáforo sin cita: días desde el último evento tipo 'resultado' o, en su
// defecto, desde fechaTamizaje. Verde: 0..14. Amarillo: 15..42. Rojo: >=43.
export const SEMAFORO_SIN_CITA = config.SEMAFORO_SIN_CITA

export const UMBRAL_SIN_SEGUIMIENTO_DIAS = config.UMBRAL_SIN_SEGUIMIENTO_DIAS
export const VISITAS_NO_LOCALIZADAS = config.VISITAS_NO_LOCALIZADAS
export const ENMASCARAR_MENOR_QUE = config.ENMASCARAR_MENOR_QUE

// Pasos entre etapas para la fórmula de referencia de escenarios:
// tamizaje -> confirmacion -> valoracion -> clasificacion.
export const PASOS_ENTRE_ETAPAS = config.PASOS_ENTRE_ETAPAS

// Día supuesto para edad decimal (el modelo solo guarda mes/año).
export const DIA_SUPUESTO_NACIMIENTO = config.DIA_SUPUESTO_NACIMIENTO

// Índice de prioridad (docs/01 reporte-simori, anexo D):
// marginación 40% (CONAPO), distancia a la unidad más cercana 30% (CLUES),
// matrícula por localidad 20% (SEJ/SEP) y % de lengua indígena 10% (Censo).
export const PRIORIDAD_PESOS = config.PRIORIDAD.PESOS
export const PRIORIDAD_UMBRALES = config.PRIORIDAD.UMBRALES
// Umbral para mencionar "lengua indígena" en la razón: por debajo de este
// porcentaje (0..1) el dato es despreciable y no entra al texto.
export const PRIORIDAD_HLI_MIN_PARA_RAZON = config.PRIORIDAD.HLI_MIN_PARA_RAZON
