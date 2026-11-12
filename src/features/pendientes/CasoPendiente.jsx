import { SemaforoBadge } from '../../components/SemaforoBadge.jsx'
import { formatearFecha } from './formato.js'

// Tarjeta de un caso en las listas de pendientes. Solo código y datos de
// seguimiento: nunca resultados clínicos (sirve también para el rol campo).
export function CasoPendiente({ fila, escuela }) {
  return (
    <li className="caso-pendiente">
      <div className="caso-pendiente__fila">
        <span className="caso-pendiente__codigo">{fila.codigo}</span>
        <SemaforoBadge semaforo={fila.semaforo} />
      </div>
      <dl className="caso-pendiente__detalle">
        <div>
          <dt>Sigue:</dt>
          <dd>{fila.siguientePaso}</dd>
        </div>
        <div>
          <dt>Cita:</dt>
          <dd>{fila.sinCita ? 'Sin cita agendada' : formatearFecha(fila.fechaProximaCita)}</dd>
        </div>
        <div>
          <dt>Escuela:</dt>
          <dd>{escuela ? escuela.nombre : fila.cct}</dd>
        </div>
        <div>
          <dt>Visitas sin localizar:</dt>
          <dd>
            {fila.visitasNoLocalizadas} de {fila.visitasNecesarias}
          </dd>
        </div>
        {fila.ultimaVisita && (
          <div>
            <dt>Última visita:</dt>
            <dd>{formatearFecha(fila.ultimaVisita.fecha)}</dd>
          </div>
        )}
      </dl>
      {fila.sinSeguimiento && (
        <div>
          <span className="insignia-sin-seguimiento">Sin seguimiento</span>
        </div>
      )}
    </li>
  )
}
