import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const BodySchema = z.object({
  nome: z.string().max(200).nullable().optional(),
  municipio: z.string().min(1).max(200),
  descricao: z.string().min(1).max(5000),
  telefone: z.string().max(50).nullable().optional(),
  email: z.string().email().max(200).nullable().optional(),
  tema_ids: z.array(z.string().uuid()).optional(),
  tema_nomes: z.array(z.string().max(300)).optional(),
  external_id: z.string().max(200).nullable().optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Validate token
  const token = Deno.env.get("WHATSAPP_WEBHOOK_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ error: "Server not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const providedToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!providedToken || providedToken !== token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const {
      nome, municipio, descricao, telefone, email,
      tema_ids, tema_nomes, external_id,
    } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Idempotency: if external_id provided, check for existing suggestion
    // by matching descricao + whatsapp within the last hour.
    if (external_id || telefone) {
      const { data: existing } = await supabase
        .from("sugestoes_populares")
        .select("id")
        .eq("descricao", descricao)
        .filter("whatsapp", "eq", telefone ?? "")
        .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .limit(1)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ ok: true, sugestao_id: existing.id, duplicate: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Resolve tema_ids from tema_nomes if not provided
    let resolvedTemaIds: string[] | null = tema_ids && tema_ids.length > 0 ? tema_ids : null;

    if (!resolvedTemaIds && tema_nomes && tema_nomes.length > 0) {
      const { data: matchedTemas } = await supabase
        .from("temas")
        .select("id")
        .in("nome", tema_nomes)
        .limit(20);

      if (matchedTemas && matchedTemas.length > 0) {
        resolvedTemaIds = matchedTemas.map((t: any) => t.id);
      }
    }

    // Determine eixo name from first tema
    let eixoName = "Desenvolvimento Social";
    if (resolvedTemaIds && resolvedTemaIds.length > 0) {
      const { data: firstTema } = await supabase
        .from("temas")
        .select("id, eixo_id")
        .eq("id", resolvedTemaIds[0])
        .maybeSingle();

      if (firstTema?.eixo_id) {
        const { data: eixo } = await supabase
          .from("eixos_tematicos")
          .select("nome")
          .eq("id", firstTema.eixo_id)
          .maybeSingle();
        if (eixo?.nome) eixoName = eixo.nome;
      }
    }

    // Insert the suggestion
    const { data: inserted, error: insertError } = await supabase
      .from("sugestoes_populares")
      .insert({
        nome: nome || null,
        email: email || null,
        whatsapp: telefone || null,
        municipio,
        eixo: eixoName,
        descricao,
        publico: true,
        tema_ids: resolvedTemaIds,
        origem: "whatsapp",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      const message = insertError.message?.includes("sugestões enviadas")
        || insertError.message?.includes("enviada repetidamente")
        ? insertError.message
        : "Failed to save suggestion";
      return new Response(
        JSON.stringify({ error: message }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fire-and-forget: trigger AI analysis (same as LP flow)
    if (inserted?.id) {
      supabase.functions
        .invoke("analyze-suggestion", {
          body: { sugestao_id: inserted.id, descricao, tema_ids: resolvedTemaIds ?? [] },
        })
        .catch((err: any) => console.error("Analyze suggestion error:", err));

      supabase.functions
        .invoke("classify-suggestion-eixo", {
          body: { sugestao_id: inserted.id },
        })
        .catch((err: any) => console.error("Classify suggestion error:", err));
    }

    return new Response(
      JSON.stringify({ ok: true, sugestao_id: inserted?.id }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
