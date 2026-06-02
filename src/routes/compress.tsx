import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { compress, formatBytes, type CompressionResult } from "@/lib/huffman";
import { addHistory } from "@/lib/history.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDropzone } from "@/components/FileDropzone";
import { HuffmanTreeView } from "@/components/HuffmanTree";
import { Download, FileText, FileDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/compress")({
  head: () => ({
    meta: [
      { title: "Compress — Huffman" },
      { name: "description", content: "Upload a text file and compress it with Huffman coding." },
    ],
  }),
  component: CompressPage,
});

function downloadBlob(data: BlobPart, name: string, type = "application/octet-stream") {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function CompressPage() {
  const [fileName, setFileName] = useState<string>("input.txt");
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sortKey, setSortKey] = useState<"freq" | "char" | "len">("freq");

  const addFn = useServerFn(addHistory);
  const qc = useQueryClient();
  const persist = useMutation({
    mutationFn: (vars: Parameters<typeof addFn>[0]["data"]) => addFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["history"] }),
  });

  const onFile = async (file: File) => {
    if (!file.name.match(/\.(txt|md|csv|json|log|xml|html|js|ts|tsx|css)$/i)) {
      toast.error("Please upload a text-based file (.txt, .md, .csv, .json, ...)");
      return;
    }
    setBusy(true); setProgress(15); setFileName(file.name);
    try {
      const text = await file.text();
      setProgress(45);
      const r = await compress(text, file.name);
      setProgress(85);
      setResult(r);
      await persist.mutateAsync({
        file_name: file.name,
        original_size: r.originalSize,
        compressed_size: r.compressedSize,
        compression_ratio: Number(r.compressionRatio.toFixed(4)),
        space_saving_pct: Number(r.spaceSavingPct.toFixed(4)),
        original_hash: r.originalHash,
        status: r.spaceSavingPct > 0 ? "success" : "expanded",
      });
      setProgress(100);
      toast.success(`Compressed ${file.name} — ${r.spaceSavingPct.toFixed(1)}% saved`);
    } catch (e: any) {
      toast.error(e.message ?? "Compression failed");
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(0), 600);
    }
  };

  const sortedFreqs = useMemo(() => {
    if (!result) return [];
    const arr = [...result.frequencies];
    if (sortKey === "freq") arr.sort((a, b) => b.freq - a.freq);
    else if (sortKey === "char") arr.sort((a, b) => a.byte - b.byte);
    else arr.sort((a, b) => a.codeLength - b.codeLength);
    return arr;
  }, [result, sortKey]);

  const downloadHuff = () => {
    if (!result) return;
    downloadBlob(result.compressedBytes as unknown as Uint8Array, fileName.replace(/\.[^.]+$/, "") + ".huff");
  };

  const exportPdf = () => {
    if (!result) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Huffman Compression Report", 14, 18);
    doc.setFontSize(10);
    doc.text(`File: ${fileName}`, 14, 26);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 32);

    autoTable(doc, {
      startY: 40,
      head: [["Metric", "Value"]],
      body: [
        ["Original size", formatBytes(result.originalSize)],
        ["Compressed size", formatBytes(result.compressedSize)],
        ["Compression ratio", `${result.compressionRatio.toFixed(3)}×`],
        ["Space saving", `${result.spaceSavingPct.toFixed(2)}%`],
        ["Average code length", `${result.averageCodeLength.toFixed(3)} bits/sym`],
        ["Fixed-length comparison", `${result.fixedLengthBits} bits/sym`],
        ["SHA-256 (original)", result.originalHash],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [99, 102, 241] },
    });

    autoTable(doc, {
      head: [["Char", "Byte", "Freq", "Prob", "Code", "Len"]],
      body: result.frequencies.slice(0, 80).map(r => [r.char, r.byte, r.freq, r.probability.toFixed(4), r.code, r.codeLength]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [99, 102, 241] },
    });

    doc.save(fileName.replace(/\.[^.]+$/, "") + "_huffman_report.pdf");
  };

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6 md:p-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Compress</h1>
        <p className="text-sm text-muted-foreground">Upload a text file to encode it with a Huffman tree.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <FileDropzone onFile={onFile} accept=".txt,.md,.csv,.json,.log,.xml,.html,.js,.ts,.tsx,.css,text/*" label="Drop a text file to compress" />
          {busy && <Progress value={progress} className="mt-4" />}
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Original" value={formatBytes(result.originalSize)} />
            <Stat label="Compressed" value={formatBytes(result.compressedSize)} accent />
            <Stat label="Ratio" value={`${result.compressionRatio.toFixed(2)}×`} />
            <Stat label="Saved" value={`${result.spaceSavingPct.toFixed(1)}%`} accent />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={downloadHuff}><Download className="mr-2 h-4 w-4" /> Download .huff</Button>
            <Button variant="outline" onClick={exportPdf}><FileDown className="mr-2 h-4 w-4" /> Export PDF report</Button>
          </div>

          <Tabs defaultValue="freq" className="space-y-4">
            <TabsList>
              <TabsTrigger value="freq">Frequencies</TabsTrigger>
              <TabsTrigger value="codes">Codes</TabsTrigger>
              <TabsTrigger value="tree">Tree</TabsTrigger>
              <TabsTrigger value="analysis">Analysis</TabsTrigger>
              <TabsTrigger value="bits">Bitstream</TabsTrigger>
            </TabsList>

            <TabsContent value="freq">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Frequency table</CardTitle>
                  <div className="flex gap-1">
                    {(["freq", "char", "len"] as const).map((k) => (
                      <Button key={k} variant={sortKey === k ? "default" : "ghost"} size="sm" onClick={() => setSortKey(k)}>
                        {k === "freq" ? "by frequency" : k === "char" ? "by byte" : "by length"}
                      </Button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                    <div className="max-h-[420px] overflow-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow><TableHead>Char</TableHead><TableHead>ASCII</TableHead><TableHead>Freq</TableHead><TableHead>Prob</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedFreqs.map((r) => (
                            <TableRow key={r.byte}>
                              <TableCell className="font-mono">{r.char}</TableCell>
                              <TableCell>{r.byte}</TableCell>
                              <TableCell>{r.freq}</TableCell>
                              <TableCell>{(r.probability * 100).toFixed(2)}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="h-[420px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sortedFreqs.slice(0, 25)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                          <XAxis dataKey="char" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                          <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                          <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                          <Bar dataKey="freq" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="codes">
              <Card>
                <CardHeader>
                  <CardTitle>Huffman codes</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Average code length: <Badge variant="secondary">{result.averageCodeLength.toFixed(3)} bits/sym</Badge>{" "}
                    vs. fixed-length: <Badge variant="outline">{result.fixedLengthBits} bits/sym</Badge>
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[500px] overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Char</TableHead><TableHead>Freq</TableHead><TableHead>Code</TableHead><TableHead>Length</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.frequencies.map((r) => (
                          <TableRow key={r.byte}>
                            <TableCell className="font-mono">{r.char}</TableCell>
                            <TableCell>{r.freq}</TableCell>
                            <TableCell className="font-mono text-primary">{r.code}</TableCell>
                            <TableCell>{r.codeLength}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tree">
              <Card>
                <CardHeader>
                  <CardTitle>Huffman tree</CardTitle>
                  <p className="text-sm text-muted-foreground">Click chevrons to expand internal nodes. Leaves carry the encoded byte.</p>
                </CardHeader>
                <CardContent>
                  <HuffmanTreeView tree={result.tree} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analysis">
              <Card>
                <CardHeader><CardTitle>Compression analysis</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: "Compressed", value: result.compressedSize },
                              { name: "Saved", value: Math.max(0, result.originalSize - result.compressedSize) },
                            ]}
                            dataKey="value" nameKey="name" innerRadius={60} outerRadius={110} paddingAngle={2}
                          >
                            <Cell fill="var(--color-primary)" />
                            <Cell fill="var(--color-success)" />
                          </Pie>
                          <Legend />
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[
                          { name: "Fixed-length", bits: result.fixedLengthBits * result.originalSize },
                          { name: "Huffman", bits: Math.round(result.averageCodeLength * result.originalSize) },
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                          <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                          <Tooltip />
                          <Bar dataKey="bits" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bits">
              <Card>
                <CardHeader><CardTitle>Encoded bitstream (preview)</CardTitle></CardHeader>
                <CardContent>
                  <pre className="max-h-80 overflow-auto rounded-md bg-muted p-4 text-xs font-mono break-all">{result.encodedBits}{result.encodedBits.length >= 512 ? " …" : ""}</pre>
                  <p className="mt-3 text-xs text-muted-foreground">SHA-256: <span className="font-mono">{result.originalHash}</span></p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`mt-2 text-2xl font-semibold ${accent ? "text-gradient" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
