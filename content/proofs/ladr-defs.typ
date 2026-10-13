// Axler's notation (bold upright F, R, C instead of Typst's blackboard default)
#let FF = $upright(bold(F))$
#let RR = $upright(bold(R))$
#let CC = $upright(bold(C))$
#let Lin = $cal(L)$
#let Poly = $cal(P)$
#let nul = math.op("null")
#let ran = math.op("range")
#let spn = math.op("span")

// revise: true marks an exercise whose proof needs another look.
#let problem(num, body, revise: false) = [
  === Exercise #num
  #if revise {
    context if target() == "html" {
      html.elem("p", attrs: (class: "revise"))[Needs revising]
    } else {
      text(size: 0.8em, upper[Needs revising])
    }
  }
  #body
]

// On the web the proof is a <div class="proof"> for the site's CSS to space,
// and the CSS pushes the square right, which h(1fr) can't do in HTML.
#let proof(body) = context if target() == "html" {
  html.elem("div", attrs: (class: "proof"))[_Proof._ #body $square$]
} else {
  block(width: 100%)[_Proof._ #body #h(1fr) $square$]
}
