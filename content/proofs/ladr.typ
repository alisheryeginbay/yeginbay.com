#metadata((
  title: "Linear Algebra Done Right: Proofs",
  date: "2026-10-13T12:00:00+05:00",
  status: "notes",
  tags: ("mathematics",),
  aliases: ("/ladr-proofs",),
)) <frontmatter>

#import "ladr-defs.typ": *

Proofs for the exercises in Sheldon Axler's _Linear Algebra Done Right_, 4th edition. All of the proofs are checked by #link("https://platform.claude.com/docs/en/models/opus-5-5/overview")[Claude Opus 5.5].

= Vector spaces

== 1C Subspaces

#problem("1C.1(b)")[]

#proof[
  Zero vector.

  $0 + 2 * 0 + 3 * 0 != 4$, thus $0$ is not in the given set, hence it is not a subspace of $FF^3$.
]

#problem("1C.1(c)", revise: true)[]

#proof[
  Additive identity.

  $0 = (0, 0, 0)$. Substituting the corresponding coordinates $0 * 0 * 0 = 0$; thus the given set includes the additive identity.

  Closure under addition.

  Let's take $u = (0, 0, 1)$ and $v = (1, 1, 0)$ so that $u + v = (0 + 1, 0 + 1, 0 + 1) = (1, 1, 1)$. Since $u, v in V$ but $u + v in.not V$, it does not satisfy the closure under addition. Thus it is not a subspace of $FF^3$.
]


#problem("1C.1(d)")[]

#proof[
  Let $S = {(x_1, x_2, x_3) in FF^3 : x_1 = 5x_3}$.
  $0 = (0, 0, 0)$, and $0 = 5 dot 0$, so the condition holds.
  Let $u = (u_1, u_2, u_3)$ and $v = (v_1, v_2, v_3)$. For $u, v in S$, $u_1 = 5u_3$ and $v_1 = 5v_3$ hold; thus $u = (5u_3, u_2, u_3)$ and $v = (5v_3, v_2, v_3)$. $u + v = (5u_3 + 5v_3, u_2 + v_2, u_3 + v_3)$. $S$ is closed under addition, since $5 u_3 + 5 v_3 = 5 (u_3 + v_3)$.
  Let $lambda in FF$. $lambda u = (lambda 5u_3, lambda u_2, lambda u_3)$. $S$ is closed under scalar multiplication, since $lambda 5u_3 = 5 (lambda u_3)$.
]

#problem("1C.2(b)")[]

#proof[
  Let $C([0,1])$ denote the set of continuous real-valued functions on the interval $[0,1]$. $C([0,1])$ has the zero function; addition and scalar multiplication yield continuous functions. Thus it is a subspace of $RR^([0,1])$.
]

#problem("1C.3")[]

#proof[
  Let $D = { f : (-4, 4) -> RR mid(|) f "is differentiable", f'(-1) = 3f(2) }$. $D subset.eq RR^((-4, 4))$.

  Additive identity: let $0$ denote the zero function; it is differentiable, since $0' = 0$. It is also in the $D$, since $0'(-1) = 3 dot 0(2) = 0$.

  Closed under addition. $D != emptyset$, for at least the zero function is in it. Let $f, g in D$. Let $s(x) = f(x) + g(x)$. $s'(-1) = f'(-1) + g'(-1)$, since the derivative of the sums of two differentiable functions equal to the sum of their derivatives. $f'(-1) + g'(-1) = 3f(2) + 3g(2) = 3(f(2) + g(2)) = 3s(2)$; thus $s in D$.

  Closed under scalar multiplication. Let $lambda in RR$ and $f in D$. $(lambda f)(x) = lambda f(x)$. Let $m(x) = lambda f(x)$. Then $m'(x) = lambda f'(x)$. $m'(-1) = lambda 3 f(2) = 3 lambda f(2) = 3 m(2)$; thus $m in D$.

  Hence $D$ is a subspace of $RR^((-4, 4))$.
]

#problem("1C.23", revise: true)[]

#proof[
  Let $V = FF^2$. Take $U = { (x, 0) in FF^2 : x in FF }$ (which is the x-axis), $V_1 = { (x, x) in FF^2 : x in FF }$, and $V_2 = { (0, y) in FF^2 : y in FF }$, so $V_1 inter U = { 0 }$ and $V_2 inter U = { 0 }$. Both $V_1 plus.o U = V_2 plus.o U = V$, however, $V_1 != V_2$.
]


= Finite-dimensional vector spaces

== 2A Span and linear independence

#problem("2A.2")[]

#proof[
  $V = spn(v_1, v_2, v_3, v_4) = { a_1 v_1 + dots.c + a_4 v_4 : a_1, ..., a_4 in FF }$.
  $
    S &= spn(v_1 - v_2, v_2 - v_3, v_3 - v_4, v_4) \
    &= { b_1 (v_1 - v_2) + b_2 (v_2 - v_3) + b_3 (v_3 - v_4) + b_4 v_4 : b_1, b_2, b_3, b_4 in FF } \
    &= { b_1 v_1 - b_1 v_2 + b_2 v_2 - b_2 v_3 + b_3 v_3 - b_3 v_4 + b_4 v_4 : b_1, b_2, b_3, b_4 in FF } \
    &= { b_1 v_1 + v_2 (b_2 - b_1) + v_3 (b_3 - b_2) + v_4 (b_4 - b_3) : b_1, b_2, b_3, b_4 in FF }
  $

  Let $v in V$. Then there exist $v = a_1 v_1 + a_2 v_2 + a_3 v_3 + a_4 v_4$, where $a_1, a_2, a_3, a_4 in FF$. Define $b_1 = a_1$, $b_2 = a_1 + a_2$, $b_3 = a_1 + a_2 + a_3$, and $b_4 = a_1 + a_2 + a_3 + a_4$. Then
  $
    a_1 v_1 + v_2 ((a_1 + a_2) - a_1) + v_3 ((a_1 + a_2 + a_3) - (a_1 + a_2)) \
    "" + v_4 ((a_1 + a_2 + a_3 + a_4) - (a_1 + a_2 + a_3)) = v,
  $
  so $v in S$. Hence $V subset.eq S$. Conversely, $S subset.eq V$ because $b_1, b_2 - b_1, b_3 - b_2, b_4 - b_3 in FF$ and $V$ is closed under scalar multiplication and vector addition. Thus $S = V$.
]

