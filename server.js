// ==================== IMPORTS BÁSICOS ====================
const express = require('express');
const { Resend } = require('resend');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ==================== SUPABASE CLIENT ====================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // backend (service role)
const supabase = createClient(supabaseUrl, supabaseKey);

// ==================== APP E CONFIGURAÇÕES GERAIS ====================
const app = express();
const resend = new Resend(process.env.RESEND_API_KEY || 're_EDi3taB6_9UAiyMMCoHs7bdtWoxibFKWL');
const PORT = process.env.PORT || 10000;

// fetch dinâmico, compatível com CommonJS
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==================== MAPEAMENTOS E FUNÇÕES AUXILIARES (DS-160) ====================
// (Mantenha aqui suas implementações reais – se não tiver, o PDF ainda funcionará)
const radioMapping = { /* seu código */ };
function formatValue(fieldName, value) { /* seu código */ }
function groupParallelArrays(data, nameField, relField) { /* seu código */ }
function groupTravels(data) { /* seu código */ }
function drawSeparator(doc) { /* seu código */ }
const simpleFields = [ /* seu código */ ];

// ==================== FUNÇÃO: BUSCAR PERFIL DO LEAD NO SUPABASE ====================
async function buscarPerfilDoLead(phone) {
  if (!phone) return null;

  try {
    const { data, error } = await supabase
      .from('lead_perfil_visto')
      .select('*')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ Erro ao buscar perfil do lead:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    return data[0]; // registro mais recente para esse phone
  } catch (err) {
    console.error('❌ Erro inesperado ao buscar perfil do lead:', err);
    return null;
  }
}

// ==================== ROTAS DE FORMULÁRIOS ====================
// ------------------------------------------------------------
// ROTA DS-160
// ------------------------------------------------------------
app.post('/api/submit-ds160', async (req, res) => {
  const data = req.body;
  console.log('📥 Dados recebidos (DS-160)');
  res.status(200).json({ success: true });

  try {
    const nome = data['full_name'] || 'Cliente_Sem_Nome';
    const emailCliente = data['email-1'] || null;
    const telefone = data['text-77'] || '';

    // Geração do PDF com verificação de tamanho
    const pdfBuffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdf = Buffer.concat(buffers);
        if (pdf.length === 0) reject(new Error('PDF gerado está vazio'));
        else resolve(pdf);
      });
      doc.on('error', reject);

      doc.fontSize(22).text('SOLICITAÇÃO DE VISTO DS-160', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Nome: ${nome}`);
      doc.text(`E-mail: ${emailCliente || 'não informado'}`);
      doc.text(`Telefone: ${telefone}`);
      doc.end();
    });

    console.log(`✅ PDF gerado, tamanho: ${pdfBuffer.length} bytes`);

    // Envia e‑mail para a equipe com anexo
    const emailEquipe = await resend.emails.send({
      from: 'GetVisa <contato@getvisa.com.br>',
      to: ['getvisa.assessoria@gmail.com'],
      subject: `🇺🇸 DS-160: ${nome}`,
      html: `<p><strong>Cliente:</strong> ${nome}<br><strong>E-mail:</strong> ${emailCliente}</p><p>PDF em anexo (${pdfBuffer.length} bytes).</p>`,
      attachments: [{ filename: `DS160_${nome.replace(/[^a-z0-9]/gi, '_')}.pdf`, content: pdfBuffer }]
    });
    console.log('✅ E-mail enviado para a equipe', emailEquipe.id);

    // Envia para o cliente (opcional)
    if (emailCliente && emailCliente.trim() !== '') {
      const emailClienteRes = await resend.emails.send({
        from: 'GetVisa <contato@getvisa.com.br>',
        to: [emailCliente],
        subject: `Seu formulário DS-160 foi recebido - ${nome}`,
        html: `<p>Olá ${nome},<br>Recebemos seu formulário. Segue em anexo uma cópia.</p>`,
        attachments: [{ filename: `DS160_${nome.replace(/[^a-z0-9]/gi, '_')}.pdf`, content: pdfBuffer }]
      });
      console.log(`✅ E-mail enviado para o cliente: ${emailCliente}`, emailClienteRes.id);
    }
  } catch (err) {
    console.error('❌ Erro no DS-160:', err.message);
    // Não reenvia e‑mail para não duplicar
  }
});

// ------------------------------------------------------------
// ROTA PASSAPORTE
// ------------------------------------------------------------
app.post('/api/submit-passaporte', async (req, res) => {
  const data = req.body;
  console.log('📥 Dados de passaporte recebidos');
  res.status(200).json({ success: true });

  try {
    const nome = data['passaporte_nome'] || 'Cliente_Sem_Nome';
    const emailCliente = data['passaporte_email'] || null;
    const telefone = data['passaporte_telefone'] || '';

    const pdfBuffer = await new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.fontSize(22).text('SOLICITAÇÃO DE PASSAPORTE', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Nome: ${nome}`);
      doc.text(`E-mail: ${emailCliente || 'não informado'}`);
      doc.text(`Telefone: ${telefone}`);
      doc.end();
    });

    await resend.emails.send({
      from: 'GetVisa <contato@getvisa.com.br>',
      to: ['getvisa.assessoria@gmail.com'],
      subject: `📘 Passaporte: ${nome}`,
      html: `<p><strong>Cliente:</strong> ${nome}<br><strong>E-mail:</strong> ${emailCliente}</p><p>PDF em anexo.</p>`,
      attachments: [{ filename: `Passaporte_${nome.replace(/[^a-z0-9]/gi, '_')}.pdf`, content: pdfBuffer }]
    });
    console.log('✅ E-mail enviado para a equipe (passaporte)');

    if (emailCliente && emailCliente.trim() !== '') {
      await resend.emails.send({
        from: 'GetVisa <contato@getvisa.com.br>',
        to: [emailCliente],
        subject: `Sua solicitação de passaporte foi recebida - ${nome}`,
        html: `<p>Olá ${nome},<br>Recebemos sua solicitação. Em breve entraremos em contato.</p><p>PDF em anexo.</p>`,
        attachments: [{ filename: `Passaporte_${nome.replace(/[^a-z0-9]/gi, '_')}.pdf`, content: pdfBuffer }]
      });
      console.log(`✅ E-mail enviado para o cliente (passaporte): ${emailCliente}`);
    }
  } catch (err) {
    console.error('❌ Erro no passaporte:', err);
  }
});

