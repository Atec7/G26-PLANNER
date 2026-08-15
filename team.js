/* =========================================================
   G26 Planner · Página da equipe (offline-first + sync automático)
   Permite editar APENAS as atividades/quantidades da programação,
   com observação obrigatória. Funciona offline (fila local) e
   sincroniza sozinho quando a internet volta.
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
  check:'<path d="M20 6 9 17l-5-5"/>'
};
function icon(name,size){ return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]||''}</svg>`; }

/* --- estado --- */
let DB = null;
const progId = Number(new URLSearchParams(location.search).get('equipe')) || null;
let prog = null;
let editors = {};
let observacao = '';
let online = navigator.onLine !== false;
let syncing = false;
const statusEl = document.getElementById('team-status');

function setStatus(txt, kind){
  if(!statusEl) return;
  statusEl.textContent = txt;
  statusEl.className = 'team-conn ' + (kind||'');
}

function dbToEditors(db){
  if(!db || !progId) return null;
  const pg = (db.programacoes||[]).find(p=>p.id===progId);
  if(!pg) return null;
  prog = pg;
  editors = {};
  (pg.atribuicoes||[]).forEach(at=>{
    editors[at.equipeId] = (at.atividades||[]).map(a=>({ atividadeId:String(a.atividadeId), quantidadePrevista: a.quantidadePrevista??'' }));
  });
  return pg;
}

/* --- render --- */
function render(){
  const root = document.getElementById('team-body');
  if(!progId){ root.innerHTML = `<div class="panel"><div class="empty-state"><p>Link inválido — faltou identificar a programação.</p></div></div>`; return; }
  if(!prog){ root.innerHTML = `<div class="panel"><div class="empty-state"><p>Programação não encontrada.</p><p style="font-size:12px;color:var(--muted-2);">Conecte-se ao menos uma vez para carregar os dados, ou tente novamente com internet.</p></div></div>`; return; }
  const pr = findProjeto(DB, prog.projetoId);
  root.innerHTML = `
    <div class="panel section-gap">
      <div class="panel-head">
        <div><h3>${esc(pr?.nome||'Projeto')}</h3><div class="admin-field-meta">${esc(pr?.codigo||'')} · Ciclo ${esc(prog.ciclo||'—')}</div></div>
        <span class="badge" style="color:var(--teal);background:rgba(87,199,199,.12);">${fmtDate(prog.dataProgramada)}</span>
      </div>
      <div style="padding:16px;display:flex;flex-direction:column;gap:16px;">
        <div class="team-hint">${icon('alert',14)} <div>Edite apenas as <strong>atividades e quantidades</strong> da programação. A <strong>observação é obrigatória</strong>. As alterações ficam salvas neste aparelho e são enviadas automaticamente quando houver internet.</div></div>
        ${Object.keys(editors).map(eqId=>renderTeamBlock(eqId)).join('')}
        <div class="field"><label>Observação <span class="req">*</span></label><textarea id="team-obs" rows="3" placeholder="Descreva o que mudou e o motivo">${esc(observacao)}</textarea></div>
        <button class="btn btn-primary" id="team-submit" style="align-self:flex-end;">${icon('check',15)} Enviar alterações</button>
      </div>
    </div>`;
  document.getElementById('team-obs').addEventListener('input', e=>{ observacao = e.target.value; });
  root.querySelectorAll('.te-select').forEach(s=>s.addEventListener('change', e=>{ const [eid,idx]=e.currentTarget.dataset.tes.split('|'); editors[eid][Number(idx)].atividadeId = e.target.value; }));
  root.querySelectorAll('.te-qty').forEach(s=>s.addEventListener('input', e=>{ const [eid,idx]=e.currentTarget.dataset.teq.split('|'); editors[eid][Number(idx)].quantidadePrevista = e.target.value; }));
  root.querySelectorAll('.te-remove').forEach(b=>b.addEventListener('click', e=>{ const [eid,idx]=e.currentTarget.dataset.eqRm.split('|'); editors[eid].splice(Number(idx),1); render(); }));
  root.querySelectorAll('.te-add').forEach(b=>b.addEventListener('click', e=>{ editors[e.currentTarget.dataset.eqAdd].push({atividadeId:'',quantidadePrevista:''}); render(); }));
  document.getElementById('team-submit').addEventListener('click', submitEdit);
}
function renderTeamBlock(eqId){
  const eq = findEquipe(DB, Number(eqId));
  const rows = editors[eqId];
  return `<div class="panel" style="border-color:var(--border);">
    <div class="panel-head"><h4>${equipeLabel(eq)}</h4><span class="badge-prefix">${eqtlLabel(eq)}</span></div>
    <div style="padding:12px 14px;">
      ${rows.map((r,i)=>`
        <div class="activity-row">
          <select class="te-select" data-tes="${eqId}|${i}"><option value="">Atividade…</option>${DB.atividades.map(a=>`<option value="${a.id}" ${String(r.atividadeId)===String(a.id)?'selected':''}>${esc(a.codigo)} · ${esc(a.descricao)}</option>`).join('')}</select>
          <input type="number" step="0.01" min="0" class="te-qty" data-teq="${eqId}|${i}" placeholder="Qtd." value="${r.quantidadePrevista??''}">
          <button type="button" class="icon-btn te-remove" data-eq-rm="${eqId}|${i}" title="Remover atividade">${icon('close',13)}</button>
        </div>`).join('')}
      <button type="button" class="btn btn-sm te-add" data-eq-add="${eqId}">${icon('plus',13)} Adicionar atividade</button>
    </div>
  </div>`;
}

