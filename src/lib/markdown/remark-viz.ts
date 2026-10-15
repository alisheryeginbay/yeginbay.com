// Checks the shared values a post's interactive figures and the prose bound
// to them use (<Viz>, <Var>, <Set> and <Show>, in src/components/viz/), and
// fails the build when the prose refers to one nothing on the page provides,
// which is usually a typo: a <Set> of a value no <Var> declares and no
// figure is bound to, or a <Show> of a value nothing declares or publishes.
//
// Also gives a <Show> of a <Var> that comes before it in the post the
// <Var>'s starting value as its fallback, for readers without JavaScript.
import type { Root } from "mdast";
import type { MdxJsxAttribute, MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";
import { boundName, varState, type VarProps } from "../../viz/prose.ts";

type Jsx = MdxJsxFlowElement | MdxJsxTextElement;

// A prop's value: a string, or a literal written as {…}.
function props(node: Jsx): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const attr of node.attributes) {
    if (attr.type !== "mdxJsxAttribute") continue;
    const v = attr.value;
    if (v === null || v === undefined) out[attr.name] = true;
    else if (typeof v === "string") out[attr.name] = v;
    else {
      try {
        out[attr.name] = JSON.parse(v.value);
      } catch {
        out[attr.name] = v.value;
      }
    }
  }
  return out;
}

export default function remarkViz() {
  return (tree: Root, file: VFile) => {
    const declared = new Set<string>();
    const bound = new Set<string>();
    const published = new Set<string>();
    const set = new Set<string>();
    const read = new Set<string>();
    const text = new Map<string, string>();
    const where = (node: Jsx) => `${file.path}:${node.position?.start.line ?? "?"}`;

    visit(tree, ["mdxJsxFlowElement", "mdxJsxTextElement"], (n) => {
      const node = n as Jsx;
      const p = props(node);
      switch (node.name) {
        case "Viz": {
          for (const [k, v] of Object.entries(p)) {
            const name = boundName(v);
            if (name && !["is", "width", "caption"].includes(k)) bound.add(name);
          }
          if (typeof p.name === "string") published.add(p.name);
          break;
        }
        case "Var": {
          let state;
          try {
            state = varState(p as VarProps);
          } catch (err) {
            throw new Error(`${(err as Error).message} at ${where(node)}`);
          }
          const name = p.name as string;
          declared.add(name);
          if (!text.has(name)) text.set(name, state.text);
          const options = boundName(p.options);
          if (options) read.add(options.split(".")[0]);
          break;
        }
        case "Set": {
          if (Object.keys(p).length === 0) throw new Error(`Set: needs a value to set at ${where(node)}`);
          for (const k of Object.keys(p)) set.add(k);
          break;
        }
        case "Show": {
          const path = p.path;
          if (typeof path !== "string" || !path) throw new Error(`Show: needs a path at ${where(node)}`);
          const root = path.split(".")[0];
          read.add(root);
          if (p.fallback === undefined && root === path && text.has(root)) {
            node.attributes.push({ type: "mdxJsxAttribute", name: "fallback", value: text.get(root)! } satisfies MdxJsxAttribute);
          }
          break;
        }
      }
    });

    const changeable = new Set([...declared, ...bound]);
    for (const name of set) {
      if (!changeable.has(name)) throw new Error(`viz: ${file.path} sets "${name}", but no Var declares it and no figure is bound to it`);
    }
    for (const name of read) {
      // A figure publishing `qk` also publishes names like `qk_heads`.
      const found = changeable.has(name) || set.has(name) || [...published].some((p) => name === p || name.startsWith(`${p}_`));
      if (!found) throw new Error(`viz: ${file.path} shows "${name}", but nothing on the page declares or publishes it`);
    }
  };
}
