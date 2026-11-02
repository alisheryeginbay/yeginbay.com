// Components posts use without importing them, for the post page and the
// feeds alike.
import LinkList from "./LinkList.astro";
import SetWords from "./viz/Set.astro";
import Show from "./viz/Show.astro";
import Var from "./viz/Var.astro";
import Viz from "./viz/Viz.astro";

export const postComponents = { LinkList, Set: SetWords, Show, Var, Viz };