/* --- envio / fila offline --- */
function submitEdit(){
  const obs = observacao.trim();
  if(!obs){ toast('A observação é obrigatória.', 'error'); return; }
  for(const eqId of Object.keys(editors)){
    const rows = editors[eqId];
    if(!rows.length){ toast('Cada equipe precisa de ao menos uma atividade.', 'error'); return; }
    if(rows.some(r=>!r.atividadeId)){ toast('Selecione a atividade em todas as linhas.', 'error'); return; }
  }
  const patch = {
    id: 'e'+Date.now()+Math.random().toString(36).slice(2,6),
    programacaoId: progId,
    ts: Date.now(),
    observacao: obs,
    atribuicoes: Object.keys(editors).map(eqId=>({
      equipeId: Number(eqId),
      atividades: editors[eqId].map(r=>({ atividadeId: Number(r.atividadeId), quantidadePrevista: r.quantidadePrevista? parseFloat(r.quantidadePrevista): null }))
    }))
  };
  const q = loadQueue(); q.push(patch); saveQueue(q);
  observacao = '';
  toast('Alterações registradas neste aparelho. Envio automático quando houver internet.');
  render();
  syncNow();
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
          quantidadeExecutada: existing.find(y=>String(y.atividadeId)===String(x.atividadeId))?.quantidadeExecutada ?? null
        }));
        at.historico = at.historico||[];
        at.historico.push({ usuarioNome:'Equipe', usuarioLogin:'', ts:patch.ts, tipo:'equipe', de:null, para:'atividades', motivo:patch.observacao });
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
  if(cached){ DB = cached; dbToEditors(DB); render(); }
  database.setPersistenceEnabled(true).catch(()=>{});
  window.addEventListener('online', ()=>{ online=true; setStatus('Conectado — sincronizando…','ok'); syncNow(); });
  window.addEventListener('offline', ()=>{ online=false; setStatus('Offline — as alterações serão enviadas quando houver conexão','warn'); });
  DB_REF.once('value').then(snap=>{
    if(snap.exists()){
      const v = snap.val();
      DB = (typeof v==='string')? JSON.parse(v) : v;
      saveCache(DB); dbToEditors(DB);
    }
    render();
  }).catch(()=>{ render(); }).finally(()=>{ syncNow(); });
}
init();
