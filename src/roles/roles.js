// Roles de la demo con nombres en lenguaje sencillo (pantalla de inicio y
// chip del rol). El orden es el de las tarjetas. `etiqueta` y `pie` son
// textos cortos de apoyo en la tarjeta; el título siempre es `nombre`.
export const ROLES = [
  {
    rol: 'captura',
    etiqueta: 'Clínica',
    pie: 'Pendientes y citas',
    nombre: 'Enfermería del centro de salud',
    descripcion: 'Revisa qué niñas y niños tienen citas pendientes o con retraso.',
  },
  {
    rol: 'campo',
    etiqueta: 'Brigada',
    pie: 'Visitas comunitarias',
    nombre: 'Visitas de campo',
    descripcion: 'Ve a qué familias visitar y prepara el aviso de su cita.',
  },
  {
    rol: 'supervision',
    etiqueta: 'Gestión',
    pie: 'Cifras agregadas',
    nombre: 'Supervisión',
    descripcion: 'Consulta cifras de la zona en el embudo y el mapa, sin datos de cada caso.',
  },
]

export const NOMBRE_ROL = Object.fromEntries(ROLES.map((r) => [r.rol, r.nombre]))

const CLAVE = 'simori.rol'

// El rol elegido se recuerda en este navegador. Si el almacenamiento no está
// disponible (modo privado, bloqueado), la app funciona igual sin recordarlo.
export function leerRolGuardado(storage = globalThis.localStorage) {
  try {
    const rol = storage?.getItem(CLAVE) ?? null
    return rol && NOMBRE_ROL[rol] ? rol : null
  } catch {
    return null
  }
}

export function guardarRol(rol, storage = globalThis.localStorage) {
  try {
    storage?.setItem(CLAVE, rol)
  } catch {
    // Sin almacenamiento: no se recuerda, pero la app sigue.
  }
}
