# SIMORI

Prototipo web (PWA) de **registro de seguimiento** para niñas y niños con **tamizaje renal positivo** en Poncitlán, Jalisco. Acompaña cada caso desde el tamizaje hasta su diagnóstico, alta o referencia, marca con un semáforo a quien se atrasa y muestra en qué etapa se detiene.

Proyecto del **Equipo 17 QUESICODE** (ITO, Ing. en Sistemas) para el **Hackathon Jalisco Internacional 2026**, Reto 02 Salud y Bienestar. 

## El problema

En Poncitlán, Jalisco, la Secretaría de Salud publica cuántos escolares tamiza para detectar daño renal, pero no cuántos de los positivos completan su evaluación. Las cifras públicas de distintas instituciones no se conectan entre sí, y un estudio de la Universidad de Guadalajara en Agua Caliente mostró que incluso en un estudio controlado se pierde cerca del **11 %** de los niños entre etapas.

## La propuesta

SIMORI acompaña a cada niño con tamizaje positivo hasta su diagnóstico, alta o referencia. La ruta clínica sigue el **protocolo aplicado por la UdeG en la zona** y se complementa con la **guía internacional KDIGO 2024**. Usamos cinco datasets del catálogo oficial para describir el problema, priorizar tres localidades (**San Pedro Itzicán, Agua Caliente y Chalpicote**) y diseñar la solución; los casos individuales son **simulados** y se presentan en **tres escenarios de pérdida (11 %, 30 %, 50 %)**.

Es un prototipo, **funciona sin internet** después de la primera carga, y podría operar con la **Secretaría de Salud Jalisco** como responsable.

## Alcance y límites

- **Es un prototipo**, no un sistema en producción.
- **Datos simulados** en toda la demo. La UI etiqueta cada dato simulado como tal.
- **No diagnostica.** Registra resultados y organiza el seguimiento; la clasificación la confirma el personal de salud.
- **Privacidad**: los niños se identifican por **código**, nunca por nombre, CURP, domicilio ni fecha de nacimiento completa. Supervisión solo ve cifras agregadas, con la regla "menos de 5" por escuela.
- **Accesibilidad**: el semáforo siempre lleva texto además del color; mobile-first desde 360 px.

## Tecnologías

- **React + Vite** empaquetado como **PWA** con `vite-plugin-pwa` (instalable y offline).
- **IndexedDB** con **Dexie** para capturas locales.
- **Leaflet + OpenStreetMap** para el mapa (mosaicos cacheables).
- **Chart.js** con `react-chartjs-2` para el embudo de supervisión.
- **Vitest** + **Testing Library** para pruebas.
- **Python + pandas** en `scripts/` para preparar datasets y generar casos simulados con semilla fija.
- Sin backend. Despliegue en **Vercel**.

## Requisitos

- **Node.js 20+** y **npm 10+**.
- **Python 3.11+** (solo si vas a correr los scripts de datos).

## Instalación

```bash
git clone https://github.com/MagaliCarranza/ruta-rinon.git
cd ruta-rinon
npm install
```

Para los scripts de Python (opcional, solo si vas a regenerar los datasets):

```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate
pip install -r requirements.txt
```

## Comandos

```bash
npm run dev          # servidor de desarrollo en http://localhost:5173
npm run test         # Vitest, una pasada
npm run test:watch   # Vitest en modo watch
npm run build        # build de producción con PWA en dist/
npm run preview      # sirve dist/ para probar la PWA instalada
npm run lint         # oxlint

python scripts/preparar_datos.py                 # lee data/raw/ y escribe public/data/
python scripts/simular_casos.py --semilla 2026   # genera casos simulados
```

## Estructura del proyecto

```
src/
  domain/        # reglas puras: etapas, semáforo, CKiD U25, KDIGO, validación
  db/            # Dexie: esquema, seed, bitácora
  roles/         # contexto de rol (captura | campo | supervisión)
  features/      # un subdirectorio por módulo (registro, ruta, pendientes,
                 # campo, avisos, supervisión, mapa, escenarios)
  components/    # UI compartida
scripts/         # Python: preparar_datos.py, simular_casos.py
data/raw/        # datasets originales (no se editan a mano)
public/data/     # JSON generados que consume la app
```

La lógica clínica vive en `src/domain/` como **funciones puras** (sin React ni Dexie). Es el corazón del proyecto y está cubierto por Vitest.

## Datos

La app consume **JSON preprocesados** en `public/data/` (sí se versionan). Los **datasets originales** van en `data/raw/` y **no** se versionan por tamaño; cada quien los descarga de la fuente oficial.

### Qué archivos esperar en `data/raw/`

