const express = require('express');
const { Resend } = require('resend');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const resend = new Resend('re_EDi3taB6_9UAiyMMCoHs7bdtWoxibFKWL');
const PORT = process.env.PORT || 10000;

// fetch dinâmico, compatível com CommonJS
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==================== SUPABASE CLIENT ====================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ==================== MAPEAMENTOS E FUNÇÕES AUXILIARES (DS-160) ====================
// (Mantenha aqui suas implementações reais)

const radioMapping = { /* seu código */ };
function formatValue(fieldName, value) { /* seu código */ }
function groupParallelArrays(data, nameField, relField) { /* seu código */ }
function groupTravels(data) { /* seu código */ }
function drawSeparator(doc) { /* seu código */ }
const simpleFields = [ /* seu código */ ];

// ==================== ROTAS DE FORMULÁRIOS ====================
app.post('/api/submit-ds160', async (req, res) => {
  /* seu código existente – não altere */
});

app.post('/api/submit-passaporte', async (req, res) => {
  /* seu código existente – não altere */
});

app.post('/api/submit-visto-negado', async (req, res) => {
  /* seu código existente – não altere */
});

// ==================== AUTENTICAÇÃO PARA ENDPOINTS ADMIN ====================
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'minha-chave-secreta-123';

function validateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== ADMIN_API_KEY) {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  next();
}