#problem("2A.4(a)")[]

#proof[
  Suppose $(v)$ is linearly independent, and suppose $v = 0$. Then $1 dot v = 1 dot 0 = 0$. Taking $a = 1$ gives a nonzero scalar with $a v = 0$, contradicting the linear independence of $(v)$. Therefore $v != 0$.

  Conversely, suppose $v != 0$, and suppose $a != 0$. Then there exists $a^(-1)$, such that $a^(-1) a = 1$. Multiplying both sides of $a v = 0$ by $a^(-1)$, $1 v = v = 0$, hence contradicting $v != 0$. Therefore $a = 0$ if $a v = 0$ and $v != 0$.

  Thus $(v)$ is linearly independent if and only if the $v != 0$.
]

#problem("2A.4(b)")[]

#proof[
  Let $(u, w)$.

  Suppose there exists $lambda in FF$, such that $u = lambda w$. Take $a = 1$ and $b = -lambda$. Then $a u + b w = 1 u + (-lambda) w = lambda w + (-lambda) w = 0 w = 0$. Since $a = 1 != 0$, $(u, w)$ is dependent. Symmetrically, the same is for $w = lambda u$. Thus if either of the two vectors $u$, $w$ is a scalar multiple of the other, then $(u, w)$ is dependent.

  Suppose $(u, w)$ is dependent. Then there exist $a, b in F$, not both $0$, such that $a u + b w = 0$. Suppose $a != 0$. Then there exist $a^(-1)$. Multiplying both sides of $a u + b w = 0$ by $a^(-1)$ gives us $a^(-1) (a u) + a^(-1) (b w) = (a^(-1) a) u + (a^(-1) b) w = 1 u + (a^(-1) b) w = u + (a^(-1) b) w = 0$; hence $u = -((a^(-1) b) w) = (-a^(-1) b) w$. Symmetrically, for $b != 0$, $w = (-b^(-1) a) u$.
]

#problem("2A.6", revise: true)[]

#proof[
  Let $v_1 = (2, 3, 1)$, $v_2 = (1, -1, 2)$, and $v_3 = (7, 3, c)$.

  Suppose the list is linearly dependent. Then there exist $a_1, a_2, a_3 in FF$, not all $0$, such that $a_1 v_1 + a_2 v_2 + a_3 v_3 = 0$. Suppose $a_3 = 0$. Then $a_1 v_1 + a_2 v_2 = (2 a_1 + a_2, 3 a_1 - a_2, a_1 - 2 a_2) = (0, 0, 0)$. Solving the linear system of equations: $a_1 = a_2 = 0$. $a_1 = a_2 = a_3 = 0$, hence contradicting the linear dependence. Hence $a_3 != 0$. Solving the linear system of the first two equations in terms of $a_3$ for $a_1 v_1 + a_2 v_2 + a_3 v_3 = (2 a_1 + a_2 + 7 a_3, 3 a_1 - a_2 + 3 a_3, a_1 + 2 a_2 + c a_3) = (0, 0, 0)$, we have $a_1 = -2 a_3$ and $a_2 = -3 a_3$. Substituting both in the third equation, $-2 a_3 - 6 a_3 + c a_3 = -8a_3 + c a_3 = (-8 + c) a_3 = 0$. $a_3 != 0$, so there exists $a_3^(-1)$. Multiplying both sides of the equation: $-8 + c = 0$. Hence $c = 8$.

  Suppose $c = 8$. Take $a_1 = 2$, $a_2 = 3$, and $a_3 = -1$. Then $a_1 v_1 + a_2 v_2 + a_3 v_3 = (2 * 2 + 3 - 7, 2 * 3 - 3 - 3, 2 + 6 - 8) = (0, 0, 0)$. Hence there exist $a_1, a_2, a_3$, not all $0$, such that $a_1 v_1 + a_2 v_2 + a_3 v_3 = 0$. Therefore the list is linearly dependent.

  Thus the list is linearly dependent if and only if $c = 8$.
]


#problem("2A.7(a)")[]

#proof[
  Let $a, b in RR$. Then $a (1 + i) + b (1 - i) = (a + b) + (a - b) i = 0$, where $a + b, a - b in RR$. Thus $a + b = 0$ and $a - b = 0$. Solving the linear system of equations, $a = b = 0$. Therefore the list $1 + i, 1 - i$ is linearly independent.
]

#problem("2A.7(b)")[]

#proof[
  Let $alpha, beta in CC$. Take $alpha = i$ and $beta = 1$. Then $i (1 + i) + 1 (1 - i) = (-1 + 1) + (1 - 1) i = 0 + 0i = 0$. Thus the list $1 + i, 1 - i$ is linearly dependent.
]

#problem("2A.10", revise: true)[]

#proof[
  Suppose $c_1 (lambda v_1) + c_2 (lambda v_2) + dots.c + c_m (lambda v_m) = 0$ for some $c_1, c_2, ..., c_m in FF$. Then $lambda (c_1 v_1 + c_2 v_2 + dots.c + c_m v_m) = 0$. Since $lambda != 0$, multiplying both sides by $lambda^(-1)$ gives $c_1 v_1 + c_2 v_2 + dots.c c_m v_m = 0$. Because $v_1, v_2, ..., v_m$ is linearly independent, $c_1 = c_2 = dots.c = c_m = 0$. Hence $lambda v_1, lambda v_2, ..., lambda v_m$ is linearly independent.
]


#problem("2A.11")[]

#proof[
  Take $v_1 = (1, 0)$, $v_2 = (0, 1)$, $w_1 = (0, 1)$, and $w_2 = (1, 0)$. Then $v_1 + w_1, v_2 + w_2 = (1, 1), (1, 1)$. Suppose $a_1 (v_1 + w_1) + a_2 (v_2 + w_2) = 0$. Take $a_1 = 1$ and $a_2 = -1$, so $1 (1, 1) + (-1) (1, 1) = (0, 0) = 0$. Thus $v_1 + w_1, ..., v_m + w_m$ is not linearly independent.
]

#problem("2A.13")[]

