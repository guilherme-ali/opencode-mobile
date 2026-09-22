const GREEK_MAP: Record<string, string> = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ε",
  varepsilon: "ε",
  zeta: "ζ",
  eta: "η",
  theta: "θ",
  vartheta: "ϑ",
  iota: "ι",
  kappa: "κ",
  lambda: "λ",
  mu: "μ",
  nu: "ν",
  xi: "ξ",
  pi: "π",
  rho: "ρ",
  sigma: "σ",
  tau: "τ",
  upsilon: "υ",
  phi: "ϕ",
  varphi: "φ",
  chi: "χ",
  psi: "ψ",
  omega: "ω",
  Gamma: "Γ",
  Delta: "Δ",
  Theta: "Θ",
  Lambda: "Λ",
  Xi: "Ξ",
  Pi: "Π",
  Sigma: "Σ",
  Upsilon: "Υ",
  Phi: "Φ",
  Psi: "Ψ",
  Omega: "Ω",
}

const SYMBOL_MAP: Record<string, string> = {
  in: "∈",
  notin: "∉",
  subset: "⊂",
  subseteq: "⊆",
  supset: "⊃",
  supseteq: "⊇",
  cup: "∪",
  cap: "∩",
  emptyset: "∅",
  forall: "∀",
  exists: "∃",
  nabla: "∇",
  partial: "∂",
  infty: "∞",
  pm: "±",
  mp: "∓",
  times: "×",
  cdot: "·",
  div: "÷",
  ast: "∗",
  star: "⋆",
  circ: "∘",
  bullet: "•",
  ge: "≥",
  geq: "≥",
  le: "≤",
  leq: "≤",
  neq: "≠",
  approx: "≈",
  equiv: "≡",
  sim: "∼",
  propto: "∝",
  to: "→",
  rightarrow: "→",
  leftarrow: "←",
  Rightarrow: "⇒",
  Leftarrow: "⇐",
  Leftrightarrow: "⇔",
  mapsto: "↦",
  land: "∧",
  lor: "∨",
  neg: "¬",
  perp: "⊥",
}

const BB_MAP: Record<string, string> = {
  R: "ℝ",
  C: "ℂ",
  Z: "ℤ",
  N: "ℕ",
  Q: "ℚ",
  P: "ℙ",
}

const SUPERSCRIPT_MAP: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "-": "⁻",
  "=": "⁼",
  "(": "⁽",
  ")": "⁾",
  n: "ⁿ",
  i: "ⁱ",
  T: "ᵀ",
  t: "ᵗ",
  x: "ˣ",
  y: "ʸ",
}

const SUBSCRIPT_MAP: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  "+": "₊",
  "-": "₋",
  "=": "₌",
  "(": "₍",
  ")": "₎",
  a: "ₐ",
  e: "ₑ",
  i: "ᵢ",
  j: "ⱼ",
  k: "ₖ",
  n: "ₙ",
  m: "ₘ",
  p: "ₚ",
  r: "ᵣ",
  s: "ₛ",
  t: "ₜ",
  u: "ᵤ",
  v: "ᵥ",
  x: "ₓ",
}

const DOT_MAP: Record<string, string> = {
  x: "ẋ",
  y: "ẏ",
  z: "ż",
  r: "ṙ",
  s: "ṡ",
  p: "ṗ",
  q: "q̇",
  theta: "θ̇",
  phi: "ϕ̇",
  psi: "ψ̇",
  omega: "ω̇",
}

const DDOT_MAP: Record<string, string> = {
  x: "ẍ",
  y: "ÿ",
  z: "z̈",
  theta: "θ̈",
  phi: "ϕ̈",
  psi: "ψ̈",
}

function toSuperscript(str: string): string {
  return str
    .split("")
    .map((ch) => SUPERSCRIPT_MAP[ch] || ch)
    .join("")
}

function toSubscript(str: string): string {
  return str
    .split("")
    .map((ch) => SUBSCRIPT_MAP[ch] || ch)
    .join("")
}

export function latexToUnicodeMath(latex: string): string {
  let result = latex.trim()

  // 0. Extract text wrappers: \text{...}, \mathrm{...}, \operatorname{...}, \mathbf{...}
  result = result.replace(/\\(?:text|mathrm|operatorname|mathbf|mathit|textbf)\{([^}]+)\}/g, "$1")

  // 1. Double dots: \ddot{x} or \ddot{\theta}
  result = result.replace(/\\ddot\{?\\?([a-zA-Z]+)\}?/g, (_, sym) => {
    return DDOT_MAP[sym] || `${GREEK_MAP[sym] || sym}̈`
  })

  // 2. Single dots: \dot{x} or \dot{\theta}
  result = result.replace(/\\dot\{?\\?([a-zA-Z]+)\}?/g, (_, sym) => {
    return DOT_MAP[sym] || `${GREEK_MAP[sym] || sym}̇`
  })

  // 3. Blackboard bold: \mathbb{R} -> ℝ
  result = result.replace(/\\mathbb\{([A-Z])\}/g, (_, ch) => {
    return BB_MAP[ch] || ch
  })

  // 4. Common functions: \sin, \cos, \tan, etc.
  result = result.replace(/\\(sin|cos|tan|exp|log|ln|min|max|det|dim|deg)\b/g, "$1")

  // 5. Superscripts: ^{12} or ^T or ^2
  result = result.replace(/\^\{([^}]+)\}/g, (_, sup) => toSuperscript(sup))
  result = result.replace(/\^([0-9a-zA-Z+-])/g, (_, ch) => toSuperscript(ch))

  // 6. Subscripts: _{12} or _0 or _x
  result = result.replace(/_\{([^}]+)\}/g, (_, sub) => toSubscript(sub))
  result = result.replace(/_([0-9a-zA-Z+-])/g, (_, ch) => toSubscript(ch))

  // 7. Symbols & Greek letters: \in, \ge, \theta, \phi, etc.
  result = result.replace(/\\([a-zA-Z]+)/g, (full, name) => {
    if (SYMBOL_MAP[name]) return SYMBOL_MAP[name]
    if (GREEK_MAP[name]) return GREEK_MAP[name]
    return full
  })

  // Clean up any remaining braces around single items: {x} -> x
  result = result.replace(/\{([^{}]+)\}/g, "$1")

  return result
}

export function preprocessMarkdownMath(text: string): string {
  if (!text || !text.includes("$$")) return text

  // Split by code fences so we don't touch anything inside ``` ... ```
  const parts = text.split(/(```[\s\S]*?```)/g)
  return parts
    .map((part) => {
      // If it's a code block, leave it untouched
      if (part.startsWith("```")) return part

      // Only convert block $$ ... $$ to ```math ... ```
      return part.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
        return `\n\n\`\`\`math\n${math.trim()}\n\`\`\`\n\n`
      })
    })
    .join("")
}

export function parseInlineMathSegments(
  text: string,
): Array<{ type: "text" | "math"; content: string }> {
  if (!text || !text.includes("$")) {
    return [{ type: "text", content: text }]
  }

  const segments: Array<{ type: "text" | "math"; content: string }> = []
  // Match single $...$ (ensure not double $$)
  const regex = /(?<!\$)\$(?!\$)([^\$\n]+?)(?<!\$)\$(?!\$)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: text.slice(lastIndex, match.index),
      })
    }
    segments.push({
      type: "math",
      content: latexToUnicodeMath(match[1]),
    })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    segments.push({
      type: "text",
      content: text.slice(lastIndex),
    })
  }

  return segments
}
