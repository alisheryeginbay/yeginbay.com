<!--
  A Connect 4 board to play on. Columns are numbered 0–6, as in the connect4
  repository, and the game is written out below the board as the model reads
  it: BOS, the columns played, then END once it's over.

    moves     the columns played so far, as digits ("3342"); bindable, so the
              address can hold a position
    opponent  "random" to play against uniformly random legal moves, like the
              generated training games, or "none" for two players
    name      publishes the game as `name`: { tokens, moves, turn, winner }
-->
<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { cubicInOut } from "svelte/easing";
  import { prefersReducedMotion } from "svelte/motion";
  import { draw } from "svelte/transition";
  import { publish } from "../store.svelte.ts";
  import Button from "../ui/Button.svelte";
  import Controls from "../ui/Controls.svelte";
  import Select from "../ui/Select.svelte";
  import Status from "../ui/Status.svelte";

  interface Props {
    moves?: string | number;
    opponent?: string;
    name?: string;
  }

  let { moves = $bindable(), opponent: startingOpponent = "random", name }: Props = $props();

  const ROWS = 6;
  const COLS = 7;
  const FIRST = 1;
  const SECOND = -1;
  // Directions a four can run: across, up, and both diagonals.
  const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];

  // Board geometry, in SVG units: one cell is S across, and a row of S above
  // the board holds the disc about to drop.
  const S = 10;
  const R = 0.37 * S;
  const x = (col: number) => col * S + S / 2;
  const y = (row: number) => (ROWS - 1 - row) * S + S / 2;

  type Cell = [row: number, col: number];

  // The game the moves describe, up to the first move that isn't legal.
  function replay(text: string) {
    const board: number[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    const heights: number[] = Array(COLS).fill(0);
    const cells: Cell[] = [];
    let winner = 0;
    let four: Cell[] = [];
    for (const ch of text) {
      const col = Number(ch);
      if (!/^[0-6]$/.test(ch) || heights[col] === ROWS || winner) break;
      const row = heights[col]++;
      const player = cells.length % 2 === 0 ? FIRST : SECOND;
      board[row][col] = player;
      cells.push([row, col]);
      four = fourThrough(board, row, col);
      if (four.length) winner = player;
    }
    const turn = cells.length % 2 === 0 ? FIRST : SECOND;
    const over = winner !== 0 || cells.length === ROWS * COLS;
    return { heights, cells, winner, four, turn, over };
  }

  // The cells of a line of four or more through a new piece, if there is one.
  function fourThrough(board: number[][], row: number, col: number): Cell[] {
    const piece = board[row][col];
    for (const [dr, dc] of DIRECTIONS) {
      const line: Cell[] = [[row, col]];
      for (const sign of [1, -1]) {
        let [r, c] = [row + sign * dr, col + sign * dc];
        while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === piece) {
          line.push([r, c]);
          [r, c] = [r + sign * dr, c + sign * dc];
        }
      }
      if (line.length >= 4) return line.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    }
    return [];
  }

  const game = $derived(replay(String(moves ?? "")));
  const legal = $derived(game.over ? [] : [...Array(COLS).keys()].filter((c) => game.heights[c] < ROWS));

  let opponent = $state(untrack(() => startingOpponent));
  const againstRandom = $derived(opponent === "random");
  const randomsTurn = $derived(againstRandom && !game.over && game.turn === SECOND);

  function play(col: number) {
    if (legal.includes(col)) moves = game.cells.map(([, c]) => c).join("") + col;
  }

  function setMoves(count: number) {
    // No moves is the post's starting position, not a choice to keep in the address.
    moves = count > 0 ? game.cells.slice(0, count).map(([, c]) => c).join("") : undefined;
  }

  // Taking back a move against the random player takes back its reply too,
  // so it's the reader's turn again.
  function undo() {
    const back = againstRandom && game.turn === FIRST && game.cells.length >= 2 ? 2 : 1;
    setMoves(game.cells.length - back);
  }

  $effect(() => {
    if (!randomsTurn) return;
    const options = legal;
    const timer = setTimeout(
      () => play(options[Math.floor(Math.random() * options.length)]),
      prefersReducedMotion.current ? 0 : 450,
    );
    return () => clearTimeout(timer);
  });

  // The column the reader is aiming at, and the move they're pointing at in
  // the transcript.
  let aiming: number | undefined = $state();
  let pointing: number | undefined = $state();

  const canPlay = $derived(!game.over && !randomsTurn);

  const color = (player: number) => (player === FIRST ? "var(--fg)" : "var(--link)");
  const nameOf = (player: number) => (againstRandom ? (player === FIRST ? "You" : "Random") : player === FIRST ? "First player" : "Second player");

  const status = $derived(
    game.winner ? `${nameOf(game.winner)} ${againstRandom && game.winner === FIRST ? "win" : "wins"}`
    : game.over ? "Draw"
    : againstRandom ? (game.turn === FIRST ? "Your move" : "Random is moving…")
    : `${nameOf(game.turn)} to move`,
  );

  const tokens = $derived(["BOS", ...game.cells.map(([, c]) => String(c)), ...(game.over ? ["END"] : [])]);

  // Discs already on the board when the figure is drawn don't fall.
  let drawn = false;
  onMount(() => { drawn = true; });

  // A disc falling `distance` SVG units under gravity, then bouncing on
  // whatever it lands on, each bounce leaving with a fraction of the speed it
  // arrived with, until the bounces are too small to see. A cell is about
  // 26mm across on a real board, so real gravity would be some 3,800 units/s²;
  // this is far less, so a drop down the whole board takes about half a
  // second and can be followed.
  const GRAVITY = 480;
  const RESTITUTION = 0.25;
  const SETTLED = 0.15;

  // How far above its resting place the disc is at each moment, in seconds,
  // and how long until it comes to rest.
  function fall(distance: number): { duration: number; height: (time: number) => number } {
    const landing = Math.sqrt((2 * distance) / GRAVITY);
    const bounces: { start: number; speed: number }[] = [];
    let start = landing;
    for (let speed = GRAVITY * landing * RESTITUTION; speed ** 2 / (2 * GRAVITY) > SETTLED; speed *= RESTITUTION) {
      bounces.push({ start, speed });
      start += (2 * speed) / GRAVITY;
    }
    return {
      duration: start,
      height(time) {
        if (time < landing) return distance - (GRAVITY * time ** 2) / 2;
        const bounce = bounces.findLast((b) => time >= b.start);
        if (!bounce) return 0;
        const since = time - bounce.start;
        return Math.max(0, bounce.speed * since - (GRAVITY * since ** 2) / 2);
      },
    };
  }

  const animated = () => drawn && !prefersReducedMotion.current;

  // Once a game is won, the winning disc comes to rest before the four are
  // marked: the line is drawn across them and the other discs fade. An undone
  // win is unmarked straight away.
  let marked = $state(false);
  $effect(() => {
    if (!game.winner) {
      marked = false;
      return;
    }
    const [row] = game.cells[game.cells.length - 1];
    const settle = animated() ? fall(y(row) + S / 2).duration * 1000 : 0;
    const timer = setTimeout(() => (marked = true), settle);
    return () => clearTimeout(timer);
  });

  function drop(node: SVGElement, { distance }: { distance: number }) {
    if (!animated()) return { duration: 0 };
    const { duration, height } = fall(distance);
    return {
      duration: duration * 1000,
      tick: (t: number) => node.setAttribute("transform", `translate(0 ${-height(t * duration)})`),
    };
  }

  // Arrow keys move between the columns that can still take a disc.
  function key(e: KeyboardEvent, col: number) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const to = legal.filter((c) => (c - col) * step > 0).sort((a, b) => (a - b) * step)[0];
    if (to !== undefined) ((e.currentTarget as HTMLElement).parentElement!.children[to] as HTMLElement).focus();
  }

  const id = $props.id();

  untrack(() => {
    if (!name) return;
    publish(name, () => ({
      tokens: tokens.join(" "),
      moves: game.cells.length,
      turn: game.over ? "" : game.turn === FIRST ? "first" : "second",
      winner: game.winner ? (game.winner === FIRST ? "first" : "second") : game.over ? "draw" : "",
    }));
  });