#proof[
  Suppose $v_1, ..., v_m, w$ is linearly independent, and suppose for contradiction that $w in spn(v_1, ..., v_m)$. Then $w = c_1 v_1 + dots.c + c_m v_m$ for some $c_1, ..., c_m in FF$. Then $c_1 v_1 + dots.c + c_m v_m - w = 0$, contradicting the linear independence of $v_1, ..., v_m, w$.

  Suppose $w in.not spn(v_1, ..., v_m)$, and suppose for contradiction that $v_1, ..., v_m, w$ is linearly dependent. Then there exist $a_1, ..., a_m, a_(m+1) in FF$, not all $0$, such that $a_1 v_1 + dots.c + a_m v_m + a_(m+1) w = 0$. Suppose $a_(m+1) != 0$. Multiplying both sides by $a_(m+1)^(-1)$ gives $a_1 / a_(m+1) v_1 + dots.c + a_m / a_(m+1) v_m + w = 0$. Then $w = -a_1 / a_(m+1) v_1 - dots.c - a_m / a_(m+1) v_m$, contradicting $w in.not spn(v_1, ..., v_m)$. Suppose $a_(m+1) = 0$. Then there exist $a_1, ..., a_m$, not all $0$, such that $a_1 v_1 + dots.c + a_m v_m = 0$, thus contradicting the linear independence of $v_1, ..., v_m$.

  Therefore $v_1, ..., v_m, w$ is linearly independent $<==>$ $w in.not spn(v_1, ..., v_m)$.
]

== 2B Bases

#problem("2B.3(a)")[]

#proof[
  Take $v_1 = (3, 1, 0, 0, 0)$, $v_2 = (0, 0, 7, 1, 0)$, and $v_3 = (0, 0, 0, 0, 1)$. $v_1 in U$, because $3 = 3 * 1$ and $0 = 7 * 0$; $v_2 in U$, because $0 = 3 * 0$ and $7 = 7 * 1$; $v_3 in U$, because $0 = 3 * 0$ and $0 = 7 * 0$.
  Suppose there exist $a_1, a_2, a_3 in RR$ such that $a_1 v_1 + a_2 v_2 + a_3 v_3 = (3 a_1, a_1, 7 a_2, a_2, a_3) = 0$. The equation forces $a_1 = a_2 = a_3 = 0$. Therefore the list $v_1, v_2, v_3$ is linearly independent. Let $u = (x_1, x_2, x_3, x_4, x_5) in U$. Then $x_1 = 3x_2$ and $x_3 = 7x_4$, so $u = (3x_2, x_2, 7x_4, x_4, x_5)$. The linear combination of $v_1, v_2, v_3$ is $a_1 v_1 + a_2 v_2 + a_3 v_3$. Take $a_1 = x_2$, $a_2 = x_4$, and $a_3 = x_5$. Then $x_2 (3, 1, 0, 0, 0) + x_4 (0, 0, 7, 1, 0) + x_5 (0, 0, 0, 0, 1) = (3 x_2, x_2, 7 x_4, x_4, x_5) = u$. Therefore $v_1, v_2, v_3$ spans $U$. Thus $v_1, v_2, v_3$ is a basis of $U$.
]

#problem("2B.3(b)")[]

#proof[
  $U subset.eq RR^5$, so $v_1, v_2, v_3$ is independent in $RR^5$. By 2.32 we can extend $v_1, v_2, v_3$ to a basis of $RR^5$. Take $w_1 = (1, 0, 0, 0, 0)$ and $w_2 = (0, 0, 1, 0, 0)$ where $w_1, w_2 in RR^5$. Suppose there exist $a_1, a_2, a_3, a_4, a_5 in RR$ such that $a_1 v_1 + a_2 v_2 + a_3 v_3 + a_4 w_1 + a_5 w_2 = (3a_1 + a_4, a_1, 7a_2 + a_5, a_2, a_3) = 0$. The equation forces $a_1 = a_2 = a_3 = a_4 = a_5 = 0$. Therefore $v_1, v_2, v_3, w_1, w_2$ is independent. Let $u = (a, b, c, d, e) in RR^5$. Then
  $
    b v_1 + d v_2 + e v_3 + (a - 3b) w_1 + (c - 7d) w_2 &= (3b + (a - 3b), b, 7d + (c - 7d), d, e) \
    &= (a, b, c, d, e) = u.
  $
  Therefore $v_1, v_2, v_3, w_1, w_2$ spans $RR^5$. Thus $v_1, v_2, v_3, w_1, w_2$ is a basis of $R^5$.
]

#problem("2B.3(c)", revise: true)[]

#proof[
  Let $W = spn(w_1, w_2) = { (x_1, x_2, x_3, x_4, x_5) in RR^5 : x_2 = x_4 = x_5 = 0 }$. Suppose $u in RR^5$. The list $v_1, v_2, v_3, w_1, w_2$ spans $RR^5$, so there exist $a_1, a_2, a_3, a_4, a_5 in RR$ such that $u = a_1 v_1 + a_2 v_2 + a_3 v_3 + a_4 w_1 + a_5 w_2$. We have $u = v + w$, where $v in U$ and $w in W$. Thus $u in U + W$, hence $RR^5 = U + W$.

  Suppose $u in U inter W$. Then there exists $u = a_1 v_1 + a_2 v_2 + a_3 v_3 = a_4 w_1 + a_5 w_5$. Thus $a_1 v_1 + a_2 v_2 + a_3 v_3 - a_4 w_1 - a_5 w_5 = 0$. Because $v_1, v_2, v_3, w_1, w_2$ is linearly independent, $a_1 = a_2 = a_3 = a_4 = a_5 = 0$. Thus $u = 0$, hence $U inter W = { 0 }$.

  Therefore $RR^5 = U plus.o W$.
]


#problem("2B.4(a)")[]

