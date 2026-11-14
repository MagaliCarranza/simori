// Roles de la demo con nombres en lenguaje sencillo (pantalla de inicio y
// chip del rol). El orden es el de las tarjetas.
export const ROLES = [
  {
    rol: 'captura',
    nombre: 'Enfermería del centro de salud',
    descripcion: 'Revisa qué niñas y niños tienen citas pendientes o con retraso.',
  },
  {
    rol: 'campo',
    nombre: 'Visitas de campo',
    descripcion: 'Ve a qué familias visitar y prepara el aviso de su cita.',
  },
  {
    rol: 'supervision',
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
