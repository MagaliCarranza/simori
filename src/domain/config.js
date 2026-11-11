// Plazos y umbrales del dominio. Fuente única; se validan con personal de salud.
// Las decisiones están documentadas en ruta-rinon-contexto/docs/preguntas-abiertas.md.

export const UMBRAL_POSITIVO_MGL = 20
export const DIAS_CONFIRMACION = 84
export const VIGILANCIA_MESES = 6

// Semáforo con cita: días de retraso respecto a la fecha de cita.
// Verde: hoy <= cita (0 o negativo). Amarillo: 1..28. Rojo: >=29.
export const SEMAFORO_CON_CITA = { amarilloDesde: 1, rojoDesde: 29 }

// Semáforo sin cita: días desde el último evento.
// Verde: 0..14. Amarillo: 15..42. Rojo: >=43.
export const SEMAFORO_SIN_CITA = { amarilloDesde: 15, rojoDesde: 43 }

export const UMBRAL_SIN_SEGUIMIENTO_DIAS = 84
export const VISITAS_NO_LOCALIZADAS = 2
export const ENMASCARAR_MENOR_QUE = 5

// Pasos entre etapas para la fórmula de referencia de escenarios:
// tamizaje -> confirmacion -> valoracion -> clasificacion.
export const PASOS_ENTRE_ETAPAS = 3

// Día supuesto para edad decimal (el modelo solo guarda mes/año).
export const DIA_SUPUESTO_NACIMIENTO = 15