#proof[
  Let $u = (z_1, z_2, z_3, z_4, z_5) in U$. Then $6z_1 = z_2$ and $z_3 + 2z_4 + 3z_5 = 0$, so $u = (z_1, 6z_1, -2z_4 - 3z_5, z_4, z_5)$. Splitting that vector into a sum, we have $u = z_1 (1, 6, 0, 0, 0) + z_4 (0, 0, -2, 1, 0) + z_5 (0, 0, -3, 0, 1)$.

  Let $v_1 = (1, 6, 0, 0, 0)$, $v_2 = (0, 0, -2, 1, 0)$, and $v_3 = (0, 0, -3, 0, 1)$.

  $v_1, v_2, v_3 in U$, because $6 dot 1 = 6$ and $0 + 2 dot 0 + 3 dot 0 = 0$; $6 dot 0 = 0$ and $-2 + 2 dot 1 + 3 dot 0 = 0$; $6 dot 0 = 0$ and $-3 + 2 dot 0 + 3 dot 1 = 0$. Hence $spn(v_1, v_2, v_3) subset.eq U$. $u$ is a linear combination of $v_1, v_2, v_3$, hence $U subset.eq spn(v_1, v_2, v_3)$. Thus $spn(v_1, v_2, v_3) = U$.

  Suppose there exist $a_1, a_2, a_3 in CC$ such that $a_1 v_1 + a_2 v_2 + a_3 v_3 = 0$. Then $a_1 v_1 + a_2 v_2 + a_3 v_3 = (a_1, 6a_1, -2a_2 - 3a_3, a_2, a_3) = 0$. The first, fourth, and fifth coordinates give $a_1 = 0$, $a_2 = 0$, and $a_3 = 0$. Hence $a_1 = a_2 = a_3 = 0$, therefore $v_1, v_2, v_3$ is linearly independent.
]

#problem("2B.4(b)")[]

#proof[
  Take $w_1 = (0, 1, 0, 0, 0)$ and $w_2 = (0, 0, 1, 0, 0)$ where $w_1, w_2 in CC^5$.

  Suppose there exist $a_1, a_2, a_3, a_4, a_5 in CC$ such that
  $a_1 v_1 + a_2 v_2 + a_3 v_3 + a_4 w_1 + a_5 w_2 = (a_1, 6a_1 + a_4, -2a_2 - 3a_3 + a_5, a_2, a_3) = 0$.
  The first, fourth, and fifth coordinates force $a_1 = 0$, $a_2 = 0$, and $a_3 = 0$. Substituting corresponding values to other coordinates, $6 dot 0 + a_4 = a_4 = 0$, $-2 dot 0 - 3 dot 0 + a_5 = a_5 = 0$; hence $a_4 = a_5 = 0$. Therefore $v_1, v_2, v_3, w_1, w_2$ is linearly independent.

  $v_1, v_2, v_3, w_1, w_2 in CC^5$, so $spn(v_1, v_2, v_3, w_1, w_2) subset.eq CC^5$, because span is a subspace, so it is closed under linear combination. Suppose $u = (u_1, u_2, u_3, u_4, u_5) in CC^5$. Take $a_1 = u_1$, $a_2 = u_4$, $a_3 = u_5$, $a_4 = u_2 - 6u_1$, and $a_5 = u_3 + 2u_4 + 3u_5$. Then
  $
    & a_1 v_1 + a_2 v_2 + a_3 v_3 + a_4 w_1 + a_5 w_2 \
    &= (a_1, 6a_1 + a_4, -2a_2 - 3a_3 + a_5, a_2, a_3) \
    &= (u_1, 6u_1 + (u_2 - 6u_1), -2u_4 - 3u_5 + u_3 + 2u_4 + 3u_5, u_4, u_5) \
    &= (u_1, u_2, u_3, u_4, u_5) = u.
  $
  So $CC^5 subset.eq spn(v_1, v_2, v_3, w_1, w_2)$. Hence $spn(v_1, v_2, v_3, w_1, w_2) = CC^5$.
]

#problem("2B.4(c)")[]

#proof[
  Let $W = spn(w_1, w_2)$ and $v in CC^5$. The list $(v_1, v_2, v_3, w_1, w_2)$ spans $CC^5$, so there exist $a_1, a_2, a_3, a_4, a_5 in CC$ such that $a_1 v_1 + a_2 v_2 + a_3 v_3 + a_4 w_1 + a_5 w_2 = v$ where $v_1, v_2, v_3 in U$ and $w_1, w_2 in W$. $v in U + W$, hence $CC^5 subset.eq U + W$. Conversely, $U$ and $W$ are subspaces of $CC^5$, so $U + W subset.eq CC^5$.

  Suppose $v in U inter W$. Then there exist $a_1, a_2, a_3, a_4, a_5 in CC$ such that $v = a_1 v_1 + a_2 v_2 + a_3 v_3 = a_4 w_1 + a_5 w_2$. Hence $a_1 v_1 + a_2 v_2 + a_3 v_3 - a_4 w_1 - a_5 w_2 = 0$. Since $v_1, v_2, v_3, w_1, w_2$ is linearly independent, so $a_1 = a_2 = a_3 = a_4 = a_5 = 0$. Hence $v = 0$, thus $U inter W = { 0 }$.

  Thus $U plus.o W = CC^5$.
]

== 2C Dimension

#problem("2C.1")[
  Show that the subspaces of $RR^2$ are precisely ${0}$, all lines in $RR^2$ containing the origin, and $RR^2$.
]

