// Pantalla de inicio (vista "Bienvenida" de UI-SIMORI): qué es SIMORI y elección
// del rol. Al elegir, App fija el usuario de ese rol y abre su primera pantalla.
// Todo es local (logo, portada, fuentes y estilos van en el precaché de la PWA).

import { IconoBarras, IconoEscudo, IconoFlecha, IconoPortapapeles, IconoSinConexion, IconoUbicacion } from '../../components/iconos.jsx'
import { LogoSimbolo } from '../../components/Logo.jsx'
import imagenInicio from '../../assets/inicio-simori.jpg'
import { ROLES } from '../../roles/roles.js'
import './inicio.css'

const ICONO_ROL = { captura: IconoPortapapeles, campo: IconoUbicacion, supervision: IconoBarras }

export function InicioPage({ rolActual, onElegir }) {
  return (
    <section className="inicio" aria-labelledby="titulo-inicio">
      <div className="inicio__marca">
        <LogoSimbolo tamano={56} />
        <div>
          <p className="inicio__nombre">SIMORI</p>
          <p className="inicio__lema">Tamizaje y seguimiento infantil · Poncitlán, Jalisco</p>
        </div>
      </div>

      <article className="inicio__portada">
        {/* Portada: personal de salud usando SIMORI frente a una clínica, con una familia. */}
        <figure className="inicio__figura">
          <img className="inicio__ilustracion" src={imagenInicio} width="1280" height="714" alt="" />
          <figcaption className="inicio__pie-imagen">
            <span>
              <span className="inicio__punto" aria-hidden="true" /> Comunidad y centro de salud
            </span>
            <span className="inicio__pie-lugar">Poncitlán, Jal.</span>
          </figcaption>
        </figure>

        <div className="inicio__presentacion">
          <p className="inicio__antetitulo">
            <span className="inicio__punto" aria-hidden="true" /> Tamizaje y seguimiento renal
          </p>
          <h2 id="titulo-inicio" className="inicio__titulo">
            Que ninguna niña ni niño se quede <span className="inicio__resaltado">a medio camino</span>
          </h2>
          <p className="inicio__texto">
            Registro de seguimiento desde el tamizaje hasta el diagnóstico, alta o referencia. Organiza el seguimiento;
            no diagnostica.
          </p>
          <ul className="inicio__pildoras">
            <li>
              <IconoEscudo /> Identificación anónima con código
            </li>
            <li>
              <IconoSinConexion /> Funciona sin conexión
            </li>
          </ul>
        </div>
      </article>

      <div className="inicio__roles-encabezado">
        <h3 className="inicio__pregunta">Elige tu rol para comenzar</h3>
        <span className="inicio__conteo">{ROLES.length} roles</span>
      </div>

      <ul className="inicio__roles">
        {ROLES.map((r) => {
          const actual = r.rol === rolActual
          const Icono = ICONO_ROL[r.rol]
          return (
            <li key={r.rol}>
              <article className={`inicio__rol inicio__rol--${r.rol}${actual ? ' inicio__rol--actual' : ''}`}>
                <div className="inicio__rol-cabeza">
                  <span className="inicio__rol-icono" aria-hidden="true">
                    {Icono && <Icono />}
                  </span>
                  <span className="inicio__rol-etiqueta">{r.etiqueta}</span>
                </div>
                <h4 className="inicio__rol-nombre">{r.nombre}</h4>
                <p className="inicio__rol-texto">{r.descripcion}</p>
                {actual && <span className="inicio__rol-marca">Rol actual</span>}
                <div className="inicio__rol-pie">
                  <span className="inicio__rol-detalle">{r.pie}</span>
                  <button
                    type="button"
                    className="inicio__entrar"
                    aria-label={`Entrar como ${r.nombre}`}
                    onClick={() => onElegir(r.rol)}
                  >
                    Entrar
                    <span className="inicio__entrar-flecha" aria-hidden="true">
                      <IconoFlecha />
                    </span>
                  </button>
                </div>
              </article>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
