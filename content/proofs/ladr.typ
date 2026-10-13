#metadata((
  title: "Linear Algebra Done Right: Proofs",
  date: "2026-10-13T12:00:00+05:00",
  status: "notes",
  tags: ("mathematics",),
  aliases: ("/ladr-proofs",),
)) <frontmatter>

#import "@preview/theorion:0.4.1": *
#show: show-theorion

Proofs for the exercises in Sheldon Axler's _Linear Algebra Done Right_, 4th edition.

= Vector spaces


#theorem(title: "Euclid")[
  There are infinitely many primes.
] <thm:euclid>

#proof[
  Suppose there are finitely many primes $p_1, ..., p_n$. Let
  $ N = p_1 p_2 dots.c p_n + 1. $
  No $p_i$ divides $N$, so $N$ has a prime factor outside the list.
  Contradiction.
]

See @thm:euclid.

$ T in cal(L)(V, W) => "null" T "is a subspace of" V $

Inline $u + v in "null" T$ and a note.#footnote[A _footnote_ with $x^2$.]

== Exercise 1A.1 <ex-1a1>

*Proof.* Trivial.

```python
print(1)
```

= Linear maps

#theorem[
  Suppose $V$ is finite-dimensional. Prove that every linear map on a subspace of $V$ can be extended to a linear map on $V$. In other words, show that if $U$ is a subspace of $V$ and $S in cal(L)(U, W)$, then there exists $T in cal(L)(V, W)$ such that $T u = S u$ for all $u in U$.
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
  where $c_1, ..., c_n in bold(F)$.

  Let $u in U$ be arbitrary. Then there exists $a_1, ..., a_m in bold(F)$ such that $u = a_1 u_1 + dots.c + a_m u_m$. $S u = a_1 w_1 + dots.c + a_m w_m$ by additivity and homogeneity in $S$. We can rewrite $u = a_1 u_1 + dots.c + a_m u_m = a_1 u_1 + dots.c + a_m u_m + 0 dot x_1 + dots.c + 0 dot x_(n-m)$. Then $T u = a_1 w_1 + dots.c + a_m w_m$.

  Hence $S u = T u$. Since $u$ was arbitrary, $S u = T u$ for all $u in U$.
]
