// Selector de escenario de pérdida en el encabezado global (todos los roles).
// Muestra el escenario activo con la marca "Datos simulados". Al cambiar,
// abre un modal de confirmación dentro de la app.

import { useId, useState } from 'react'
import { cambiarEscenario, ESCENARIOS } from './escenarios.js'
import { ConfirmarCambio } from './ConfirmarCambio.jsx'
import { useEscenarioActivo } from './useEscenarioActivo.js'
import './escenarios.css'

export function SelectorEscenario({ usuario, db, fetchImpl }) {
  const id = useId()
  const activo = useEscenarioActivo(db)
  const [pendiente, setPendiente] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(false)

  const alCambiar = (e) => {
    const destino = Number(e.target.value)
    if (!destino || destino === activo) return
    setError(false)
    setPendiente(destino)
  }

  const cancelar = () => {
    setPendiente(null)
    setError(false)
  }

  const confirmar = async () => {
    if (!pendiente) return
    setCargando(true)
    setError(false)
    try {
      await cambiarEscenario({ numero: pendiente, usuario, fetchImpl, db })
      setPendiente(null)
    } catch {
      setError(true)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="escenario-selector">
      <label className="escenario-selector__etiqueta" htmlFor={`${id}-sel`}>
        Escenario simulado
      </label>
      <select
        id={`${id}-sel`}
        className="escenario-selector__select"
        value={activo ?? ''}
        onChange={alCambiar}
        aria-describedby={`${id}-marca`}
      >
        {!activo && <option value="">Cargando…</option>}
        {ESCENARIOS.map((e) => (
          <option key={e.numero} value={e.numero}>
            {e.etiqueta} de pérdida
          </option>
        ))}
      </select>
      <span id={`${id}-marca`} className="etiqueta-simulado">
        Datos simulados
      </span>

      <ConfirmarCambio
        abierto={pendiente != null}
        destino={pendiente}
        cargando={cargando}
        error={error}
        onConfirmar={confirmar}
        onCancelar={cancelar}
      />
    </div>
  )
}