#proof[
  ${0}$ is a subspace of $RR^2$: $0 in {0}$; $0 + 0 = 0 in {0}$; $lambda 0 = 0 in {0}$ for every $lambda in RR$. Let $L$ be a line in $RR^2$ containing the origin. Then $L = { a v : a in RR }$ for some nonzero $v in RR^2$. Then $L$ is a subspace of $RR^2$: take $a = 0$, so $0 v = 0 in L$; let $a v, b v in L$, so $a v + b v = (a + b) v in L$ since $a + b in RR$; let $lambda in RR$, so $lambda (a v) = (lambda a) v$, where $lambda a in RR$, by the compatibility of scalar multiplication with field multiplication, hence closed under scalar multiplication. $RR^2$ is a subspace of itself, as expected.

  Let $U$ be a subspace of $RR^2$.

  Case 1. If $U = {0}$, done.

  Case 2. Suppose $U != {0}$. $U$ contains some nonzero $v$, and so it contains the line ${a v : a in RR}$.
  Case 2.1.
  $U$ is exactly that line, done.
  Case 2.2.
  Otherwise, $U$ contains some nonzero $w$ that is not a multiple of $v$, i.e., $w != lambda v$ for all $lambda in RR$ (and vice versa).

  Since $U$ is a subspace of $RR^2$: for any $a, b in RR$, $a v, b w in U$ by closure under scalar multiplication; $a v + b w in U$ by closure under vector addition. Let's define $W = { a v + b w : a, b in RR }$, so $W subset.eq U$.

  Let's define $D = v_1 w_2 - v_2 w_1$. Suppose $D = 0$. Then $v_1 w_2 = v_2 w_1$. Suppose $v_1 != 0$, so $w_2 = w_1 / v_1 v_2$. Take $lambda = w_1 / v_1$. Then both $lambda v_1 = w_1$ and $lambda v_2 = w_2$ hold. Hence $lambda v = w$, contradicting the assumption that $w$ is not a multiple of $v$. Suppose $v_1 = 0$. Then $v_2 != 0$, because $v$ is a nonzero vector, so $w_1 = w_2 / v_2 v_1$. Take $lambda = w_2 / v_2$. Then both $lambda v_2 = w_2$ and $lambda v_1 = w_1$ hold. Hence $lambda v = w$, contradicting the assumption that $w$ is not a multiple of $v$. Thus $D != 0$.

  Let $(x, y) in RR^2$. Then we have a linear system of equations comprising $x = a v_1 + b w_1$ and $y = a v_2 + b w_2$. Solving the system we have $a = (x w_2 - y w_1) / (v_1 w_2 - v_2 w_1)$ and $b = (y v_1 - x v_2) / (v_1 w_2 - v_2 w_1)$. $v_1 w_2 - v_2 w_1 != 0$ ($D != 0$), so there exist $a, b$ such that $(x, y) = a v + b w$. So $(x, y) in W$ and $(x, y)$ was arbitrary, hence $RR^2 subset.eq W$, and because $W subset.eq U$, so $RR^2 subset.eq U$. $U subset.eq RR^2$, since $U$ is a subset of $RR^2$, and $RR^2 subset.eq U$, thus $U = RR^2$.
]

#problem("2C.2")[
  Show that the subspaces of $RR^3$ are precisely ${0}$, all lines in $RR^3$ containing the origin, all planes in $RR^3$ containing the origin, and $RR^3$.
]

#proof[
  ${0}$ is a subspace of $RR^3$: $0 in {0}$; $0 + 0 in {0}$; let $lambda in RR$, so $lambda 0 in {0}$.

  We define a line in $RR^3$ containing the origin as $L = { a v : a in RR }$ for some nonzero $v in RR^3$. Then $L$ is a subspace of $RR^3$: take $a = 0$, so $0 v = 0 in L$; let $a v, b v in L$, so $a v + b v = (a + b) v in L$ where $a + b in RR$; let $lambda in RR$, so $lambda (a v) = (lambda a) v in L$ where $lambda a in RR$.

  We define a plane in $RR^3$ containing the origin as $P = { a v + b u : a, b in RR }$ for some vectors $v, u in RR^3$ where neither of them is a multiple of the other. Then $P$ is a subspace of $RR^3$: take $a = b = 0$, so $0 v + 0 u = 0 in P$; let $a v + b u in P$ and $c v + d u in P$, so $(a v + b u) + (c v + d u) = (a + c) v + (b + d) u in P$ where $a + c, b + d in RR$; let $lambda in RR$, so $lambda (a v + b u) = lambda (a v) + lambda (b u) = (lambda a) v + (lambda b) u in P$ where $lambda a, lambda b in RR$.

  $RR^3$ is a subspace of $RR^3$: $0 in RR^3$; let $u, v in RR^3$, so $u + v in RR^3$; let $lambda in RR$ and $u in RR^3$, so $lambda u in RR^3$.

  Let $U$ be a subspace of $RR^3$. A subspace of a finite-dimensional $RR^3$ is finite-dimensional with $dim U <= dim RR^3$, hence $dim U in {0, 1, 2, 3}$.

  Case 1.
  Suppose $dim U = 0$. Then by definition $U$ has a basis of length $0$, hence $spn() = U$. By definition of a span of an empty list, $U = { 0 }$.

  Case 2.
  Suppose $dim U = 1$. Then by definition $U$ has a basis of length $1$, hence $spn(v) = U$ where $(v)$ is linearly independent, so $v$ is some nonzero vector (otherwise it is linearly dependent). By definition of a span, $U = { a v : a in RR }$, i.e., a line containing the origin.

  Case 3.
  Suppose $dim U = 2$. Then by definition $U$ has a basis of length $2$, hence $spn(v, u) = U$ where $(v, u)$ is linearly independent. Suppose $v = lambda u$ for some $lambda in RR$. Then $v - lambda u = 0$, contradicting the linear independence of $(v, u)$ (coefficient of $v$ is $1$). Symmetrically, suppose $u = lambda v$. Then $u - lambda v = -lambda v + u = 0$, again, contradicting the linear independence of $(v, u)$ (coefficient of $u$ is $1$). So $v, u$ are vectors where neither is a multiple of the other. Then by definition of a span, $U = { a v + b u : a, b in RR }$, i.e., a plane containing the origin.

  Case 4.
  Suppose $dim U = 3$. $dim RR^3 = 3$. We have $dim U = dim RR^3 = 3$, so by 2.39 (subspace of full dimension equals the whole space) $U = RR^3$.
]

#problem("2C.3")[
  (a) Let $U = { p in P_4(FF) : p(6) = 0 }$. Find a basis of $U$. \
  (b) Extend the basis in (a) to a basis of $P_4(FF)$. \
  (c) Find a subspace $W$ of $P_4(FF)$ such that $P_4(FF) = U plus.o W$.
]

#proof[
  (a)
  $dim U <= dim Poly_4(FF)$ because $Poly_4(FF)$ is finite-dimensional and $U$ is a subspace of $Poly_4(FF)$ (by 2.37). Take $p(x) = x^4$ such that $p in Poly_4(FF)$. Then $p in.not U$ since $p(6) = 6^4 = 1296 != 0$. So $dim U != dim Poly_4(FF) = 5$, because $dim U = 5$ implies $U = Poly_4(FF)$ (by 2.39) which is not the case. Take polynomials $x - 6$, $(x - 6)^2$, $(x - 6)^3$, and $(x - 6)^4$ where each one is in $U$ ($6 - 6 = 0$; $(6 - 6)^2 = 0$; $(6 - 6)^3 = 0$; $(6 - 6)^4 = 0$). Suppose $a, b, c, d in FF$ and
  $a(x - 6) + b(x - 6)^2 + c(x - 6)^3 + d(x - 6)^4 = 0$
  We can see that the left side has a $d x^4$ term. Because the right side has no $x^4$ term, this implies that $d = 0$. Because $d = 0$, we see that the left side has a $c x^3$ term, which implies that $c = 0$. Because $c = d = 0$, we can conclude that $b = 0$. Because $b = c = d = 0$, we can also conclude that $a = 0$. Hence the list $x - 6, (x - 6)^2, (x - 6)^3, (x - 6)^4$ is a linearly independent list in $U$. Thus $4 <= dim U < 5$, so $dim U = 4$.

  Thus the linearly independent list $x - 6, (x - 6)^2, (x - 6)^3, (x - 6)^4$ has length $dim U = 4$, hence is a basis of $U$ (by 2.38).
]