</script>

<div class="connect4">
  <Controls>
    <Select
      label="Opponent"
      bind:value={opponent}
      options={[{ value: "random", label: "Against random moves" }, { value: "none", label: "Two players" }]}
    />
    <Button onclick={undo} disabled={!game.cells.length || randomsTurn}>Undo</Button>
    <Button onclick={() => setMoves(0)} disabled={!game.cells.length}>New game</Button>
  </Controls>

  <div class="board">
    <svg viewBox="0 {-S} {COLS * S} {(ROWS + 1) * S}" role="img" aria-label="Connect 4 board, {status}">
      <defs>
        <mask id="{id}-holes">
          <rect x="0" y="0" width={COLS * S} height={ROWS * S} fill="white" />
          {#each { length: ROWS }, row}
            {#each { length: COLS }, col}
              <circle cx={x(col)} cy={y(row)} r={R} fill="black" />
            {/each}
          {/each}
        </mask>

        <!-- Each player's disc: lit from the upper left, darker toward the edge. -->
        {#each [[FIRST, "var(--fg)"], [SECOND, "var(--link)"]] as [player, base] (player)}
          <radialGradient id="{id}-disc{player}" cx="0.38" cy="0.32" r="0.75">
            <stop offset="0" style:stop-color="color-mix(in oklab, {base} 90%, white)" />
            <stop offset="0.7" style:stop-color={base} />
            <stop offset="1" style:stop-color="color-mix(in oklab, {base} 92%, black)" />
          </radialGradient>
        {/each}

        <!-- The board's lip shades the top of each hole. -->
        <linearGradient id="{id}-lip" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="black" stop-opacity="0.07" />
          <stop offset="0.4" stop-color="black" stop-opacity="0" />
        </linearGradient>
      </defs>

      <!-- A disc, with a hint of the raised ring of a real one. -->
      {#snippet disc(cx: number, cy: number, player: number)}
        <circle {cx} {cy} r={R} fill="url(#{id}-disc{player})" />
        <circle class="ring" {cx} {cy} r={R * 0.68} />
      {/snippet}

      {#if aiming !== undefined && canPlay && legal.includes(aiming)}
        <g opacity="0.35">{@render disc(x(aiming), -S / 2, game.turn)}</g>
      {/if}

      {#each game.cells as [row, col], i (i)}
        <g in:drop={{ distance: y(row) + S / 2 }}>
          <g class="disc" class:faded={marked && !game.four.some(([r, c]) => r === row && c === col)}>
            {@render disc(x(col), y(row), i % 2 === 0 ? FIRST : SECOND)}
            {#if pointing === i}
              <circle class="pointed" cx={x(col)} cy={y(row)} r={R} />
            {/if}
            {#if i === game.cells.length - 1 && !game.winner}
              <circle cx={x(col)} cy={y(row)} r={0.07 * S} fill="var(--bg)" />
            {/if}
          </g>
        </g>
      {/each}

      <rect class="frame" x="0" y="0" width={COLS * S} height={ROWS * S} rx="2" mask="url(#{id}-holes)" />
      {#each { length: ROWS }, row}
        {#each { length: COLS }, col}
          <circle class="lip" cx={x(col)} cy={y(row)} r={R - 0.5} stroke="url(#{id}-lip)" />
          <circle class="rim" cx={x(col)} cy={y(row)} r={R} />
        {/each}
      {/each}

      {#if marked && game.winner}
        {@const [a, b] = [game.four[0], game.four[game.four.length - 1]]}
        <line
          class="four"
          x1={x(a[1])}
          y1={y(a[0])}
          x2={x(b[1])}
          y2={y(b[0])}
          in:draw={{ duration: animated() ? 600 : 0, easing: cubicInOut }}
        />
      {/if}
    </svg>

    <div class="columns">
      {#each { length: COLS }, col}
        <button
          type="button"
          aria-label="Drop in column {col}"
          disabled={!canPlay || !legal.includes(col)}
          onclick={() => play(col)}
          onpointerenter={() => (aiming = col)}
          onpointerleave={() => (aiming = undefined)}
          onfocus={() => (aiming = col)}
          onblur={() => (aiming = undefined)}
          onkeydown={(e) => key(e, col)}
        ></button>
      {/each}
    </div>
  </div>

  <p class="tokens" aria-label="The game as tokens">
    {#each tokens as token, i}
      {@const move = i - 1}
      <span
        class:special={token === "BOS" || token === "END"}
        class:pointed={pointing === move}
        role="presentation"
        onpointerenter={() => { if (move >= 0 && move < game.cells.length) pointing = move; }}
        onpointerleave={() => (pointing = undefined)}
      >{token}</span>{" "}
    {/each}
  </p>

  <Status>
    <svg class="turn" viewBox="0 0 10 10" aria-hidden="true">
      <circle cx="5" cy="5" r="4.5" fill={color(game.winner || game.turn)} />
    </svg>
    {status}{#if game.cells.length}&nbsp;· move {game.cells.length}{/if}
  </Status>
</div>

<style>
  .connect4 { text-align: center; }

  .connect4 :global(.controls) { justify-content: center; }

  .board {
    position: relative;
    max-width: 26rem;
    margin-inline: auto;
  }

  .board > svg {
    display: block;
    width: 100%;
    overflow: visible;
  }

  .frame { fill: var(--code-bg); }

  .rim {
    fill: none;
    stroke: var(--rule);
    stroke-width: 0.5;
  }

  /* Fading only on the way out: an undone win brings the discs straight back. */
  .faded {
    opacity: 0.3;
    transition: opacity 600ms ease-in-out;
  }

  @media (prefers-reduced-motion: reduce) {
    .faded { transition: none; }
  }

  .ring {
    fill: none;
    stroke: black;
    stroke-opacity: 0.1;
    stroke-width: 0.3;
  }

  .lip {
    fill: none;
    stroke-width: 0.8;
  }

  .pointed {
    fill: none;
    stroke: var(--highlight);
    stroke-width: 1.4;
  }

  .four {
    stroke: var(--highlight);
    stroke-width: 1.6;
    stroke-linecap: round;
  }

  .columns {
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
  }

  .columns button {
    display: block;
    width: 100%;
    height: 100%;
    padding: 0;
    background: none;
    border: 0;
    border-radius: 4px;
    cursor: pointer;
  }

  .columns button:disabled { cursor: default; }

  .columns button:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--highlight) 70%, transparent);
    outline-offset: -2px;
  }

  .tokens {
    margin: 0.75rem 0 0;
    text-indent: 0;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    line-height: 1.6;
    word-spacing: 0.15em;
  }

  .tokens span { border-radius: 3px; }

  .tokens .special { color: var(--muted); }

  .tokens .pointed { background: color-mix(in srgb, var(--highlight) 45%, transparent); }

  .turn {
    width: 0.6em;
    height: 0.6em;
    margin-right: 0.35em;
    vertical-align: 0;
  }
</style>
