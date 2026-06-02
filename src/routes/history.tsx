import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listHistory, deleteHistory } from "@/lib/history.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Search } from "lucide-react";
import { formatBytes } from "@/lib/huffman";
import { toast } from "sonner";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History — Huffman" },
      { name: "description", content: "All previously compressed files with sizes and ratios." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const fetchHistory = useServerFn(listHistory);
  const delFn = useServerFn(deleteHistory);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["history"], queryFn: () => fetchHistory() });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["history"] }); toast.success("Removed"); },
  });
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const list = data?.rows ?? [];
    if (!q) return list;
    return list.filter((r) => r.file_name.toLowerCase().includes(q.toLowerCase()));
  }, [data, q]);

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6 md:p-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground">Every file you've compressed in this workspace.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All files</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Original</TableHead>
                  <TableHead>Compressed</TableHead>
                  <TableHead>Ratio</TableHead>
                  <TableHead>Saved</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">No records.</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.file_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</TableCell>
                    <TableCell>{formatBytes(Number(r.original_size))}</TableCell>
                    <TableCell>{formatBytes(Number(r.compressed_size))}</TableCell>
                    <TableCell>{Number(r.compression_ratio).toFixed(2)}×</TableCell>
                    <TableCell><Badge variant="secondary">{Number(r.space_saving_pct).toFixed(1)}%</Badge></TableCell>
                    <TableCell><Badge variant={r.status === "success" ? "default" : "destructive"}>{r.status}</Badge></TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
