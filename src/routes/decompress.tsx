import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { decompress, formatBytes, sha256, type DecompressionResult } from "@/lib/huffman";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { FileDropzone } from "@/components/FileDropzone";
import { HuffmanTreeView } from "@/components/HuffmanTree";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, AlertTriangle, Download, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/decompress")({
  head: () => ({
    meta: [
      { title: "Decompress — Huffman" },
      { name: "description", content: "Decode a .huff file back to its original text and verify integrity." },
    ],
  }),
  component: DecompressPage,
});

function download(data: BlobPart, name: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function DecompressPage() {
  const [result, setResult] = useState<DecompressionResult | null>(null);
  const [fileName, setFileName] = useState("output.txt");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expectedHash, setExpectedHash] = useState("");
  const [verifyResult, setVerifyResult] = useState<null | { ok: boolean; original?: string }>(null);

  const onFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".huff")) {
      toast.error("Please upload a .huff file");
      return;
    }
    setBusy(true); setProgress(20);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      setProgress(55);
      const r = await decompress(buf);
      setProgress(95);
      setFileName(file.name.replace(/\.huff$/i, ".txt"));
      setResult(r);
      setVerifyResult(null);
      toast.success(`Decoded ${formatBytes(r.bytes.length)}`);
    } catch (e: any) {
      toast.error(e.message ?? "Decompression failed");
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(0), 600);
    }
  };

  const verifyAgainstFile = async (file: File) => {
    if (!result) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const h = await sha256(bytes);
    setExpectedHash(h);
    setVerifyResult({ ok: h === result.hash, original: h });
  };

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6 md:p-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Decompress</h1>
        <p className="text-sm text-muted-foreground">Upload a .huff file to reconstruct the original text.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <FileDropzone onFile={onFile} accept=".huff" label="Drop a .huff file to decompress" />
          {busy && <Progress value={progress} className="mt-4" />}
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">Original length: {formatBytes(result.originalLength)}</Badge>
            <Badge variant="secondary">Symbols: {Object.keys(result.codes).length}</Badge>
            <Button onClick={() => {
              const ab = result.bytes.buffer.slice(result.bytes.byteOffset, result.bytes.byteOffset + result.bytes.byteLength) as ArrayBuffer;
              download(ab, fileName);
            }}><Download className="mr-2 h-4 w-4" /> Download decoded</Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Integrity verification</CardTitle>
              <p className="text-sm text-muted-foreground">Upload the original file to compare SHA-256 hashes, or paste the expected hash manually.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">Decoded hash</Label>
                <p className="mt-1 break-all rounded-md bg-muted p-2 font-mono text-xs">{result.hash}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Compare with original file</Label>
                  <input
                    type="file"
                    className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
                    onChange={(e) => e.target.files?.[0] && verifyAgainstFile(e.target.files[0])}
                  />
                </div>
                <div>
                  <Label className="text-xs">Or paste expected SHA-256</Label>
                  <Input
                    value={expectedHash}
                    onChange={(e) => {
                      setExpectedHash(e.target.value);
                      setVerifyResult({ ok: e.target.value.trim().toLowerCase() === result.hash });
                    }}
                    placeholder="e.g. 3a7bd3e2360a..."
                    className="mt-1 font-mono text-xs"
                  />
                </div>
              </div>
              {verifyResult && (
                <div className={`flex items-center gap-2 rounded-md border p-3 text-sm ${verifyResult.ok ? "border-success/40 bg-success/10 text-success" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
                  {verifyResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  {verifyResult.ok ? "Integrity verified — hashes match." : "Hash mismatch — content differs."}
                </div>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="text">
            <TabsList>
              <TabsTrigger value="text">Decoded text</TabsTrigger>
              <TabsTrigger value="tree">Reconstructed tree</TabsTrigger>
            </TabsList>
            <TabsContent value="text">
              <Card>
                <CardContent className="pt-6">
                  <pre className="max-h-[480px] overflow-auto rounded-md bg-muted p-4 text-xs whitespace-pre-wrap">{result.text.slice(0, 5000)}{result.text.length > 5000 ? "\n\n… (truncated preview)" : ""}</pre>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="tree">
              <Card>
                <CardContent className="pt-6">
                  <HuffmanTreeView tree={result.tree} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
