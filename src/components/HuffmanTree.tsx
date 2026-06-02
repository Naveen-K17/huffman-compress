import { useState } from "react";
import type { HuffNode } from "@/lib/huffman";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const printable = (b: number) => {
  if (b === 9) return "\\t";
  if (b === 10) return "\\n";
  if (b === 13) return "\\r";
  if (b === 32) return "␣";
  if (b >= 33 && b <= 126) return String.fromCharCode(b);
  return `0x${b.toString(16)}`;
};

function Node({ node, depth, prefix }: { node: HuffNode; depth: number; prefix: string }) {
  const [open, setOpen] = useState(depth < 2);
  const isLeaf = node.byte !== null;

  return (
    <div className="ml-2">
      <div
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs",
          isLeaf ? "bg-accent/15 text-accent-foreground" : "bg-muted/60"
        )}
      >
        {!isLeaf && (
          <button onClick={() => setOpen(!open)} className="text-muted-foreground hover:text-foreground">
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        )}
        {prefix && <span className="font-mono text-[10px] text-muted-foreground">{prefix}</span>}
        {isLeaf ? (
          <>
            <span className="rounded bg-accent px-1.5 py-0.5 font-mono text-accent-foreground">
              {printable(node.byte!)}
            </span>
            <span className="text-muted-foreground">freq {node.freq}</span>
          </>
        ) : (
          <span className="text-muted-foreground">• internal ({node.freq})</span>
        )}
      </div>
      {!isLeaf && open && (
        <div className="ml-3 mt-1 border-l border-border pl-2">
          {node.left && <Node node={node.left} depth={depth + 1} prefix="0" />}
          {node.right && <Node node={node.right} depth={depth + 1} prefix="1" />}
        </div>
      )}
    </div>
  );
}

export function HuffmanTreeView({ tree }: { tree: HuffNode }) {
  return (
    <div className="max-h-[420px] overflow-auto rounded-lg border bg-card p-3">
      <Node node={tree} depth={0} prefix="" />
    </div>
  );
}