// ==================== ENDPOINTS DE AGENDA (PROTEGIDOS) ====================
app.get('/api/agendamentos', validateApiKey, async (req, res) => {
  const { solicitacao_id } = req.query;
  let query = supabase.from('agendamentos').select('*');
  if (solicitacao_id) query = query.eq('solicitacao_id', solicitacao_id);

  const { data, error } = await query.order('data_hora', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/agendamentos', validateApiKey, async (req, res) => {
  const { solicitacao_id, tipo, data_hora, local, observacoes } = req.body;

  if (!solicitacao_id || !tipo || !data_hora) {
    return res
      .status(400)
      .json({ error: 'Campos obrigatórios: solicitacao_id, tipo, data_hora' });
  }

  const { data, error } = await supabase
    .from('agendamentos')
    .insert({ solicitacao_id, tipo, data_hora, local, observacoes, status: 'agendado' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

app.put('/api/agendamentos/:id', validateApiKey, async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body };

  delete updates.id;
  delete updates.created_at;

  const { data, error } = await supabase
    .from('agendamentos')
    .update({ ...updates, updated_at: new Date() })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/agendamentos/:id', validateApiKey, async (req, res) => {
  const { error } = await supabase.from('agendamentos').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

app.get('/api/solicitacoes', validateApiKey, async (req, res) => {
  const { data, error } = await supabase
    .from('solicitacoes')
    .select('id, tipo, clientes(nome_completo, email)')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ==================== ENDPOINTS DE COMPROMISSOS (PROTEGIDOS PARA LISTAGEM/EDIÇÃO) ====================
app.get('/api/compromissos', validateApiKey, async (req, res) => {
  const { data, error } = await supabase
    .from('compromissos')
    .select('*')
    .order('data', { ascending: true })
    .order('hora', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/compromissos/:id', validateApiKey, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const { data, error } = await supabase
    .from('compromissos')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/compromissos/:id', validateApiKey, async (req, res) => {
  const { error } = await supabase.from('compromissos').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// ==================== CRIAÇÃO DE COMPROMISSO (PÚBLICO) ====================
app.post('/api/compromissos', async (req, res) => {
  const { nome, email, telefone, atividade, data, hora, local, concluido } = req.body;

  if (!email || !atividade || !data || !hora) {
    return res.status(400).json({ error: 'Campos obrigatórios: email, atividade, data, hora' });
  }

  try {
    // 1. Buscar cliente pelo e-mail
    let { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('id, nome_completo, email, telefone')
      .eq('email', email)
      .maybeSingle();

    if (clienteError) throw clienteError;

    // 2. Se não existir, criar cliente
    if (!cliente) {
      const { data: novoCliente, error: insertError } = await supabase
        .from('clientes')
        .insert({
          nome_completo: nome || 'Cliente sem nome',
          email: email,
          telefone: telefone || null
        })
        .select()
        .single();

      if (insertError) throw insertError;
      cliente = novoCliente;
      console.log(`✅ Cliente criado: ${cliente.id} - ${cliente.email}`);
    } else {
      // Atualiza dados se necessário
      const updates = {};
      if (nome && nome !== cliente.nome_completo) updates.nome_completo = nome;
      if (telefone && telefone !== cliente.telefone) updates.telefone = telefone;

      if (Object.keys(updates).length > 0) {
        await supabase.from('clientes').update(updates).eq('id', cliente.id);
        console.log(`🔄 Cliente atualizado: ${cliente.id}`);
      }
    }

    // 3. Criar compromisso
    const { data: compromisso, error: compError } = await supabase
      .from('compromissos')
      .insert({
        cliente_id: cliente.id,
        cliente: `${cliente.nome_completo} (${cliente.telefone || 'sem telefone'})`,
        atividade,
        data,
        hora,
        local: local || null,
        concluido: concluido || 0
      })
      .select()
      .single();

    if (compError) throw compError;

    res.status(201).json({ success: true, compromisso, cliente });
  } catch (err) {
    console.error('❌ Erro ao criar compromisso:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ENDPOINT DE LEMBRETES (PÚBLICO, CHAMADO POR CRON) ====================
app.get('/api/enviar-lembretes', async (req, res) => {
  console.log('🔔 Iniciando verificação de lembretes...');
  res.status(200).send('Processando lembretes... (ver logs)');

  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const amanha = new Date(hoje);
    amanha.setDate(hoje.getDate() + 1);

    const daqui3 = new Date(hoje);
    daqui3.setDate(hoje.getDate() + 3);

    const amanhaStr = amanha.toISOString().split('T')[0];
    const daqui3Str = daqui3.toISOString().split('T')[0];

    console.log(`Buscando compromissos para ${amanhaStr} e ${daqui3Str}`);

    const { data: compromissos, error } = await supabase
      .from('compromissos')
      .select(`
        id, cliente, atividade, data, hora, local,
        clientes (email, telefone, nome_completo)
      `)
      .in('data', [amanhaStr, daqui3Str])
      .eq('concluido', 0);

    if (error) throw error;

    if (!compromissos || compromissos.length === 0) {
      console.log('Nenhum compromisso encontrado.');
      return;
    }

    for (const comp of compromissos) {
      const clienteInfo = comp.clientes || {};
      const email = clienteInfo.email;
      const nomeCliente =
        clienteInfo.nome_completo || comp.cliente?.split(' (')[0] || 'Cliente';
      const dataComp = comp.data;
      const horaComp = comp.hora;
      const atividade = comp.atividade;
      const local = comp.local || 'A definir';

      const dataCompDate = new Date(dataComp);
      const diffDays = Math.ceil((dataCompDate - hoje) / (1000 * 60 * 60 * 24));

      let titulo = '';
      if (diffDays === 1) titulo = '🔔 Lembrete: seu compromisso é amanhã!';
      else if (diffDays === 3) titulo = '📅 Lembrete: você tem um compromisso em 3 dias';
      else continue;

      const corpoEmail = `
        <h2>Olá ${nomeCliente},</h2>
        <p>Você tem um compromisso agendado:</p>
        <ul>
          <li><strong>Atividade:</strong> ${atividade}</li>
          <li><strong>Data:</strong> ${dataComp}</li>
          <li><strong>Horário:</strong> ${horaComp}</li>
          <li><strong>Local:</strong> ${local}</li>
        </ul>
        <p>Não se esqueça dos documentos necessários.</p>
        <p>Atenciosamente,<br>Equipe GetVisa</p>
      `;

      if (email) {
        await resend.emails.send({
          from: 'GetVisa <contato@getvisa.com.br>',
          to: [email],
          subject: titulo,
          html: corpoEmail
        });
        console.log(`✅ E-mail enviado para ${email} (${atividade})`);
      } else {
        console.log(`⚠️ Compromisso ID ${comp.id} sem e-mail associado.`);
      }
    }
  } catch (err) {
    console.error('❌ Erro ao processar lembretes:', err);
  }
});

// ==================== ROTA DE PING (MANTER SERVIDOR ACORDADO) ====================
app.get('/ping', (req, res) => {
  res.status(200).send('ok');
});

// ==================== RESPOSTAS AUTOMÁTICAS PARA WHATSAPP (ZAPI) ====================
function responderPerguntaObjetiva(mensagem) {
  const txt = mensagem.toLowerCase();

  // TAXA CONSULAR
  if (txt.includes('taxa') && (txt.includes('consular') || txt.includes('embaixada') || txt.includes('visto'))) {
    return (
      'Atualmente, a taxa consular para o visto americano de turismo/negócios (B1/B2) ' +
      'é de aproximadamente US$ 185. Esse valor é cobrado em dólar direto pelo consulado, ' +
      'via cartão de crédito internacional.\n\n' +
      'Além disso, a consultoria da GetVisa tem um investimento a partir de R$ 490, ' +
      'que pode variar conforme o tipo de visto e nível de suporte. ' +
      'Quer que eu te explique o que está incluído na consultoria?'
    );
  }

  // VALOR DA CONSULTORIA
  if (txt.includes('consultoria') || txt.includes('honorário') || txt.includes('preço') || txt.includes('valor')) {
    return (
      'A consultoria GetVisa para visto americano de turismo/negócios começa em R$ 490, ' +
      'podendo variar conforme o perfil e o nível de acompanhamento que você precisa.\n\n' +
      'No valor, normalmente está incluído: orientação do preenchimento do DS-160, ' +
      'estratégia de apresentação do seu caso, apoio até a entrevista e acompanhamento ' +
      'dos passos do processo.\n\n' +
      'Se quiser, posso te dizer qual é a faixa de valor mais adequada pro seu perfil.'
    );
  }

  // PRAZOS
  if (txt.includes('prazo') || txt.includes('quanto tempo') || txt.includes('demora')) {
    return (
      'Os prazos de visto americano variam bastante conforme a agenda do consulado e a cidade ' +
      'onde você pretende fazer a entrevista.\n\n' +
      'Hoje, em média, o prazo entre pagamento da taxa, agendamento e entrevista pode ficar em torno ' +
      'de 2 a 6 meses, mas isso muda com frequência.\n\n' +
      'Por isso, o ideal é sempre consultar a agenda no momento da decisão e planejar com folga.'
    );
  }

  // LOCAIS DE ATENDIMENTO
  if (txt.includes('onde') && (txt.includes('consulado') || txt.includes('casv') || txt.includes('entrevista'))) {
    return (
      'Atualmente, os consulados americanos no Brasil estão em São Paulo, Rio de Janeiro, ' +
      'Brasília, Recife e Porto Alegre (quando em operação).\n\n' +
      'Você não precisa fazer no seu estado de residência: muita gente viaja para outra cidade ' +
      'para fazer o processo.\n\n' +
      'Se quiser, posso te ajudar a escolher a melhor opção pro seu caso.'
    );
  }

  // Se não reconhecer, retorna null (fallback)
  return null;
}

// ==================== WEBHOOK PARA RECEBER MENSAGENS DO ZAPI ====================
app.post('/api/webhook/zapi', async (req, res) => {
  console.log('📥 Webhook Z-API recebido (bruto):');
  console.dir(req.body, { depth: null });

  const body = req.body;

  // Tentativas de extração de phone em formatos diferentes
  const phone =
    body.phone ||
    body.from ||
    body.remoteJid ||
    null;

  // Tentativas de extração de texto em formatos diferentes
  const message =
    body.text?.message ||
    body.message ||
    body.text?.body ||
    body.body ||
    '';

  if (!phone || !message) {
    console.log('⚠️ Webhook sem phone ou message no formato esperado.');
    // Sempre responde 200 para não marcar erro na Z-API
    return res.status(200).json({ received: true, warning: 'missing phone or message' });
  }

  console.log(`📩 Mensagem de ${phone}: ${message}`);

  // 1. Tenta resposta fixa
  let resposta = responderPerguntaObjetiva(message);

  // 2. Se não tiver resposta fixa, usa fallback
  if (!resposta) {
    resposta =
      'Essa é uma pergunta que normalmente analisamos caso a caso, olhando o seu perfil completo. ' +
      'Um especialista pode te orientar com mais segurança.';
  }

  // 3. Envia a resposta de volta via API da Z-API
  const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE;
  const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
  const ZAPI_SECURITY_TOKEN = process.env.ZAPI_SECURITY_TOKEN;

  if (!ZAPI_INSTANCE || !ZAPI_TOKEN) {
    console.error('❌ Variáveis ZAPI_INSTANCE ou ZAPI_TOKEN não configuradas');
    return res.status(500).json({ error: 'Z-API não configurado no servidor' });
  }

  const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`;
  const payload = { phone, message: resposta };

  try {
    const response = await fetch(zapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': ZAPI_SECURITY_TOKEN
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const txt = await response.text().catch(() => '');
      console.error('❌ Erro da API Z-API:', response.status, txt);
    } else {
      console.log(`✅ Resposta enviada para ${phone}`);
    }
  } catch (err) {
    console.error('❌ Erro ao enviar mensagem Z-API:', err);
  }

  // Confirma recebimento para o Z-API
  res.status(200).json({ received: true });
});

// ==================== INICIALIZAÇÃO ====================
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor rodando na porta ${PORT}`));