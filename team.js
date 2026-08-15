/* =========================================================
   G26 Planner · Página da equipe (offline-first + sync automático)
   Permite editar APENAS as atividades/quantidades da programação,
   com observação obrigatória. Funciona offline (fila local) e
   sincroniza sozinho quando a internet volta.
   - RDO: antes de visualizar os dados da equipe, o usuário deve
     responder ao questionário Saída da Base Obrigatória (RDO).
   - Acesso bloqueado se a data da programação vencer.
========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyDFQCMsX04fwh7MVyEpvXnXD0U4TD5Or5w",
  authDomain: "ja-barbearia.firebaseapp.com",
  databaseURL: "https://ja-barbearia-default-rtdb.firebaseio.com",
  projectId: "ja-barbearia",
  storageBucket: "ja-barbearia.firebasestorage.app",
  messagingSenderId: "213237027963",
  appId: "1:213237027963:web:7d585b158ee06d3ab7fede",
  measurementId: "G-YNNKX5YDDX"
};
const rtdb = firebase.initializeApp(firebaseConfig);
const database = firebase.database(rtdb);
const DB_REF = database.ref('g26_planner/data');

const QUEUE_KEY = 'g26_equipe_queue';
const CACHE_KEY = 'g26_equipe_cache';

function loadQueue(){ try{ return JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]'); }catch(e){ return []; } }
function saveQueue(q){ try{ localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }catch(e){} }
function loadCache(){ try{ return JSON.parse(localStorage.getItem(CACHE_KEY)||'null'); }catch(e){ return null; } }
function saveCache(db){ try{ localStorage.setItem(CACHE_KEY, JSON.stringify(db)); }catch(e){} }

/* --- helpers --- */
function esc(s){ return String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtDate(iso){ if(!iso) return '—'; const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; }
function fmtDateTime(ts){ const d=new Date(ts); return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); }
function findProjeto(db,id){ return db.projetos.find(p=>p.id===Number(id)); }
function findEquipe(db,id){ return db.equipes.find(e=>e.id===Number(id)); }
function findAtividade(db,id){ return db.atividades.find(a=>a.id===Number(id)); }
function equipeLabel(eq){ if(!eq) return '—'; const parts=[]; if(eq.eqtl) parts.push(eq.eqtl); if(eq.prtn) parts.push(eq.prtn); return parts.length? parts.join(' / ') : ('Equipe #'+eq.id); }
function eqtlLabel(eq){ return (eq && eq.eqtl)? eq.eqtl : '—'; }
function prtnLabel(eq){ return (eq && eq.prtn)? eq.prtn : '—'; }
function toast(msg, kind){
  const wrap = document.getElementById('toast-wrap');
  const t = document.createElement('div'); t.className='toast';
  if(kind==='error') t.style.borderLeftColor='var(--red)';
  t.textContent=msg; wrap.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transition='.25s'; setTimeout(()=>t.remove(),250); }, 3400);
}
const ICONS = {
  plus:'<path d="M12 5v14M5 12h14"/>',
  close:'<path d="M18 6 6 18M6 6l12 12"/>',
  alert:'<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/>',
  calendar:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  camera:'<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'
};