#proof[
  (b)
  Extending the list by $x in Poly_4(FF)$, we have $x - 6, (x - 6)^2, (x - 6)^3, (x - 6)^4, x$. Suppose $a, b, c, d, e in FF$ and $a(x - 6) + b(x - 6)^2 + c(x - 6)^3 + d(x - 6)^4 + e x = 0$. We can see that the left side has a $d x^4$ term. Because the right side has no $x^4$ term, this implies that $d = 0$. Because $d = 0$, we see that the left side has a $c x^3$ term, which implies that $c = 0$. Because $c = d = 0$, we can conclude that $b = 0$. Because $b = c = d = 0$ and $6a = 0$, we can conclude that $a = 0$. Finally, because $a = b = c = d = 0$, we can conclude that $e = 0$. Hence the list $x - 6, (x - 6)^2, (x - 6)^3, (x - 6)^4, x$ is a linearly independent list in $Poly_4(FF)$. Since length of $x - 6, (x - 6)^2, (x - 6)^3, (x - 6)^4, x$ is $5$, so it equals $dim Poly_4(FF)$, hence a basis of $Poly_4(FF)$ (by 2.38).
]

#proof[
  (c)
  Suppose $W$ is a subspace of $Poly_4(FF)$ such that $U inter W = {0}$. Then $dim (U inter W) = 0$. Since $dim (U + W) = dim U + dim W - dim (U inter W)$ (by 2.43), we can conclude that $dim W = 1$, because $dim (U inter W) = 0$, $dim U = 4$ (from (a)), and $dim (U + W) = dim Poly_4(FF) = 5$.

  Let $W = spn(x) = { a x in Poly_4(FF) : a in FF }$.

  Suppose $v in U inter W$. Since $v in U$ and $x - 6, ..., (x - 6)^4$ is a basis of $U$, there exist $a, b, c, d in FF$ such that $v = a(x - 6) + b(x - 6)^2 + c(x - 6)^3 + d(x - 6)^4$. Since $v in W$ and $x$ is a basis of $W$, there exists $e in FF$ such that $v = e x$. Then $a(x - 6) + b(x - 6)^2 + c(x - 6)^3 + d(x - 6)^4 = e x$, so $a(x - 6) + b(x - 6)^2 + c(x - 6)^3 + d(x - 6)^4 - e x = 0$. Since $x - 6, (x - 6)^2, (x - 6)^3, (x - 6)^4, x$ is linearly independent, $a = b = c = d = e = 0$. Hence $v = 0$, thus $U inter W subset.eq { 0 }$. ${0} subset.eq U inter W$, because $0$ is in every subspace. Therefore $U inter W = { 0 }$.

  $dim (U + W) = dim U + dim W - dim (U inter W) = 4 + 1 - 0 = 5$ (by 2.43). Since $dim (U + W) = 5 = dim Poly_4(FF)$, we can conclude that $U + W = Poly_4(FF)$, because a subspace of full dimension equals the whole space (by 2.39).

  Since $U inter W = {0}$ and $U + W = Poly_4(FF)$, we have $U plus.o W = Poly_4(FF)$.
]

#problem("2C.13")[
  Suppose $U$ and $W$ are both five-dimensional subspaces of $RR^9$. Prove that $U inter W != {0}$.
]

#proof[
  We are given $dim U = dim W = 5$. Since $U + W$ is a subspace of $RR^9$ (by 1.40), $dim (U + W) <= dim RR^9 = 9$ (by 2.37). By 2.43,
  $
    dim (U + W) &= dim U + dim W - dim (U inter W) \
    &= 5 + 5 - dim (U inter W) \
    &= 10 - dim (U inter W)
  $
  Suppose $U inter W = {0}$. Then $dim (U inter W) = 0$ and so $dim (U + W) = 10$, which contradicts $dim (U + W) <= 9$. Therefore $U inter W != {0}$.
]

#problem("2C.15")[
  Suppose $V$ is finite-dimensional and $V_1, V_2, V_3$ are subspaces of $V$ with $dim V_1 + dim V_2 + dim V_3 > 2 dim V$. Prove that $V_1 inter V_2 inter V_3 != {0}$.
]

#proof[
  For any two subspaces $U$ and $W$ of $V$, the following holds by 2.43: $dim (U + W) = dim U + dim W - dim (U inter W)$. Then $dim (U inter W) = dim U + dim W - dim (U + W)$. A subspace of $V$ is not greater than $V$ (by 2.37), so $dim (U + W) <= dim V$, where $U + W$ is a subspace of $V$. So the following inequality holds: $dim (U inter W) >= dim U + dim W - dim V$. Then $dim (V_1 inter V_2) >= dim V_1 + dim V_2 - dim V$ and so we have the following:
  $
    dim ((V_1 inter V_2) inter V_3) &>= dim (V_1 inter V_2) + dim V_3 - dim V \
    &>= dim V_1 + dim V_2 - dim V + dim V_3 - dim V \
    &>= dim V_1 + dim V_2 + dim V_3 - 2 dim V
  $
  , where $dim V_1 + dim V_2 + dim V_3 > 2 dim V$. Hence $dim (V_1 inter V_2 inter V_3) > 2 dim V - 2 dim V = 0$, thus $dim (V_1 inter V_2 inter V_3) != 0$. Therefore, $V_1 inter V_2 inter V_3 != {0}$.
]

= Linear maps

== 3A Vector space of linear maps

