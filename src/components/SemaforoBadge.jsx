import './ui.css'

// Forma distinta por color para que no dependa solo del color (RNF07).
const ICONOS = { verde: '●', amarillo: '▲', rojo: '◆' }

// Recibe el objeto que regresa calcularSemaforo() del dominio.
export function SemaforoBadge({ semaforo }) {
  const color = semaforo.color ?? 'cerrado'
  return (
    <span className={`semaforo semaforo--${color}`}>
      {ICONOS[color] && (
        <span className="semaforo__icono" aria-hidden="true">
          {ICONOS[color]}
        </span>
      )}
      {semaforo.etiqueta}
    </span>
  )
}