// ------------------------------------------------------------
// ROTA VISTO NEGADO
// ------------------------------------------------------------
app.post('/api/submit-visto-negado', async (req, res) => {
  const data = req.body;
  console.log('📥 Dados de Visto Negado recebidos:', data);
  res.status(200).json({ success: true });

  try {
    const nome = data['nome'] || 'Cliente_Sem_Nome';
    const emailCliente = data['email'] || null;
    const score = data['score'] || 'não calculado';

    const pdfBuffer = await new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.fontSize(22).text('AVALIAÇÃO DE VISTO NEGADO', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Nome: ${nome}`);
      doc.text(`E-mail: ${emailCliente || 'não informado'}`);
      doc.text(`Pontuação: ${score}`);
      doc.end();
    });

    await resend.emails.send({
      from: 'GetVisa <contato@getvisa.com.br>',
      to: ['getvisa.assessoria@gmail.com'],
      subject: `⚠️ Visto Negado: ${nome}`,
      html: `<p><strong>Cliente:</strong> ${nome}<br><strong>E-mail:</strong> ${emailCliente}</p><p>PDF em anexo.</p>`,
      attachments: [{ filename: `Visto_Negado_${nome.replace(/[^a-z0-9]/gi, '_')}.pdf`, content: pdfBuffer }]
    });
    console.log('✅ E-mail enviado para a equipe (visto negado)');

    if (emailCliente && emailCliente.trim() !== '') {
      await resend.emails.send({
        from: 'GetVisa <contato@getvisa.com.br>',
        to: [emailCliente],
        subject: `Resultado da sua avaliação de visto negado - ${nome}`,
        html: `<p>Olá ${nome},<br>Recebemos sua avaliação. Em breve entraremos em contato.</p><p>PDF em anexo.</p>`,
        attachments: [{ filename: `Visto_Negado_${nome.replace(/[^a-z0-9]/gi, '_')}.pdf`, content: pdfBuffer }]
      });
      console.log(`✅ E-mail enviado para o cliente: ${emailCliente}`);
    }
  } catch (err) {
    console.error('❌ Erro no visto negado:', err);
  }
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

// ==================== ENDPOINTS DE COMPROMISSOS (LISTAR/EDITAR, PROTEGIDOS) ====================
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
        clienteInfo.nome_completo || (comp.cliente && comp.cliente.split(' (')[0]) || 'Cliente';
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
function responderPerguntaObjetiva(mensagem, perfilLead) {
  if (!mensagem) return null;

  const txt = mensagem.toLowerCase();

  // Exemplo de uso do perfil (prazo + mês de viagem do teste)
  if (
    (txt.includes('prazo') || txt.includes('quanto tempo') || txt.includes('demora')) &&
    perfilLead &&
    perfilLead.dados_teste &&
    perfilLead.dados_teste.mes_viagem
  ) {
    const mes = perfilLead.dados_teste.mes_viagem;
    const ano = perfilLead.dados_teste.ano_viagem;

    return (
      `Vi aqui no seu teste que você pretende viajar em ${mes}/${ano}.\n\n` +
      'Os prazos do visto americano variam conforme a cidade e a agenda do consulado.\n\n' +
      'Em geral, entre taxa, agendamento e entrevista, costuma ficar numa média de 2 a 6 meses. ' +
      'No seu caso, é importante começar o quanto antes pra não apertar demais as datas.'
    );
  }

  // ---------------- 1) PREÇO / VALOR / INVESTIMENTO ----------------
  if (
    txt.includes('consultoria') ||
    txt.includes('honorário') ||
    txt.includes('honorario') ||
    txt.includes('preço') ||
    txt.includes('preco') ||
    txt.includes('valor') ||
    txt.includes('quanto custa') ||
    txt.includes('investimento')
  ) {
    return (
      'Hoje a consultoria da GetVisa para visto americano de turismo/negócios (B1/B2) ' +
      'começa em torno de R$ 490, podendo variar conforme o perfil e o nível de acompanhamento que você precisa.\n\n' +
      'No valor da consultoria costuma estar incluído: análise estratégica do seu caso, ' +
      'preenchimento assistido do DS-160, organização dos documentos, preparação para entrevista ' +
      'e acompanhamento até a conclusão do processo.\n\n' +
      'O ideal é entender rapidinho o seu perfil pra te passar um valor mais preciso, sem chute.'
    );
  }

  // ---------------- 2) TAXA CONSULAR ----------------
  if (
    txt.includes('taxa') &&
    (txt.includes('consular') || txt.includes('embaixada') || txt.includes('visto'))
  ) {
    return (
      'A taxa consular para o visto americano de turismo/negócios (B1/B2) hoje é de aproximadamente US$ 185, ' +
      'paga diretamente ao consulado, normalmente no cartão de crédito (em dólar).\n\n' +
      'Essa taxa é separada da consultoria da GetVisa, que é o serviço de acompanhamento especializado. ' +
      'Ou seja: tem o valor da taxa do consulado e o valor da nossa consultoria.\n\n' +
      'Se quiser, eu te explico certinho a diferença entre as duas coisas.'
    );
  }

  // ---------------- 3) PRAZOS / QUANTO TEMPO DEMORA (genérico) ----------------
  if (
    txt.includes('prazo') ||
    txt.includes('quanto tempo') ||
    txt.includes('demora') ||
    txt.includes('leva quanto') ||
    txt.includes('tempo de espera') ||
    txt.includes('fila')
  ) {
    return (
      'Os prazos do visto americano mudam bastante conforme a cidade e a época do ano, por causa da agenda do consulado.\n\n' +
      'De forma geral, entre pagamento da taxa, agendamento e entrevista, costuma ficar numa média de 2 a 6 meses, ' +
      'mas isso pode ser mais rápido ou mais demorado dependendo da região.\n\n' +
      'Por isso, quanto antes você começar, melhor pra ter mais opções de datas.'
    );
  }

  // ---------------- 4) COMO FUNCIONA A CONSULTORIA / O QUE INCLUI ----------------
  if (
    txt.includes('como funciona') ||
    txt.includes('o que inclui') ||
    txt.includes('o que está incluso') ||
    txt.includes('o que esta incluso') ||
    txt.includes('serviço') ||
    txt.includes('servico') ||
    txt.includes('assessoria') ||
    txt.includes('vocês ajudam') ||
    txt.includes('voces ajudam')
  ) {
    return (
      'Na consultoria da GetVisa nós te acompanhamos em praticamente todas as etapas do visto americano:\n\n' +
      '• Análise rápida do seu perfil e do objetivo da viagem\n' +
      '• Estratégia de apresentação do seu caso (o que faz sentido destacar e o que cuidar)\n' +
      '• Preenchimento assistido do formulário DS-160\n' +
      '• Orientação sobre documentos mais importantes pro seu perfil\n' +
      '• Preparação para entrevista (perguntas comuns, postura, pontos de atenção)\n' +
      '• Acompanhamento até a conclusão do processo\n\n' +
      'A ideia é você não ficar perdido nem correr risco por falta de informação.'
    );
  }

  // ---------------- 5) LOCAIS / CONSULADO / ENTREVISTA ----------------
  if (
    txt.includes('onde') &&
    (txt.includes('consulado') || txt.includes('casv') || txt.includes('entrevista') || txt.includes('posto'))
  ) {
    return (
      'Os consulados americanos no Brasil que realizam entrevistas para visto ficam em São Paulo, ' +
      'Rio de Janeiro, Brasília, Recife e Porto Alegre (quando em operação).\n\n' +
      'Muita gente viaja para outra cidade só para fazer o processo, não precisa ser necessariamente no seu estado.\n\n' +
      'A escolha do local pode depender da agenda e de onde fica mais prático pra você.'
    );
  }

  // ---------------- 6) DOCUMENTOS NECESSÁRIOS ----------------
  if (
    txt.includes('documento') ||
    txt.includes('documentos') ||
    txt.includes('o que precisa') ||
    txt.includes('preciso levar') ||
    txt.includes('levar o que') ||
    txt.includes('preciso ter')
  ) {
    return (
      'Os documentos ideais para o visto americano variam bastante de pessoa pra pessoa, ' +
      'mas em geral envolvem comprovação de renda, vínculos com o Brasil e informações da viagem.\n\n' +
      'Não existe uma “lista oficial” única; o consulado avalia o conjunto do seu perfil e da sua entrevista.\n\n' +
      'Na consultoria a gente monta uma lista personalizada com base na sua realidade, ' +
      'pra você não pecar nem por falta nem por exagero de papel.'
    );
  }

  // ---------------- 7) VISTO NEGADO / RISCO DE REPROVAÇÃO ----------------
  if (
    txt.includes('visto negado') ||
    txt.includes('já tive visto negado') ||
    txt.includes('ja tive visto negado') ||
    txt.includes('reprova') ||
    txt.includes('negam') ||
    txt.includes('chance de') ||
    txt.includes('probabilidade') ||
    txt.includes('risco')
  ) {
    return (
      'Cada caso de visto negado tem um motivo específico, mesmo quando o consulado não explica claramente na hora.\n\n' +
      'O mais importante é entender o que pode ter pesado contra você e ajustar a estratégia antes de tentar de novo, ' +
      'porque repetir o mesmo pedido da mesma forma costuma dar o mesmo resultado.\n\n' +
      'Na GetVisa a gente olha com cuidado seu histórico e monta um plano pra nova tentativa com mais segurança.'
    );
  }

  // ---------------- 8) FAMÍLIA / CRIANÇAS ----------------
  if (
    txt.includes('filho') ||
    txt.includes('filha') ||
    txt.includes('criança') ||
    txt.includes('crianca') ||
    txt.includes('família') ||
    txt.includes('familia') ||
    txt.includes('esposa') ||
    txt.includes('marido')
  ) {
    return (
      'É super comum fazer o visto em família, incluindo crianças.\n\n' +
      'Em muitos casos, crianças pequenas nem precisam ir na entrevista, mas isso depende da idade e de como estão os vistos dos pais.\n\n' +
      'Na consultoria a gente organiza tudo pra família inteira: formulários, taxas, agendamentos e orientações específicas pra cada um.'
    );
  }

  // ---------------- 9) OUTROS TIPOS DE VISTO (ESTUDO / TRABALHO) ----------------
  if (
    txt.includes('estudante') ||
    txt.includes('estudo') ||
    txt.includes('trabalho') ||
    txt.includes('intercâmbio') ||
    txt.includes('intercambio') ||
    txt.includes('visto f1') ||
    txt.includes('visto j1') ||
    txt.includes('j-1') ||
    txt.includes('f-1')
  ) {
    return (
      'Vistos de estudo e trabalho (como F1, J1, etc.) têm regras um pouco diferentes do turismo, ' +
      'principalmente em relação a documentos da escola/empregador e comprovação financeira.\n\n' +
      'Nós também atendemos esse tipo de visto, mas a análise precisa ser um pouco mais detalhada, ' +
      'porque cada programa tem suas exigências.\n\n' +
      'O melhor caminho é olhar seu caso com calma pra te orientar com segurança.'
    );
  }

  // ---------------- 10) COMO COMEÇAR / AGENDAR / PRÓXIMO PASSO ----------------
  if (
    txt.includes('começar') ||
    txt.includes('iniciar') ||
    txt.includes('agendar') ||
    txt.includes('marcar') ||
    txt.includes('quero fazer') ||
    txt.includes('fechar consultoria') ||
    txt.includes('vamos fazer') ||
    txt.includes('como faço') ||
    txt.includes('como faço para')
  ) {
    return (
      'Ótimo, vamos organizar isso do jeito certo 😊\n\n' +
      'O próximo passo é fazer uma análise rápida do seu perfil, pra entender seu objetivo de viagem e o melhor caminho no visto.\n\n' +
      'A partir dessa análise, a gente já consegue te passar valor exato, prazos e próximos passos bem certinhos.'
    );
  }

  // ---------------- 11) SAUDAÇÕES RÁPIDAS (oi, bom dia, boa tarde) ----------------
  if (
    txt === 'oi' ||
    txt === 'olá' ||
    txt === 'ola' ||
    txt.startsWith('bom dia') ||
    txt.startsWith('boa tarde') ||
    txt.startsWith('boa noite')
  ) {
    return (
      'Olá! 😊 Eu sou o atendimento automatizado da GetVisa e te ajudo com dúvidas rápidas sobre visto americano.\n\n' +
      'Você pode me perguntar sobre valores, taxa consular, prazos, documentos ou como funciona a consultoria. ' +
      'E, se precisar de uma análise mais detalhada, eu te direciono pra um especialista.'
    );
  }

  // Se não reconhecer nenhum padrão, retorna null
  return null;
}

// ==================== WEBHOOK PARA RECEBER MENSAGENS DO ZAPI ====================
app.post('/api/webhook/zapi', async (req, res) => {
  console.log('📥 Webhook Z-API recebido (bruto):');
  console.dir(req.body, { depth: null });

  const body = req.body || {};

  // 0) Garantir que só a instância de teste responda
  const connectedPhone = body.connectedPhone || null;
  const NUMERO_TESTE = '5521985234917'; // número do WhatsApp da instância

  if (connectedPhone && connectedPhone !== NUMERO_TESTE) {
    console.log(
      `⚠️ Ignorando mensagem porque veio do número conectado ${connectedPhone}, e não do número de teste ${NUMERO_TESTE}.`
    );
    return res.status(200).json({ ignored: true, reason: 'different connectedPhone' });
  }

  // 1) Extrair telefone do cliente (quem mandou mensagem para o bot)
  const phone =
    body.phone ||
    body.from ||
    body.remoteJid ||
    null;

  // (Opcional) Bloquear alguns números de cliente (ex.: seu próprio)
  const NUMEROS_BLOQUEADOS = [
    // '5521974601812', // descomente se NÃO quiser que esse número receba respostas automáticas
  ];

  if (phone && NUMEROS_BLOQUEADOS.includes(phone)) {
    console.log(`⚠️ Ignorando mensagem de número bloqueado: ${phone}`);
    return res.status(200).json({ ignored: true, reason: 'blocked phone' });
  }

  // 1.1) Buscar perfil do lead (resultado do formulário) no Supabase
  const perfilLead = await buscarPerfilDoLead(phone);
  console.log('🧩 Perfil do lead encontrado:', perfilLead);

  // 2) Extrair mensagem de texto OU marcar que é áudio
  let message =
    (body.text && body.text.message) ||
    body.message ||
    (body.text && body.text.body) ||
    body.body ||
    '';

  let isAudio = false;

  if (!message && body.audio && body.audio.audioUrl) {
    isAudio = true;
    message = '[mensagem de áudio recebida]';
    console.log(`🎧 Mensagem de áudio detectada de ${phone}: ${body.audio.audioUrl}`);
  }

  if (!phone || !message) {
    console.log('⚠️ Webhook sem phone ou message no formato esperado.');
    return res.status(200).json({ received: true, warning: 'missing phone or message' });
  }

  console.log(`📩 Mensagem de ${phone}: ${message}`);

  // 3) Montar resposta
  let resposta;

  if (isAudio) {
    resposta =
      'Recebi seu áudio aqui 🙌\n\n' +
      'Neste canal automatizado eu consigo entender melhor mensagens de texto. ' +
      'Você consegue me enviar sua dúvida por escrito? Assim te ajudo mais rápido.';
  } else {
    // Regras fixas, considerando o perfil do Supabase
    resposta = responderPerguntaObjetiva(message, perfilLead);

    // Se não houver resposta objetiva, cai no texto padrão (e mais tarde OpenAI)
    if (!resposta) {
      resposta =
        'Essa é uma pergunta que normalmente analisamos caso a caso, olhando o seu perfil completo. ' +
        'Um especialista pode te orientar com mais segurança.';
    }
  }

  // 4) Enviar resposta via Z-API
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

  // Sempre responder 200 para a Z-API
  res.status(200).json({ received: true });
});

// ==================== INICIALIZAÇÃO ====================
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor rodando na porta ${PORT}`));