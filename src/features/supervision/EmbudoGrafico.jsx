import { BarElement, CategoryScale, Chart as ChartJS, LinearScale } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { COLORES } from '../../components/colores.js'

ChartJS.register(BarElement, CategoryScale, LinearScale)

const texto = (n) => (typeof n === 'number' ? `${n} casos` : n)

// Embudo por etapa (RF08). Las cifras enmascaradas no se dibujan (barra vacía)
// para no sugerir su tamaño; el texto de cada etapa está en la lista accesible.
export function EmbudoGrafico({ embudo }) {
  const data = {
    // En el eje solo el nombre corto de la etapa; los números están en la lista.
    labels: embudo.map((e) => e.titulo),
    datasets: [
      {
        data: embudo.map((e) => (typeof e.n === 'number' ? e.n : null)),
        backgroundColor: COLORES.principal,
        borderRadius: 6,
        maxBarThickness: 36,
      },
    ],
  }
  const options = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { beginAtZero: true, ticks: { precision: 0 } },
      y: { ticks: { autoSkip: false } },
    },
  }

  return (
    <figure className="embudo">
      <div className="embudo__lienzo" aria-hidden="true">
        <Bar data={data} options={options} />
      </div>
      <figcaption className="sr-solo">Casos que llegaron a cada etapa</figcaption>
      <ol className="embudo__lista">
        {embudo.map((e) => (
          <li key={e.etapa}>
            <span>
              {e.etapa}. {e.titulo}
            </span>
            <strong>{texto(e.n)}</strong>
          </li>
        ))}
      </ol>
    </figure>
  )
}
