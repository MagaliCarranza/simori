import { EtiquetaSimulado } from './EtiquetaSimulado.jsx'
import './enConstruccion.css'

// Pantalla placeholder para rutas aún no implementadas. Da aviso claro al
// usuario de usabilidad: la navegación lo lleva aquí a propósito.
export function EnConstruccion({ titulo, descripcion }) {
  return (
    <section className="en-construccion" aria-labelledby="titulo-ec">
      <header className="en-construccion__encabezado">
        <h2 id="titulo-ec">{titulo}</h2>
        <EtiquetaSimulado />
      </header>
      <p className="en-construccion__aviso">En construcción</p>
      {descripcion && <p className="en-construccion__descripcion">{descripcion}</p>}
    </section>
  )
}