#problem("3A.3", revise: true)[
  Suppose that $T in Lin(FF^n, FF^m)$. Show that there exist scalars $A_(j,k) in FF$ for $j = 1, ..., m$ and $k = 1, ..., n$ such tha
  $
    T(x_1, ..., x_n) = (A_(1,1) x_1 + dots.c + A_(1,n) x_n, ..., A_(m,1) x_1 + dots.c + A_(m,n) x_n)
  $
  for every $(x_1, ..., x_n) in FF^n$.
]

#proof[
  Suppose that $T in Lin(FF^n, FF^m)$. Let $(x_1, ..., x_n) in FF^n$. We can rewrite $(x_1, ..., x_n)$ as a linear combination using the standard basis of $FF^n$. Let $e_1, ..., e_n$ such vectors where $e_k$ has a 1 in k-th slot and 0 everywhere else. Then $(x_1, ..., x_n) = x_1 e_1 + dots.c + x_n e_n$. By additivity and homogeneity of linear maps, $T(x_1 e_1 + dots.c + x_n e_n) = T(x_1 e_1) + dots.c + T(x_n e_n) = x_1 T(e_1) + dots.c + x_n T(e_n)$.
  Because $T(e_k) in FF^m$, it has $m$ coordinates where each is in $FF$. Let's denote each k-th m-dimensional vector's j-th coordinate using $A_(j, k)$. Then
  $
    T(x_1 e_1 + dots.c + x_n e_n) &= x_1 (A_(1,1), A_(2,1), ..., A_(m,1)) + dots.c + x_n (A_(1,n), ..., A_(m,n)) \
    &= (x_1 A_(1,1) + dots.c + x_n A_(1,n), ..., x_1 A_(m,1) + dots.c + x_n A_(m,n)) \
    &= (A_(1,1) x_1 + dots.c + A_(1,n) x_n, ..., A_(m,1) x_1 + dots.c + A_(m,n) x_n)
  $
  Thus there exist scalars $A_(j,k) in FF$ for $j = 1, ..., m$ and $k = 1, ..., n$ such that
  $
    T(x_1, ..., x_n) = (A_(1,1) x_1 + dots.c + A_(1,n) x_n, ..., A_(m,1) x_1 + dots.c + A_(m,n) x_n).
  $
  Since $(x_1, ..., x_n)$ was arbitrary, it is true for every $(x_1, ..., x_n) in FF^n$.
]


#problem("3A.7")[
  Show that every linear map from a one-dimensional vector space to itself is multiplication by some scalar. More precisely, prove that if $dim V = 1$ and $T in Lin(V)$, then there exist $lambda in FF$ such that $T v = lambda v$ for all $v in V$.
]

#proof[
  Suppose $dim V = 1$ and $T in Lin(V)$. Since $dim V = 1$, $V != {0}$, so there exists a nonzero $u in V$. The list $(u)$ is linearly independent, because $u != 0$; every linearly independent list of length $dim V$ is a basis of $V$; hence $(u)$ of length 1 is a basis of $V$. Because every vector in $V$ can be written as a linear combination of a basis and $T(u) in V$, there exists $lambda in FF$ such that $T(u) = lambda u$. Suppose $v in V$. Then there exist $alpha in FF$ such that $v = alpha u$. By homogeneity, $T(v) = T(alpha u) = alpha T(u)$. Then $T(v) = alpha (lambda u) = (alpha lambda) u = (lambda alpha) u = lambda (alpha u) = lambda v$ by compatibility of field multiplication with scalar multiplication and commutativity in $FF$.
]

#problem("3A.11")[
  Suppose $V$ is finite-dimensional and $T in Lin(V)$. Prove that $T$ is a scalar multiple of the identity if and only if $S T = T S$ for every $S in Lin(V)$.
]

#proof[
  $(exists lambda in FF, T = lambda I) <==> (forall S in Lin(V), S T = T S)$.

  Suppose there exists $lambda in FF$ such that $T = lambda I$. Let $S in Lin(V)$ and $v in V$. Then
  $
    (S T)(v) &= (S(lambda I))(v) \
    &= S((lambda I)(v)) \
    &= S(lambda I(v)) \
    &= S(lambda v) \
    &= lambda (S(v)) quad "by homogeneity of S" \
    &= lambda (I(S(v))) \
    &= (lambda I)(S(v)) \
    &= ((lambda I) S)(v) \
    &= (T S)(v)
  $
  Since $v$ was arbitrary, $S T = T S$; since $S$ was arbitrary, this holds for every $S in Lin(V)$.

  Suppose $S T = T S$ for every $S in Lin(V)$. If $V = { 0 }$, then $T = 0 = lambda I$ for any scalar $lambda$. Otherwise, fix a nonzero $v in V$. We can extend the list $v$ to a basis of $V$; let $u_2, ..., u_n$ be such vectors, so $v, u_2, ..., u_n$ is a basis of $V$.
  Define $S(c_1 v + c_2 u_2 + dots.c + c_n u_n) = c_1 v + c_2 dot 0 + dots.c + c_n dot 0$. Linear map lemma ensures its linearity. Write $T v$ in the basis: $T v = a v + b_2 u_2 + dots.c + b_n u_n$ for some scalars $a, b_2, ..., b_n$. Then $(S T)(v) = S(T v) = a v$. $(T S)(v) = T(S v) = T(v)$, so $T(v) = a v$. Since $a$ depends on $v$, let $lambda_v = a$.
  Let $w in V$ be nonzero. Then there exists scalar $lambda_w$ such that $T w = lambda_w w$. Since $v$ was an arbitrary nonzero vector, every nonzero $u in V$ satisfies $T u = lambda_u u$ for some scalar $lambda_u$.

  Suppose the list $v, w$ is linearly independent. If $v + w = 0$, then $1 dot v + 1 dot w = 0$, contradicting linear independence, so $v + w != 0$. Since $v + w in V$, there exists a scalar $lambda_(v+w)$ such that $T(v + w) = lambda_(v+w) (v + w)$. Hence, by additivity in linear maps, $lambda_v v + lambda_w w = lambda_(v+w) (v + w) = lambda_(v+w) v + lambda_(v+w) w$, thus $(lambda_(v+w) - lambda_v) v + (lambda_(v+w) - lambda_w) w = 0$. Then $lambda_(v+w) - lambda_v = lambda_(v+w) - lambda_w = 0$ by linear independence. Thus $lambda_(v+w) = lambda_v = lambda_w$.

  Suppose the list $v, w$ is linearly dependent. Then there exist scalars $a_1, a_2$, not all $0$, such that $a_1 v + a_2 w = 0$. Suppose $a_1 != 0$. Then $a_1^(-1) a_1 v + a_1^(-1) a_2 w = v + a_1^(-1) a_2 w = 0$, so $v = (-a_1^(-1) a_2) w$, i.e., $v$ is a scalar multiple of $w$, so $v = a w$. Suppose $a = 0$: then $v = 0 w = 0$, contradicting $v != 0$, so $a != 0$. Then $T v = T(a w)$. Hence $T v = lambda_v v = lambda_v a w$ and $T(a w) = a T w = a lambda_w w$, so $lambda_v a w = a lambda_w w$. Then $(lambda_v a - a lambda_w) w = 0$. Since $w != 0$, $a(lambda_v - lambda_w) = 0$. Since $a != 0$, $lambda_v - lambda_w = 0$, so $lambda_v = lambda_w$. Symmetrically, suppose $a_2 != 0$. Then $w = a v$ with $a != 0$. Then $T w = T(a v)$, so $T w = lambda_w a v$ and $T(a v) = a lambda_v v$. Hence $a(lambda_w - lambda_v) v = 0$ with $a != 0$ and $v != 0$, thus $lambda_w - lambda_v = 0$, so $lambda_w = lambda_v$.

  Choose a nonzero $v_0$ and fix $lambda = lambda_(v_0)$. Then for any nonzero $w in V$, the previous cases give $lambda = lambda_(v_0) = lambda_w$, so $T w = lambda w$; $T(0) = 0 = lambda dot 0$. Hence $T w = lambda w = (lambda I) w$ for every $w in V$, so $T = lambda I$.

  Therefore, $T$ is a scalar multiple of the identity if and only if $S T = T S$ for every $S in Lin(V)$.
]

