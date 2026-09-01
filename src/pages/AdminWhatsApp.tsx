import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const ENDPOINT = `https://${PROJECT_ID}.supabase.co/functions/v1/whatsapp-suggestion-webhook`;

const camposObrigatorios: Array<[string, string, string]> = [
  ['nome', 'texto', 'Nome do cidadão'],
  ['telefone', 'texto', 'WhatsApp completo com DDI e DDD (ex.: 5541999999999)'],
  ['municipio', 'texto', 'Nome oficial do município do Paraná'],
  ['sugestao', 'texto', 'Texto da demanda/sugestão (aceita também "descricao")'],
  ['external_id', 'texto', 'ID único da conversa no sistema do fornecedor (idempotência)'],
];

const camposOpcionais: Array<[string, string, string]> = [
  ['email', 'texto', 'E-mail do cidadão, quando informado'],
  ['tema_ids', 'array de UUID', 'IDs dos temas, se o fornecedor já classificar'],
  ['tema_nomes', 'array de texto', 'Nomes dos temas — a plataforma resolve os IDs'],
];

const codigos: Array<[string, string]> = [
  ['201', 'Sugestão registrada com sucesso'],
  ['409', 'Mensagem já processada (mesmo external_id) — não reenviar'],
  ['400', 'Payload inválido — conferir campos obrigatórios'],
  ['401', 'Token inválido ou ausente — conferir o header X-Ingest-Token'],
  ['405', 'Método não permitido — o webhook aceita apenas POST'],
];

export default function AdminWhatsApp() {
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('whatsapp_ingest_config' as any)
        .select('token')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        toast.error('Não foi possível carregar o token de ingestão.');
      } else {
        setToken(((data as any)?.token as string) ?? '');
      }
      setLoading(false);
    };
    load();
  }, []);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado para a área de transferência.`);
    } catch {
      toast.error('Não foi possível copiar automaticamente. Copie manualmente.');
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    const { data, error } = await supabase.rpc('regenerate_whatsapp_token' as any);
    setRegenerating(false);
    setConfirmOpen(false);

    if (error || !data) {
      toast.error('Falha ao gerar um novo token.');
      return;
    }
    setToken(data as unknown as string);
    setRevealed(true);
    toast.success('Novo token gerado. Envie-o ao fornecedor — o anterior deixou de funcionar.');
  };

  const masked = token ? `${token.slice(0, 6)}${'•'.repeat(24)}${token.slice(-4)}` : '';

  const exemploJson = `{
  "nome": "Maria da Silva",
  "telefone": "5541999999999",
  "municipio": "Curitiba",
  "sugestao": "Precisamos de mais leitos de UTI na região metropolitana.",
  "external_id": "conv-2026-000123"
}`;

  const exemploCurl = `curl -X POST "${ENDPOINT}" \\
  -H "Content-Type: application/json" \\
  -H "X-Ingest-Token: <TOKEN>" \\
  -d '${exemploJson.replace(/\n\s*/g, ' ')}'`;

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-display font-bold">Integração WhatsApp</h1>
              <p className="text-sm text-muted-foreground">
                Pacote técnico para o fornecedor homologado
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Endpoint */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="w-4 h-4" /> Endpoint de ingestão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm break-all">
                {ENDPOINT}
              </code>
              <Button variant="outline" onClick={() => copy(ENDPOINT, 'Endpoint')}>
                <Copy className="w-4 h-4 mr-2" /> Copiar
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Aceita somente requisições <strong>POST</strong> com corpo JSON.
            </p>
          </CardContent>
        </Card>

        {/* Token */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="w-4 h-4" /> Token de segurança (X-Ingest-Token)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm break-all">
                {loading ? 'Carregando...' : revealed ? token : masked || '—'}
              </code>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setRevealed((v) => !v)} disabled={!token}>
                  {revealed ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                  {revealed ? 'Ocultar' : 'Revelar'}
                </Button>
                <Button variant="outline" onClick={() => copy(token, 'Token')} disabled={!token}>
                  <Copy className="w-4 h-4 mr-2" /> Copiar
                </Button>
                <Button variant="destructive" onClick={() => setConfirmOpen(true)} disabled={regenerating}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Regenerar
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Entregue o token ao fornecedor por canal seguro (nunca por e-mail aberto ou grupo de
              mensagens). Ao regenerar, o token anterior deixa de ser aceito imediatamente.
            </p>
          </CardContent>
        </Card>

        {/* Headers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Headers obrigatórios</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="rounded-md bg-muted px-3 py-2 text-sm overflow-x-auto">
{`Content-Type: application/json
X-Ingest-Token: <token>`}
            </pre>
          </CardContent>
        </Card>

        {/* Contrato */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contrato de payload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold mb-2">Campos obrigatórios</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {camposObrigatorios.map(([campo, tipo, desc]) => (
                    <TableRow key={campo}>
                      <TableCell className="font-mono text-xs">{campo}</TableCell>
                      <TableCell className="text-xs">{tipo}</TableCell>
                      <TableCell className="text-xs">{desc}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Campos opcionais</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {camposOpcionais.map(([campo, tipo, desc]) => (
                    <TableRow key={campo}>
                      <TableCell className="font-mono text-xs">{campo}</TableCell>
                      <TableCell className="text-xs">{tipo}</TableCell>
                      <TableCell className="text-xs">{desc}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Exemplo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exemplo de requisição</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Corpo (JSON)</span>
                <Button size="sm" variant="ghost" onClick={() => copy(exemploJson, 'Exemplo JSON')}>
                  <Copy className="w-4 h-4 mr-2" /> Copiar
                </Button>
              </div>
              <pre className="rounded-md bg-muted px-3 py-2 text-xs overflow-x-auto">{exemploJson}</pre>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">cURL</span>
                <Button size="sm" variant="ghost" onClick={() => copy(exemploCurl, 'Exemplo cURL')}>
                  <Copy className="w-4 h-4 mr-2" /> Copiar
                </Button>
              </div>
              <pre className="rounded-md bg-muted px-3 py-2 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                {exemploCurl}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Códigos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Códigos de resposta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {codigos.map(([codigo, desc]) => (
              <div key={codigo} className="flex items-center gap-3 text-sm">
                <Badge variant={codigo === '201' ? 'default' : 'secondary'} className="font-mono">
                  {codigo}
                </Badge>
                <span className="text-muted-foreground">{desc}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Boas práticas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Boas práticas para o fornecedor</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
              <li>Enviar apenas o resultado final da conversa, não cada mensagem intermediária.</li>
              <li>
                Reenvios da mesma mensagem devem usar o mesmo <code>external_id</code> — isso evita
                duplicatas na base.
              </li>
              <li>Áudios devem chegar já transcritos no campo de sugestão.</li>
              <li>Usar o nome oficial do município do Paraná, sem abreviações.</li>
              <li>Em erro 401, conferir o token; em 409, a mensagem já foi processada.</li>
            </ul>
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerar o token de ingestão?</AlertDialogTitle>
            <AlertDialogDescription>
              O token atual deixará de funcionar imediatamente. O fornecedor precisará atualizar a
              configuração dele com o novo valor, ou as sugestões pararão de chegar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerate} disabled={regenerating}>
              {regenerating ? 'Gerando...' : 'Regenerar token'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