| Archivo | Dataset | Fuente |
|---|---|---|
| `educacion_basica_2024_2025.csv` | Formato 911, estadísticas de inicio del ciclo 2024-2025 (educación básica) | SEP vía [datos.gob.mx](https://datos.gob.mx/) |
| `IML_2020.xls` | Índice de marginación por localidad 2020 | [CONAPO — Índice de marginación por localidad](https://www.gob.mx/conapo) |
| `iter_14_cpv2020/` | ITER del Censo de Población y Vivienda 2020, entidad 14 (Jalisco) | [INEGI — ITER 2020](https://www.inegi.org.mx/programas/ccpv/2020/#datos_abiertos) |
| `catclues.csv` | Catálogo CLUES (unidades médicas) | [Secretaría de Salud — datos.gob.mx](https://datos.gob.mx/busca/dataset/catalogo-clues) |
| `denue_00_62_csv/` | DENUE sector 62 (servicios de salud y asistencia social), 05/2026 | [INEGI — DENUE](https://www.inegi.org.mx/app/descarga/?ti=6) |

El catálogo CLUES **no trae columna de estatus**: se asume que una unidad está operando si aparece también en DENUE 05/2026; si no, se marca con `verificadaDENUE: false` y se le asigna la coordenada de su localidad (`ubicacionAproximada: true`).

### JSON procesados en `public/data/`

Todos los generan los scripts de `scripts/`. Son los únicos que la PWA consume en tiempo real.

| Archivo | Origen | Qué contiene |
|---|---|---|
| `localidades.json` | ITER + CONAPO | **Solo las localidades `enAlcance`** (hoy San Pedro Itzicán, Agua Caliente y Chalpicote) con lat/lng, población 5-14, IM 2020, grado de marginación, % lengua indígena, matrícula, distancia en km a la unidad SSA operativa, `cluesOperativo` y `enAlcance`. Es lo único que la app muestra. |
| `localidades_marco.json` | ITER + CONAPO | Todas las localidades reales del municipio (sin las filas de totales del ITER 0000/9998/9999). **No se muestra en ninguna pantalla**: solo lo usa `calcularPrioridad` para que la normalización min–max del índice tenga un marco amplio. |
| `escuelas.json` | 911 SEP | CCT públicos primaria/secundaria con matrícula de las localidades `enAlcance`; coordenadas aproximadas (de la localidad). |
| `centros_salud.json` | CLUES + DENUE (o fallback a localidad del ITER) | **Solo el CLUES visible** que atiende a las tres localidades (hoy JCSSA004213, Centro de Salud de San Pedro Itzicán). Las demás unidades del municipio quedan en el preparado interno para calcular `distanciaKm`, pero no se publican. |
| `usuarios_demo.json` | Definición del equipo | 1 captura, 1 campo (ambos del centro operativo) y 1 supervisión estatal. |
| `casos_11.json`, `casos_30.json`, `casos_50.json` | `simular_casos.py` | Casos **simulados** para los tres escenarios de pérdida (11 %, 30 %, 50 %). Determinista por semilla. |
| `data/procesado/union_clues_denue.csv` | `georreferenciar_unidades.py` | Trazabilidad de cada CLUES: método (`manual`, `denue`, `unica_loc`, `localidad`, `sin_coords`), clave DENUE, puntaje y confianza. |

**IM_2020 (CONAPO 2020):** un valor más alto significa **menos** marginación. Para interpretar, usar el grado (`GM_2020`).

**Casos simulados:** la app no contiene datos reales de niños. Todo lo que se vea en la demo proviene de `simular_casos.py` con semilla fija y se identifica con `simulado: true` en cada registro.

### Regenerar todo desde cero

```bash
pip install -r requirements.txt                # pandas, openpyxl, xlrd, pytest
python scripts/preparar_datos.py               # catálogos -> public/data/
python scripts/simular_casos.py --semilla 2026 # casos_{11,30,50}.json
```

## Extender a otros municipios

El alcance operativo del prototipo vive en `scripts/alcance.json`:

```json
{
  "entidad": 14,
  "municipio": 66,
  "enAlcance": ["0002", "0031", "0043"],
  "normalizarContra": "municipio"
}
```

Para extender a otro municipio (o más localidades):

1. Edita `scripts/alcance.json` con `entidad`, `municipio` y las claves de `enAlcance` (4 dígitos). `normalizarContra: "municipio"` indica que las variables continuas del índice de prioridad se normalizan contra todas las localidades del municipio.
2. Si cambias de estado, descarga el **ITER** del Censo 2020 de la nueva entidad y colócalo en `data/raw/`. Los demás datasets (911, CONAPO, CLUES, DENUE) son **nacionales** y los mismos.
3. Corre `python scripts/preparar_datos.py`. El script leerá CLUES y DENUE del municipio indicado y georreferenciará cada unidad.
4. **Revisa `data/procesado/union_clues_denue.csv`.** Cualquier fila con método `localidad` o `sin_coords` quiere decir que no se pudo unir con DENUE: si conseguiste la coordenada por GPS en campo, agrégala a `data/manual/georreferencia_manual.csv` (`clues,lat,lng,fuente,fecha`) y vuelve a correr `preparar_datos.py`. El override manual gana sobre la unión automática.
5. Corre `python scripts/simular_casos.py --semilla 2026` para regenerar los casos.

## Flujo de trabajo

- Las ramas se nombran con prefijo: `feat/*`, `fix/*`, `doc/*`, `refactor/*`.
- Todo cambio entra a `dev` por **pull request**.
- `main` se actualiza únicamente con PR desde `dev` al cierre del hackathon.

## Fuentes y referencias

- Protocolo UdeG en Agua Caliente: Lozano-Kasten et al. (2017).
- KDIGO 2024 Clinical Practice Guideline on Evaluation and Management of CKD.
- Ecuación **CKiD U25** (solo creatinina): NIDDK, *eGFR Equations for Children, Adolescents, & Young Adults* (Pierce et al., 2021).
- Datasets del **catálogo de datos abiertos** del estado de Jalisco.
- Catálogo CLUES — Secretaría de Salud, publicado en [datos.gob.mx](https://datos.gob.mx/busca/dataset/catalogo-clues).
- DENUE — INEGI, actualización 05/2026.

## Equipo

**Equipo 17 QUESICODE** — Instituto Tecnológico de Oaxaca, Ingeniería en Sistemas Computacionales. Hackathon Jalisco Internacional 2026, Reto 02 Salud y Bienestar.
