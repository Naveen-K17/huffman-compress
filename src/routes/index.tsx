import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { listHistory } from "@/lib/history.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileArchive, TrendingDown, Database, Zap, ArrowRight } from "lucide-react";
import { formatBytes } from "@/lib/huffman";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Huffman Compressor" },
      { name: "description", content: "Overview of compression activity, ratios, and recent files." },
    ],
  }),
  component: Dashboard,
});

function StatCard({ icon: Icon, label, value, hint, accent }: { icon: any; label: string; value: string; hint?: string; accent?: string }) {
  return (
    <Card className="overflow-hidden border-border/60">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent ?? "bg-primary/10 text-primary"}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const fetchHistory = useServerFn(listHistory);
  const { data, isLoading } = useQuery({ queryKey: ["history"], queryFn: () => fetchHistory() });

  const rows = data?.rows ?? [];
  const total = rows.length;
  const avgRatio = total ? rows.reduce((s, r) => s + Number(r.compression_ratio), 0) / total : 0;
  const best = total ? rows.reduce((m, r) => Math.max(m, Number(r.space_saving_pct)), 0) : 0;
  const totalSaved = rows.reduce((s, r) => s + (Number(r.original_size) - Number(r.compressed_size)), 0);

  const chartData = rows.slice(0, 10).reverse().map((r) => ({
    name: r.file_name.slice(0, 12),
    saving: Number(r.space_saving_pct).toFixed(1),
  }));

  return (
    <div className="container mx-auto max-w-7xl space-y-8 p-6 md:p-10">
      <div className="rounded-2xl bg-gradient-hero p-8 text-primary-foreground shadow-xl">
        <p className="text-xs font-medium uppercase tracking-widest opacity-80">Lossless · Prefix-free · Optimal</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight md:text-5xl">Huffman Coding Compressor</h1>
        <p className="mt-3 max-w-2xl text-sm opacity-90">
          Shrink text files with a classic variable-length prefix code. Build the tree, inspect codes, verify integrity, export reports.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="secondary"><Link to="/compress">Compress a file <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          <Button asChild variant="outline" className="border-white/40 bg-white/10 text-primary-foreground hover:bg-white/20"><Link to="/decompress">Decompress .huff</Link></Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FileArchive} label="Files processed" value={String(total)} hint="All time" />
        <StatCard icon={TrendingDown} label="Avg. ratio" value={`${avgRatio.toFixed(2)}×`} hint="Original ÷ compressed" accent="bg-accent/15 text-accent" />
        <StatCard icon={Zap} label="Best saving" value={`${best.toFixed(1)}%`} hint="Top compression" accent="bg-success/15 text-success" />
        <StatCard icon={Database} label="Bytes saved" value={formatBytes(Math.max(0, totalSaved))} hint="Cumulative" accent="bg-warning/15 text-warning" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent space saving</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} unit="%" />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                  <Bar dataKey="saving" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">{isLoading ? "Loading…" : "No compressions yet — try one!"}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent files</CardTitle>
          <Button asChild variant="ghost" size="sm"><Link to="/history">View all</Link></Button>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.file_name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{formatBytes(Number(r.original_size))} → {formatBytes(Number(r.compressed_size))}</span>
                    <Badge variant="secondary">{Number(r.space_saving_pct).toFixed(1)}%</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
