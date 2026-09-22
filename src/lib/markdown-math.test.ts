import test from "node:test"
import assert from "node:assert/strict"
import {
  preprocessMarkdownMath,
  parseInlineMathSegments,
  latexToUnicodeMath,
} from "./markdown-math.ts"

test("latexToUnicodeMath: converts dots, superscripts, blackboard bold, greek letters and text commands", () => {
  assert.equal(latexToUnicodeMath("\\dot{x} = A(x)x + B(x)u"), "ẋ = A(x)x + B(x)u")
  assert.equal(latexToUnicodeMath("x \\in \\mathbb{R}^{12}"), "x ∈ ℝ¹²")
  assert.equal(latexToUnicodeMath("P(x) = P(x)^T > 0"), "P(x) = P(x)ᵀ > 0")
  assert.equal(latexToUnicodeMath("Q \\ge 0"), "Q ≥ 0")
  assert.equal(latexToUnicodeMath("\\phi, \\theta, \\psi"), "ϕ, θ, ψ")
  assert.equal(latexToUnicodeMath("R^{-1}"), "R⁻¹")
  assert.equal(latexToUnicodeMath("(\\text{Re}(\\lambda_i) < 0)"), "(Re(λᵢ) < 0)")
  assert.equal(latexToUnicodeMath("120\\pi\\text{ rad/s}"), "120π rad/s")
  assert.equal(latexToUnicodeMath("Q = \\text{diag}(10, 10, 1, 1)"), "Q = diag(10, 10, 1, 1)")
})

test("preprocessMarkdownMath: converts block $$ to ```math ```", () => {
  const input = "A equação de estado é:\n$$\\dot{x} = Ax + Bu$$\nonde $x$ é o estado."
  const output = preprocessMarkdownMath(input)

  assert.ok(output.includes("```math\n\\dot{x} = Ax + Bu\n```"))
  assert.ok(output.includes("onde $x$ é o estado."))
})

test("preprocessMarkdownMath: keeps inline single $ strictly inline and never promotes to block", () => {
  const input = "As derivadas são $\\dot{x}$, $\\dot{y}$ e $\\dot{z}$."
  const output = preprocessMarkdownMath(input)

  assert.equal(output, input)
  assert.ok(!output.includes("```math"))
})

test("preprocessMarkdownMath: preserves existing code blocks containing $$", () => {
  const input = "Exemplo de código:\n```bash\necho $$ && ls\n```\nE equação:\n$$\\alpha = 1$$"
  const output = preprocessMarkdownMath(input)

  assert.ok(output.includes("```bash\necho $$ && ls\n```"))
  assert.ok(output.includes("```math\n\\alpha = 1\n```"))
})

test("parseInlineMathSegments: parses single $ inline math with unicode translation", () => {
  const input = "O vetor $x \\in \\mathbb{R}^n$ e controle $u$ são definidos."
  const segments = parseInlineMathSegments(input)

  assert.equal(segments.length, 5)
  assert.deepEqual(segments[0], { type: "text", content: "O vetor " })
  assert.deepEqual(segments[1], { type: "math", content: "x ∈ ℝⁿ" })
  assert.deepEqual(segments[2], { type: "text", content: " e controle " })
  assert.deepEqual(segments[3], { type: "math", content: "u" })
  assert.deepEqual(segments[4], { type: "text", content: " são definidos." })
})