/* ── FOTOS DOS REGISTROS (IMGGB) ── */
var IMGGB_KEY = '95bb16ee776d7e20f26857cec98bd372';
var FOTOS_SEP = ';;';
var _fotos = {};        // _fotos[eqId] = [ [File,...], [File,...], ... ] (uma lista por linha de atividade)
var _fotosEnviando = false;
function icon(name,size){ return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]||''}</svg>`; }

/* --- estado --- */
let DB = null;
const progId = Number(new URLSearchParams(location.search).get('equipe')) || null;
let prog = null;
let editors = {};
let observacao = '';
let online = navigator.onLine !== false;
let syncing = false;
let rdoCompletado = false;
let enviado = false;
const statusEl = document.getElementById('team-status');

function setStatus(txt, kind){
  if(!statusEl) return;
  statusEl.textContent = txt;
  statusEl.className = 'team-conn ' + (kind||'');
}

function checkDataProgramadaExpirada(){
  if(!prog || !prog.dataProgramada) return false;
  const hoje = new Date().toISOString().split('T')[0];
  const progData = new Date(prog.dataProgramada).toISOString().split('T')[0];
  return progData < hoje && !['Concluído','Cancelado'].includes(prog.status||'');
}

function dbToEditors(db){
  if(!db || !progId) return null;
  const pg = (db.programacoes||[]).find(p=>p.id===progId);
  if(!pg) return null;
  prog = pg;
  editors = {};
  (pg.atribuicoes||[]).forEach(at=>{
    editors[at.equipeId] = (at.atividades||[]).map(a=>({ atividadeId:String(a.atividadeId), quantidadePrevista: a.quantidadePrevista??'', quantidadeExecutada: a.quantidadeExecutada??'' }));
  });
  return pg;
}

/* --- RDO QUESTIONNAIRE --- */
const RDO_PERGUNTAS = [
  { id: 'rdo_condicoes', label: 'Condições climáticas', tipo: 'select', options: ['Bom','Nublado','Chuvoso','Impraticável'] },
  { id: 'rdo_impedimento', label: 'Impedimento de execução (Marque somente se a resposta for sim)', tipo: 'select', options: ['Não','Sim'] },
  { id: 'rdo_falta_material', label: 'Falta de material', tipo: 'select', options: ['Não','Sim'] },
  { id: 'rdo_projeto_incoerente', label: 'Projeto Incoerente', tipo: 'select', options: ['Não','Sim'] },
  { id: 'rdo_equipe_incompleta', label: 'Equipe incompleta', tipo: 'select', options: ['Não','Sim'] },
  { id: 'rdo_falta_veiculo', label: 'Falta de veículo', tipo: 'select', options: ['Não','Sim'] },
  { id: 'rdo_impedimento_acesso', label: 'Impedimento de acesso', tipo: 'select', options: ['Não','Sim'] },
  { id: 'rdo_licenca_ambiental', label: 'Licença ambiental', tipo: 'select', options: ['Não','Sim'] },
  { id: 'rdo_autorizacao_embargo', label: 'Autorização/embargo', tipo: 'select', options: ['Não','Sim'] },
  { id: 'rdo_desligamento', label: 'Desligamento conforme programado', tipo: 'select', options: ['Não','Sim'] },
];

function renderRDOForm(){
  const horarioCampos = [
    ['rdo_horario_chegada','Horário Chegada'],
    ['rdo_horario_inicio','Horário Início das atividades'],
    ['rdo_horario_finalizacao','Horário Finalização das atividades'],
    ['rdo_horario_saida_obra','Horário Saída da obra'],
    ['rdo_horario_chegada_base','Horário Chegada na base']
  ];
  return `
    <div class="panel section-gap" style="max-width:600px;margin:0 auto;">
      <div class="panel-head"><h3>Questionário RDO - Saída da Base</h3></div>
      <div style="padding:24px;">
        <p style="font-size:14px;color:var(--muted);margin-bottom:20px;">Responda às questões abaixo e informe os horários. Os dados ficam salvos neste aparelho e são enviados quando você concluir as atividades.</p>
        ${RDO_PERGUNTAS.map((p,i)=>`
          <div style="margin-bottom:14px;">
            <label style="display:block;font-weight:600;margin-bottom:4px;">${p.label}</label>
            <select class="rdo-select" data-rdo="${p.id}" style="width:100%;padding:8px;font-size:14px;">
              ${p.options.map((v,j)=>`<option value="${v}" ${j===0?'selected':''}>${v}</option>`).join('')}
            </select>
          </div>`).join('')}
        <div style="margin-top:24px;padding-top:24px;border-top:1px solid var(--border);">
          <h4 style="margin:0 0 12px 0;font-size:13px;color:var(--dark);">Horários</h4>
          <p style="font-size:12px;color:var(--muted-2);margin:0 0 14px 0;">Digite os números — o ":" entra automaticamente. Ex.: 07 30 → 07:30.</p>
          ${horarioCampos.map(([id,label])=>`
            <div style="margin-bottom:12px;">
              <label style="display:block;margin-bottom:4px;">${label}</label>
              <input type="text" class="rdo-input rdo-hora" data-rdo="${id}" inputmode="numeric" autocomplete="off" maxlength="5" placeholder="HH:MM" style="width:100%;padding:8px;font-size:16px;font-family:'JetBrains Mono',monospace;letter-spacing:.06em;">
            </div>`).join('')}
          <div style="margin-top:24px;padding-top:24px;border-top:1px solid var(--border);">
            <button class="btn btn-primary" id="rdo-concluir" style="width:100%;padding:12px;font-size:16px;">Concluir RDO</button>
          </div>
        </div>
      </div>
    </div>`;
}

function getRDORespostas(){
  const respostas = {};
  document.querySelectorAll('.rdo-select').forEach(s=>{ respostas[s.dataset.rdo] = s.value; });
  document.querySelectorAll('.rdo-input').forEach(s=>{ respostas[s.dataset.rdo] = s.value; });
  return respostas;
}

/* RDO pendente: respostas ficam no aparelho e só são enviadas junto com a conclusão das atividades */
function rdoKey(id){ return 'g26_equipe_rdo_'+id; }
function loadPendingRDO(id){ try{ return JSON.parse(localStorage.getItem(rdoKey(id))||'null'); }catch(e){ return null; } }
function savePendingRDO(obj){ try{ localStorage.setItem(rdoKey(obj.programacaoId), JSON.stringify(obj)); }catch(e){} }
function clearPendingRDO(id){ try{ localStorage.removeItem(rdoKey(id)); }catch(e){} }

/* Máscara numérica de horário: digita a hora, o ":" entra sozinho e depois os minutos */
function maskHora(el){
  const d = el.value.replace(/\D/g,'').slice(0,4);
  el.value = d.length>2? d.slice(0,2)+':'+d.slice(2) : d;
}
function padHora(el){
  if(!el.value) return;
  const d = el.value.replace(/\D/g,'');
  if(d.length<=2) el.value = d.padStart(2,'0')+':00';
  else if(d.length===3) el.value = d.slice(0,2)+':0'+d.slice(2);
  else el.value = d.slice(0,2)+':'+d.slice(2,4);
}
function horaValida(v){
  if(!/^\d{2}:\d{2}$/.test(v||'')) return false;
  const [h,m] = String(v).split(':').map(Number);
  return h>=0 && h<=23 && m>=0 && m<=59;
}

/* RDO já foi respondido se houver respostas salvas (no aparelho ou no servidor) */
function atualizaRDOCompletado(){
  if(!DB || !progId) return;
  const pg = (DB.programacoes||[]).find(p=>p.id===progId);
  if(!pg) return;
  const rdoSalvo = (pg.atribuicoes||[]).some(at=> at.rdoRespostas && Object.keys(at.rdoRespostas||{}).length>0);
  if(rdoSalvo || loadPendingRDO(progId)) rdoCompletado = true;
}

function respostasRDOPreenchidas(){
  const res = getRDORespostas();
  const perguntasOk = RDO_PERGUNTAS.every(p=> res[p.id] && res[p.id] !== '');
  const horarios = ['rdo_horario_chegada','rdo_horario_inicio','rdo_horario_finalizacao','rdo_horario_saida_obra','rdo_horario_chegada_base'];
  const horariosOk = horarios.every(id=> horaValida(res[id]));
  return perguntasOk && horariosOk;
}

/* --- render team --- */
function render(){
  const root = document.getElementById('team-body');
  if(!progId){ root.innerHTML = `<div class="panel"><div class="empty-state"><p>Link inválido — faltou identificar a programação.</p></div></div>`; return; }
  if(!prog){ root.innerHTML = `<div class="panel"><div class="empty-state"><p>Programação não encontrada.</p><p style="font-size:12px;color:var(--muted-2);">Conecte-se ao menos uma vez para carregar os dados, ou tente novamente com internet.</p></div></div>`; return; }

  /* Após o envio, a página mostra apenas a confirmação com a logo */
  if(enviado){
    root.innerHTML = `
      <div class="panel section-gap team-ok">
        <div class="brand-mark team-ok-logo">G2</div>
        <h3>Dados enviados e sincronizados</h3>
        <p>Obrigado, equipe! Suas atividades, quantidades executadas, fotos e o RDO foram enviados ao escritório.</p>
        <p class="team-ok-meta">Programação #${prog.id} · ${esc(prog.ciclo||'')} · ${fmtDate(prog.dataProgramada)}</p>
      </div>`;
    setStatus('Sincronizado', 'ok');
    return;
  }
  
  /* Verificar se data da programação venceu */
  if(checkDataProgramadaExpirada()){
    root.innerHTML = `
      <div class="panel" style="background:var(--red);color:#fff;padding:40px 20px;">
        <div style="max-width:500px;margin:0 auto;">
          <h3 style="color:#fff;">Acesso negado — Programação vencida</h3>
          <p style="font-size:16px;margin:16px 0 8px;">A data da programação ${fmtDate(prog.dataProgramada)} já venceu.</p>
          <p style="font-size:14px;opacity:0.9;">Equipe não pode mais acessar esta programação após o prazo.</p>
          <button class="btn btn-secondary" id="voltar-dashboard" style="margin-top:24px;padding:12px 24px;">Voltar ao Dashboard</button>
        </div>
      </div>`;
    document.getElementById('voltar-dashboard').addEventListener('click', ()=>{ window.location.href='index.html'; });
    return;
  }
  
  /* Se RDO nao completado, mostrar questionario */
  if(!rdoCompletado){
    root.innerHTML = renderRDOForm();
    root.querySelectorAll('.rdo-hora').forEach(inp=>{
      inp.addEventListener('input', ()=>{ maskHora(inp); });
      inp.addEventListener('blur', ()=>{ padHora(inp); });
    });
    document.getElementById('rdo-concluir').addEventListener('click', ()=>{
      const respostas = getRDORespostas();
      if(!respostasRDOPreenchidas()){
        toast('Responda todas as questões do RDO e preencha os horários (HH:MM) antes de continuar.', 'error');
        return;
      }
      // Guarda localmente — só será enviado junto com a conclusão das atividades
      try{
        savePendingRDO({ programacaoId: progId, ts: Date.now(), respostas: respostas });
      }catch(e){}
      rdoCompletado = true;
      toast('RDO concluído. As respostas serão enviadas quando você concluir as atividades.');
      render();
    });
    return;
  }
  
  const pr = findProjeto(DB, prog.projetoId);
  resetFotos();
  root.innerHTML = `
    <div class="panel section-gap">
      <div class="panel-head">
        <div><h3>${esc(pr?.nome||'Projeto')}</h3><div class="admin-field-meta">${esc(pr?.codigo||'')} · Ciclo ${esc(prog.ciclo||'—')}</div></div>
        <span class="badge" style="color:var(--teal);background:rgba(87,199,199,.12);">${fmtDate(prog.dataProgramada)}</span>
      </div>
      <div style="padding:16px;display:flex;flex-direction:column;gap:16px;">
        <div class="team-hint">${icon('alert',14)} <div>Edite apenas as <strong>atividades e quantidades</strong> da programação. A <strong>observação é obrigatória</strong> e cada atividade exige <strong>pelo menos 1 foto</strong> (câmera ou galeria). As alterações ficam salvas neste aparelho e são enviadas automaticamente quando houver internet.</div></div>
        ${Object.keys(editors).map(eqId=>renderTeamBlock(eqId)).join('')}
        <div class="field"><label>Observação <span class="req">*</span></label><textarea id="team-obs" rows="3" placeholder="Descreva o que mudou e o motivo">${esc(observacao)}</textarea></div>
        <button class="btn btn-primary" id="team-submit" style="align-self:flex-end;">${icon('check',15)} Enviar alterações</button>
      </div>
    </div>`;
  document.getElementById('team-obs').addEventListener('input', e=>{ observacao = e.target.value; });
  root.querySelectorAll('.te-select').forEach(s=>s.addEventListener('change', e=>{ const [eid,idx]=e.currentTarget.dataset.tes.split('|'); editors[eid][Number(idx)].atividadeId = e.target.value; }));
  root.querySelectorAll('.te-qty').forEach(s=>s.addEventListener('input', e=>{ const [eid,idx]=e.currentTarget.dataset.teq.split('|'); editors[eid][Number(idx)].quantidadePrevista = e.target.value; }));
  root.querySelectorAll('.te-exec').forEach(s=>s.addEventListener('input', e=>{ const [eid,idx]=e.currentTarget.dataset.tee.split('|'); editors[eid][Number(idx)].quantidadeExecutada = e.target.value; }));
  root.querySelectorAll('.te-remove').forEach(b=>b.addEventListener('click', e=>{ const [eid,idx]=e.currentTarget.dataset.eqRm.split('|'); editors[eid].splice(Number(idx),1); resetFotos(); render(); }));
  root.querySelectorAll('.te-add').forEach(b=>b.addEventListener('click', e=>{ editors[e.currentTarget.dataset.eqAdd].push({atividadeId:'',quantidadePrevista:''}); resetFotos(); render(); }));
  root.querySelectorAll('.te-camera').forEach(b=>b.addEventListener('click', ()=>{ const [eid,idx]=b.dataset.tec.split('|'); openPhotoPicker(eid, Number(idx), 'camera'); }));
  root.querySelectorAll('.te-gallery').forEach(b=>b.addEventListener('click', ()=>{ const [eid,idx]=b.dataset.teg.split('|'); openPhotoPicker(eid, Number(idx), 'gallery'); }));
  root.querySelectorAll('.te-photo-hint').forEach(h=>{
    const [eid,idx] = h.dataset.ph.split('|');
    const n = fotosCount(eid, Number(idx));
    h.textContent = n? `${n} foto${n>1?'s':''} adicionada${n>1?'s':''}` : 'Obrigatório: adicione ao menos 1 foto';
    h.className = 'te-photo-hint ' + (n? 'ok':'missing');
  });
  document.getElementById('team-submit').addEventListener('click', submitEdit);
}
function renderTeamBlock(eqId){
  const eq = findEquipe(DB, Number(eqId));
  const rows = editors[eqId];
  return `<div class="panel" style="border-color:var(--border);">
    <div class="panel-head"><h4>${equipeLabel(eq)}</h4><span class="badge-prefix">${eqtlLabel(eq)}</span></div>
    <div style="padding:12px 14px;">
      ${rows.map((r,i)=>`
        <div class="team-atividade">
          <div class="activity-row">
            <select class="te-select" data-tes="${eqId}|${i}"><option value="">Atividade…</option>${DB.atividades.map(a=>`<option value="${a.id}" ${String(r.atividadeId)===String(a.id)?'selected':''}>${esc(a.codigo)} · ${esc(a.descricao)}</option>`).join('')}</select>
            <div class="qty-field"><label>Prevista</label><input type="number" step="0.01" min="0" class="te-qty" data-teq="${eqId}|${i}" placeholder="Qtd." value="${r.quantidadePrevista??''}"></div>
            <div class="qty-field"><label>Executada</label><input type="number" step="0.01" min="0" class="te-exec" data-tee="${eqId}|${i}" placeholder="Qtd." value="${r.quantidadeExecutada??''}"></div>
            <button type="button" class="icon-btn te-remove" data-eq-rm="${eqId}|${i}" title="Remover atividade">${icon('close',13)}</button>
          </div>
          <div class="activity-fotos">
            <div class="te-thumbs" data-tef="${eqId}|${i}"></div>
            <div class="te-actions">
              <span class="te-photo-hint" data-ph="${eqId}|${i}"></span>
              <button type="button" class="btn btn-sm te-camera" data-tec="${eqId}|${i}">${icon('camera',13)} Câmera</button>
              <button type="button" class="btn btn-sm btn-ghost te-gallery" data-teg="${eqId}|${i}">${icon('image',13)} Galeria</button>
            </div>
          </div>
        </div>`).join('')}
      <button type="button" class="btn btn-sm te-add" data-eq-add="${eqId}">${icon('plus',13)} Adicionar atividade</button>
    </div>
  </div>`;
}

/* --- envio / fila offline --- */
/* ── FOTOS DOS REGISTROS (IMGGB) ── */
function openPhotoPicker(eqId, idx, modo){
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  if(modo==='camera') inp.setAttribute('capture','environment');
  inp.style.display = 'none';
  inp.onchange = ()=>{
    if(inp.files && inp.files[0]) addFoto(eqId, idx, inp.files[0]);
    inp.remove();
  };
  document.body.appendChild(inp);
  inp.click();
}
function addFoto(eqId, idx, file){
  if(!_fotos[eqId]) _fotos[eqId] = [];
  if(!_fotos[eqId][idx]) _fotos[eqId][idx] = [];
  _fotos[eqId][idx].push(file);
  atualizarFotosUI(eqId, idx);
}
function removerFoto(eqId, idx, fIdx){
  const arr = (_fotos[eqId]||[])[idx];
  if(!arr) return;
  arr.splice(fIdx,1);
  atualizarFotosUI(eqId, idx);
}
function fotoUrl(file){ return URL.createObjectURL(file); }
function atualizarFotosUI(eqId, idx){
  const thumbs = document.querySelector('.te-thumbs[data-tef="'+eqId+'|'+idx+'"]');
  if(!thumbs) return;
  const arr = (_fotos[eqId]||[])[idx]||[];
  thumbs.innerHTML = arr.map((f,i)=>`
    <div class="te-thumb">
      <img src="${fotoUrl(f)}" alt="foto">
      <button type="button" class="icon-btn te-del-foto" data-te-df="${eqId}|${idx}|${i}" title="Remover foto">${icon('close',13)}</button>
    </div>`).join('');
  thumbs.querySelectorAll('.te-del-foto').forEach(b=>{
    b.addEventListener('click', ()=>{
      const p = b.dataset.teDf.split('|');
      removerFoto(p[0], Number(p[1]), Number(p[2]));
    });
  });
}
function resetFotos(){
  _fotos = {};
  Object.keys(editors).forEach(eqId=>{ _fotos[eqId] = editors[eqId].map(()=>[]); });
}
function fotosCount(eqId, idx){
  return ((_fotos[eqId]||[])[idx]||[]).length;
}
async function uploadToImGbb(file){
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch('https://api.imgbb.com/1/upload?key='+IMGGB_KEY, { method:'POST', body: fd });
  const j = await res.json();
  if(!j.success) throw new Error((j.error&&j.error.message)||'Falha no upload');
  return (j.data && (j.data.url || j.data.display_url)) || '';
}

async function submitEdit(){
  const obs = observacao.trim();
  if(!obs){ toast('A observação é obrigatória.', 'error'); return; }
  for(const eqId of Object.keys(editors)){
    const rows = editors[eqId];
    if(!rows.length){ toast('Cada equipe precisa de ao menos uma atividade.', 'error'); return; }
    if(rows.some(r=>!r.atividadeId)){ toast('Selecione a atividade em todas as linhas.', 'error'); return; }
    for(let i=0;i<rows.length;i++){
      if(!fotosCount(eqId, i)){ toast('Cada atividade precisa de pelo menos 1 foto.', 'error'); return; }
    }
  }
  if(_fotosEnviando) return;
  if(navigator.onLine === false){ toast('Conecte-se à internet para enviar as fotos das atividades.', 'error'); return; }
  _fotosEnviando = true;
  const btn = document.getElementById('team-submit');
  if(btn){ btn.disabled = true; btn.textContent = 'Enviando fotos…'; }
  try{
    const fotosUrls = {};
    for(const eqId of Object.keys(editors)){
      const arr = _fotos[eqId]||[];
      fotosUrls[eqId] = [];
      for(let i=0;i<editors[eqId].length;i++){
        const urls = [];
        for(const f of (arr[i]||[])){
          const u = await uploadToImGbb(f);
          if(u) urls.push(u);
        }
        fotosUrls[eqId].push(urls.join(FOTOS_SEP));
      }
    }
    const patch = {
      id: 'e'+Date.now()+Math.random().toString(36).slice(2,6),
      programacaoId: progId,
      ts: Date.now(),
      observacao: obs,
      atribuicoes: Object.keys(editors).map(eqId=>({
        equipeId: Number(eqId),
        atividades: editors[eqId].map((r,i)=>({
          atividadeId: Number(r.atividadeId),
          quantidadePrevista: r.quantidadePrevista? parseFloat(r.quantidadePrevista): null,
          quantidadeExecutada: (r.quantidadeExecutada===''||r.quantidadeExecutada==null)? null : parseFloat(r.quantidadeExecutada),
          fotos: fotosUrls[eqId][i]||''
        }))
      }))
    };
    // Envia as respostas do RDO junto com a conclusão das atividades
    const pendRDO = loadPendingRDO(progId);
    if(pendRDO && pendRDO.respostas){
      patch.respostas = pendRDO.respostas;
      clearPendingRDO(progId);
    }
    const q = loadQueue(); q.push(patch); saveQueue(q);
    observacao = '';
    enviado = true;
    render();
    syncNow();
  }catch(err){
    console.error(err);
    toast('Erro ao enviar as fotos. Tente novamente.', 'error');
  }finally{
    _fotosEnviando = false;
    if(btn){ btn.disabled = false; btn.textContent = 'Enviar alterações'; }
  }
}
async function syncNow(){
  if(syncing) return;
  const q = loadQueue();
  if(!q.length){ setStatus(online? 'Tudo em dia' : 'Offline — aguardando conexão', online? 'ok':'warn'); return; }
  if(navigator.onLine === false){ setStatus('Offline — aguardando internet para enviar', 'warn'); return; }
  syncing = true;
  setStatus('Enviando alterações…');
  try{
    const snap = await DB_REF.once('value');
    let db;
    if(snap.exists()){
      const v = snap.val();
      db = (typeof v==='string')? JSON.parse(v) : v;
    }else{
      db = { equipes:[], atividades:[], projetos:[], programacoes:[], usuarios:[], customFields:{equipes:[],atividades:[],projetos:[],programacoes:[]}, seq:1 };
    }
    let changed = false;
    q.forEach(patch=>{
      const pg = (db.programacoes||[]).find(p=>p.id===Number(patch.programacaoId));
      if(!pg) return;
      (pg.atribuicoes||[]).forEach(at=>{
        const pa = (patch.atribuicoes||[]).find(x=>String(x.equipeId)===String(at.equipeId));
        if(!pa) return;
        const existing = at.atividades||[];
        at.atividades = pa.atividades.map(x=>({
          atividadeId: Number(x.atividadeId),
          quantidadePrevista: x.quantidadePrevista,
          quantidadeExecutada: x.quantidadeExecutada != null ? x.quantidadeExecutada : (existing.find(y=>String(y.atividadeId)===String(x.atividadeId))?.quantidadeExecutada ?? null),
          fotos: x.fotos || existing.find(y=>String(y.atividadeId)===String(x.atividadeId))?.fotos || ''
        }));
        at.historico = at.historico||[];
        at.historico.push({ usuarioNome:'Equipe', usuarioLogin:'', ts:patch.ts, tipo:'equipe', de:null, para:'atividades', motivo:patch.observacao });
        // Propagar dados do RDO
        if(patch.respostas){
          at.rdoRespostas = patch.respostas;
          at.rdoHorarioChegada = patch.respostas.rdo_horario_chegada || at.rdoHorarioChegada;
          at.rdoHorarioInicio = patch.respostas.rdo_horario_inicio || at.rdoHorarioInicio;
          at.rdoHorarioFinalizacao = patch.respostas.rdo_horario_finalizacao || at.rdoHorarioFinalizacao;
          at.rdoHorarioSaidaObra = patch.respostas.rdo_horario_saida_obra || at.rdoHorarioSaidaObra;
          at.rdoHorarioChegadaBase = patch.respostas.rdo_horario_chegada_base || at.rdoHorarioChegadaBase;
          at.rdoCondicoes = patch.respostas.rdo_condicoes || at.rdoCondicoes;
          at.rdoImpedimento = patch.respostas.rdo_impedimento || at.rdoImpedimento;
          at.rdoFaltaMaterial = patch.respostas.rdo_falta_material || at.rdoFaltaMaterial;
          at.rdoProjetoIncoerente = patch.respostas.rdo_projeto_incoerente || at.rdoProjetoIncoerente;
          at.rdoEquipeIncompleta = patch.respostas.rdo_equipe_incompleta || at.rdoEquipeIncompleta;
          at.rdoFaltaVeiculo = patch.respostas.rdo_falta_veiculo || at.rdoFaltaVeiculo;
          at.rdoImpedimentoAcesso = patch.respostas.rdo_impedimento_acesso || at.rdoImpedimentoAcesso;
          at.rdoLicencaAmbiental = patch.respostas.rdo_licenca_ambiental || at.rdoLicencaAmbiental;
          at.rdoAutorizacaoEmbargo = patch.respostas.rdo_autorizacao_embargo || at.rdoAutorizacaoEmbargo;
          at.rdoDesligamento = patch.respostas.rdo_desligamento || at.rdoDesligamento;
        }
        changed = true;
      });
    });
    if(changed){
      await DB_REF.set(JSON.stringify(db));
      DB = db; saveCache(db); dbToEditors(db);
    }
    saveQueue([]);
    setStatus('Alterações enviadas ✓', 'ok');
    toast('Alterações enviadas ao escritório.');
    render();
  }catch(err){
    console.error('Falha ao sincronizar', err);
    setStatus('Falha ao enviar. Tentativa automática quando houver conexão.', 'warn');
  }finally{
    syncing = false;
  }
}

/* --- init --- */
function init(){
  if(!progId){
    render();
    setStatus('Link inválido', 'warn');
    return;
  }
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(()=>{}); }
  const cached = loadCache();
  if(cached){ DB = cached; dbToEditors(DB); atualizaRDOCompletado(); render(); }
  /* Persistência offline já vem habilitada por padrão no Firebase Web SDK
     (v9+/10.x compat) — não usar database.setPersistenceEnabled aqui. */
  window.addEventListener('online', ()=>{ online=true; setStatus('Conectado — sincronizando…','ok'); syncNow(); });
  window.addEventListener('offline', ()=>{ online=false; setStatus('Offline — as alterações serão enviadas quando houver conexão','warn'); });
  DB_REF.once('value').then(snap=>{
    if(snap.exists()){
      const v = snap.val();
      DB = (typeof v==='string')? JSON.parse(v) : v;
      saveCache(DB); dbToEditors(DB);
    }
    // Verificar acesso após carregar dados
    const pg = DB?.programacoes?.find(p=>p.id===progId);
    if(pg){
      // Verificar se data venceu
      if(checkDataProgramadaExpirada()){
        setStatus('Programação vencida — acesso negado', 'warn');
        // A render() será chamada dentro do fluxo depois
      }
    }
    atualizaRDOCompletado();
    render();
  }).catch(()=>{ render(); }).finally(()=>{ syncNow(); });
}
init();
