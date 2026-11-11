// CKiD U25 (solo creatinina). KDIGO 2024 (pediátrica).
// Fórmula: TFGe = k × (talla_m / creatinina_mg_dL), con talla en metros y edad decimal.

// Devuelve el coeficiente k según sexo ('M' | 'F') y edad decimal en años.
function coeficienteK(sexo, edadAnios) {
  if (edadAnios >= 18) {
    return sexo === 'M' ? 50.8 : 41.4
  }
  const base = sexo === 'M' ? 39.0 : 36.1
  if (edadAnios >= 12) {
    const exp = sexo === 'M' ? 1.045 : 1.023
    return base * Math.pow(exp, edadAnios - 12)
  }
  // 1 ≤ edad < 12
  return base * Math.pow(1.008, edadAnios - 12)
}

export function tfgeCKiDU25({ sexo, edadAnios, tallaCm, creatininaMgDl }) {
  const tallaMetros = tallaCm / 100
  const k = coeficienteK(sexo, edadAnios)
  return k * (tallaMetros / creatininaMgDl)
}

// Devuelve { categoria, baja }. `baja` es texto informativo (no diagnóstico):
// en edad > 2 años, TFGe < 90 se marca como "baja".
export function clasificarTFG(tfge, edadAnios) {
  let categoria
  if (tfge >= 90) categoria = 'G1'
  else if (tfge >= 60) categoria = 'G2'
  else if (tfge >= 45) categoria = 'G3a'
  else if (tfge >= 30) categoria = 'G3b'
  else if (tfge >= 15) categoria = 'G4'
  else categoria = 'G5'
  return { categoria, baja: edadAnios > 2 && tfge < 90 }
}

// Cociente albúmina/creatinina en mg/g.
export function categoriaA(cocienteMgG) {
  if (cocienteMgG < 30) return 'A1'
  if (cocienteMgG <= 300) return 'A2'
  return 'A3'
}