#problem("3A.13", revise: true)[
  Suppose $V$ is finite-dimensional. Prove that every linear map on a subspace of $V$ can be extended to a linear map on $V$. In other words, show that if $U$ is a subspace of $V$ and $S in Lin(U, W)$, then there exists $T in Lin(V, W)$ such that $T u = S u$ for all $u in U$.
]

#proof[
  Let $n = dim V$ and $m = dim U$. Let $u_1, ..., u_m$ be a basis $U$. Let $w_i = S u_i$ for each $i in {1, ..., m}$.

  We can extend the list $u_1, ..., u_m$ to a basis of $V$. Let the list $u_1, ..., u_m, x_1, ..., x_(n-m)$ be such a basis.

  Let $hat(w)_1, dots.c, hat(w)_(n-m) in W$ be arbitrary. By linear map lemma, there exists a linear map $T: V -> W$ such that $T(u_k) = w_k$ for each $k in {1, ..., m}$ and $T(x_j) = hat(w)_j$ for each $j in {1, ..., n-m}$. By additivity and homogeneity,
  $
    T(c_1 u_1 + dots.c + c_m u_m + c_(m+1) x_1 + dots.c + c_n x_(n-m))
    &= c_1 w_1 + dots.c + c_m w_m \
    &quad "" + c_(m+1) dot hat(w)_1 + dots.c + c_n dot hat(w)_(n-m),
  $
  where $c_1, ..., c_n in FF$.

  Let $u in U$ be arbitrary. Then there exists $a_1, ..., a_m in FF$ such that $u = a_1 u_1 + dots.c + a_m u_m$. $S u = a_1 w_1 + dots.c + a_m w_m$ by additivity and homogeneity in $S$. We can rewrite $u = a_1 u_1 + dots.c + a_m u_m = a_1 u_1 + dots.c + a_m u_m + 0 dot x_1 + dots.c + 0 dot x_(n-m)$. Then $T u = a_1 w_1 + dots.c + a_m w_m$.

  Hence $S u = T u$. Since $u$ was arbitrary, $S u = T u$ for all $u in U$.
]


#problem("3A.15")[
  Suppose $v_1, ..., v_m$ is a linearly dependent list of vectors in $V$. Suppose also that $W != {0}$. Prove that there exist $w_1, ..., w_m in W$ such that no $T in Lin(V, W)$ satisfies $T v_k = w_k$ for each $k = 1, ..., m$.
]

#proof[
  Since $v_1, ..., v_m$ is linearly dependent, there exist $a_1, ..., a_m in FF$, not all $0$, such that $a_1 v_1 + dots.c + a_m v_m = 0$. Fix $j$ with $a_j != 0$. Because $W != { 0 }$, choose a nonzero $w in W$, and define $w_j = w$ and $w_k = 0$ for $k != j$.

  Suppose there exists linear map $T in Lin(V, W)$ that satisfies $T v_k = w_k$ for each $k = 1, ..., m$. Then applying $T$ to both sides of the equation $a_1 v_1 + dots.c + a_m v_m = 0$, we have $T(a_1 v_1 + dots.c + a_m v_m) = T(0) = 0$. By linearity, $T(a_1 v_1 + dots.c + a_m v_m) = a_1 T v_1 + dots.c + a_m T v_m = a_1 w_1 + dots.c + a_m w_m = 0$. Then $a_j w_j = 0$. Since $a_j != 0$, multiplying by $1 / a_j$ gives $w_j = w = 0$, a contradiction. Therefore no such $T$ exists.
]

#problem("3A.16")[
  Suppose $V$ is finite-dimensional with $dim V > 1$. Prove that there exist $S, T in Lin(V)$ such that $S T != T S$.
]

#proof[
  Define $m = dim V$. Since $m > 1$, $V != { 0 }$. Let $v_1, ..., v_m$ be a basis of $V$.

  Choose $u = v_1$ and $w = v_m$, where, by linear independence, both vectors are nonzero and $u$ is not multiple of $w$ (and vice versa). Hence $u != w$.

  Take $S in Lin(V)$ such that $S v_k = u$ and $T in Lin(V)$ such that $T v_k = w$ for all $k = 1, ..., m$. Suppose $S T = T S$. $S T v_1 = S w = u$ and $T S v_1 = T u = w$, so $u = w$, a contradiction. Hence $S T != T S$.
]
