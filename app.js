/* =========================================================
   FIREBASE (Realtime Database) — dados na nuvem
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

const app = firebase.initializeApp(firebaseConfig);
const analytics = firebase.analytics(app);
const rtdb = firebase.database(app);
const DB_REF = rtdb.ref('g26_planner/data');
const PRES_REF = rtdb.ref('g26_planner/presenca');

const DEFAULT_DATA = {
  equipes: [], atividades: [], projetos: [], programacoes: [], usuarios: [],
  customFields: { equipes: [], atividades: [], projetos: [], programacoes: [] },
  seq: 1
};
function mergeData(raw){
  if(!raw || typeof raw!=='object') return structuredClone(DEFAULT_DATA);
  const merged = Object.assign(structuredClone(DEFAULT_DATA), raw);
  merged.customFields = Object.assign(structuredClone(DEFAULT_DATA.customFields), raw.customFields||{});
  merged.seq = Number(merged.seq)||1;
  migrarGids(merged);
  return merged;
}
function migrarGids(db){
  (db||DB).programacoes = (db||DB).programacoes||[];
  (db||DB).programacoes.forEach(pg=>{ if(!pg.gid) pg.gid = novoGid(); });
}
let saveQueue = Promise.resolve();
let saveTimer = null;
let lastWrittenJson = null;
let warnSaveFail = false;
function saveData(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=>{ saveTimer=null; flushSave(); }, 300);
}
function flushSave(){
  const snapshot = JSON.stringify(DB);
  lastWrittenJson = snapshot;
  saveQueue = saveQueue
    .then(()=> DB_REF.set(snapshot))
    .catch(err=>{ console.error('Falha ao salvar no Firebase', err); if(!warnSaveFail){ warnSaveFail=true; toast('Falha ao salvar no banco: '+err.message, 'error'); } });
}
function nextId(){ DB.seq = (DB.seq||1)+1; return DB.seq; }

let DB = structuredClone(DEFAULT_DATA);
let currentView = 'dashboard';
let progFilters = (()=>{ const r=monthRangeISO(); return { projeto:'', equipe:'', status:'Programado', ciclo:'', dataDe:r.de, dataAte:r.ate, modo:'lista', calView:'mes', calDay:todayISO() }; })();
let ativFilters = { q:'', fav:'' };
let equipeFilters = { q:'', status:'' };
let projFilters = { q:'', status:'' };
let avancoFilters = { q:'', status:'' };
let histFilters = { tipo:'', projeto:'', dataDe:'', dataAte:'', ultimasHs:12 };
let calRef = new Date();
let CURRENT_USER = null;
function currentAutor(){ return { usuarioNome: CURRENT_USER?.nome || 'Sistema', usuarioLogin: CURRENT_USER?.login || '' }; }
function autor(h){
  if(h && h.usuarioNome && h.usuarioNome!=='Sistema') return esc(h.usuarioNome)+(h.usuarioLogin? ` (${esc(h.usuarioLogin)})`:'');
  return 'Sistema';
}

/* =========================================================
   CONSTANTES DE DOMÍNIO
========================================================= */
const STATUS_PROG = ['Programado','Em Execução','Concluído','Reprogramado','Cancelado'];
const STATUS_COLOR = { 'Programado':'var(--blue)','Em Execução':'var(--accent)','Concluído':'var(--green)','Reprogramado':'var(--purple)','Cancelado':'var(--red)' };
const STATUS_PROJETO = ['Aguardando Viabilidade','Em Andamento','Concluído','Encerrado','Cancelado'];
const MOTIVOS_REPROG = [
  'Condições climáticas','Falta de material','Falta de equipamento','Indisponibilidade de equipe',
  'Prioridade emergencial (urgência)','Solicitação da concessionária / cliente','Pendência de liberação / desligamento',
  'Falha de acesso ao local','Outro'
];
const CUSTOM_FIELD_TYPES = [{v:'texto',l:'Texto'},{v:'numero',l:'Número'},{v:'data',l:'Data'},{v:'select',l:'Lista (opções)'}];
const RDO_QUESTIONS = [
  { id:'rdo_condicoes', label:'Condições climáticas' },
  { id:'rdo_impedimento', label:'Impedimento de execução' },
  { id:'rdo_falta_material', label:'Falta de material' },
  { id:'rdo_projeto_incoerente', label:'Projeto incoerente' },
  { id:'rdo_equipe_incompleta', label:'Equipe incompleta' },
  { id:'rdo_falta_veiculo', label:'Falta de veículo' },
  { id:'rdo_impedimento_acesso', label:'Impedimento de acesso' },
  { id:'rdo_licenca_ambiental', label:'Licença ambiental' },
  { id:'rdo_autorizacao_embargo', label:'Autorização/embargo' },
  { id:'rdo_desligamento', label:'Desligamento conforme programado' }
];
const RDO_HORARIOS = [
  { k:'rdoHorarioChegada', label:'Horário Chegada' },
  { k:'rdoHorarioInicio', label:'Horário Início das atividades' },
  { k:'rdoHorarioFinalizacao', label:'Horário Finalização das atividades' },
  { k:'rdoHorarioSaidaObra', label:'Horário Saída da obra' },
  { k:'rdoHorarioChegadaBase', label:'Horário Chegada na base' }
];
const IMGGB_KEY = '95bb16ee776d7e20f26857cec98bd372';
const MODULOS_ADMIN = [{k:'equipes',l:'Equipes'},{k:'atividades',l:'Atividades'},{k:'projetos',l:'Projetos'},{k:'programacoes',l:'Programações'}];
const ROLES = [
  { v:'administrador', l:'Administrador', d:'Acesso total ao sistema' },
  { v:'supervisor', l:'Programador', d:'Programa, edita e acompanha execução' },
  { v:'operador', l:'Operador', d:'Somente leitura (visualização)' }
];
const NIVEIS_ACESSO = [
  { v:'total', l:'Total', d:'Todas as telas e ações' },
  { v:'programacao', l:'Programação', d:'Equipes, Atividades, Projetos, Programações, Avanço e Histórico' },
  { v:'leitura', l:'Somente leitura', d:'Visualização geral sem edição' }
];
function roleLabel(v){ return ROLES.find(r=>r.v===v)?.l || v; }
function nivelLabel(v){ return NIVEIS_ACESSO.find(n=>n.v===v)?.l || v; }

/* =========================================================
   NAVEGAÇÃO
========================================================= */
const NAV_ITEMS = [
  { id:'dashboard',   label:'Painel',        sub:'Visão geral do sistema', icon:'grid' },
  { id:'alertas',     label:'Alertas',       sub:'Projetos vencendo, reprogramações e viabilidade', icon:'alert' },
  { id:'equipes',     label:'Equipes',       sub:'Cadastro de equipes de campo', icon:'users' },
  { id:'atividades',  label:'Atividades',    sub:'Cadastro de códigos e valores unitários', icon:'list' },
  { id:'projetos',    label:'Projetos',      sub:'Cadastro de projetos', icon:'folder' },
  { id:'avanco',      label:'Avanço',        sub:'Progresso físico e financeiro', icon:'trend' },
  { id:'programacoes',label:'Programações',  sub:'Agenda, fluxo e reprogramação', icon:'calendar' },
  { id:'RDO',         label:'RDO',           sub:'Execução das equipes em campo', icon:'clipboard' },
  { id:'historico',   label:'Histórico',     sub:'Linha do tempo de todas as alterações', icon:'clock' },
  { id:'admin',       label:'Administração', sub:'Campos personalizados de cada módulo', icon:'gear' },
];
const ICONS = {
  grid:'<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>',
  users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  calendar:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash:'<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  history:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  reprog:'<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
  close:'<path d="M18 6 6 18M6 6l12 12"/>',
  empty:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M9 10h6M9 14h4"/>',
  chevL:'<path d="M15 18l-6-6 6-6"/>', chevR:'<path d="M9 18l6-6-6-6"/>', alert:'<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/>',
  trend:'<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  star:'<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  print:'<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  whatsapp:'<path d="M21.11 4.88A11.47 11.47 0 0 0 12 2a11.5 11.5 0 0 0-8.14 19.5L2 22l2.6-1.82A11.47 11.47 0 0 0 12 23.5a11.5 11.5 0 0 0 8.14-19.62Z"/><path d="M8.6 8.9c.3-.1.6-.1.8.2l.9 1.4c.1.3.1.6-.1.8l-.5.6c.2.6.7 1.4 1.5 2.1.9.8 1.7 1.1 2.3 1.3l.6-.5c.2-.2.5-.3.8-.1l1.4.9c.3.2.4.5.2.8-.3.6-1 1.1-1.6 1.1-1.4 0-3.6-.8-5.8-3-2.3-2.3-3-4.5-3-5.9.1-.7.6-1.4 1.4-1.7Z"/>',
  hash:'<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
  clipboard:'<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 12h6M9 16h6"/>',
  pulse:'<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  database:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  pin:'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/>',
};
function icon(name,size=16){ return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]||''}</svg>`; }

    function renderNav(){
      const nav = document.getElementById('nav');
      const items = NAV_ITEMS.filter(it=> it.id!=='admin' || (CURRENT_USER && CURRENT_USER.role==='administrador'));
      const alertTotal = alertaCount();
      nav.innerHTML = items.map((it,i) => {
        const badge = it.id==='alertas' && alertTotal>0 ? `<span class="nav-badge">${alertTotal}</span>` : '';
        return `${i===items.length-1?'<div class="nav-sep"></div>':''}<button class="nav-item ${currentView===it.id?'active':''}" data-view="${it.id}">${icon(it.icon)}<span>${it.label}</span>${badge}</button>`;
      }).join('');
      nav.querySelectorAll('.nav-item').forEach(btn=> btn.addEventListener('click', ()=> setView(btn.dataset.view)));
    }
function setView(view){
  currentView = view;
  document.getElementById('sidebar').classList.remove('open');
  const meta = NAV_ITEMS.find(i=>i.id===view);
  document.getElementById('page-title').textContent = meta.label;
  document.getElementById('page-sub').textContent = meta.sub;
  renderNav(); renderTopbarActions(); renderContent(); renderBanner();
  atualizarPresencaView();
}
document.getElementById('mobile-toggle').addEventListener('click', ()=> document.getElementById('sidebar').classList.toggle('open'));

function renderTopbarActions(){
  const el = document.getElementById('topbar-actions');
  el.innerHTML = '';
  const primary = (podeEditar()? {
    equipes: ()=>actionBtn('Nova equipe', ()=>openEquipeModal()),
    atividades: ()=>actionBtn('Nova atividade', ()=>openAtividadeModal()),
    projetos: ()=>actionBtn('Novo projeto', ()=>openProjetoModal()),
    programacoes: ()=>actionBtn('Nova programação', ()=>openProgramacaoModal()),
  } : {});
  const exportMap = {
    equipes: ()=>btnSecondary('Excel', exportEquipesCSV),
    atividades: ()=>btnSecondary('Excel', exportAtividadesCSV),
    projetos: ()=>btnSecondary('Excel', exportProjetosCSV),
    programacoes: ()=>btnSecondary('Excel', exportProgramacoesCSV),
    avanco: ()=>btnSecondary('Excel', exportAvancoCSV),
    historico: ()=>btnSecondary('Excel', exportHistoricoCSV),
    alertas: ()=>btnSecondary('Excel', exportAlertasCSV),
  };
  const docMap = {
    programacoes: ()=>btnSecondary('Documento de campo', openDocumentoDataModal),
  };
  const importMap = (podeEditar()? {
    atividades: ()=>btnSecondary('Importar em massa', openImportAtividadesModal),
  } : {});
  if(exportMap[currentView]) el.appendChild(exportMap[currentView]());
  if(importMap[currentView]) el.appendChild(importMap[currentView]());
  if(docMap[currentView]) el.appendChild(docMap[currentView]());
  if(primary[currentView]) el.appendChild(primary[currentView]());
}
function actionBtn(label, onClick){
  const b = document.createElement('button');
  b.className='btn btn-primary';
  b.innerHTML = icon('plus',15)+`<span>${label}</span>`;
  b.addEventListener('click', onClick);
  return b;
}
function btnSecondary(label, onClick){
  const b = document.createElement('button');
  b.className='btn';
  b.innerHTML = icon('download',14)+`<span>${label}</span>`;
  b.addEventListener('click', onClick);
  return b;
}

/* =========================================================
   HELPERS
========================================================= */
function fmtDate(iso){ if(!iso) return '—'; const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; }
function fmtDateTime(iso){ const dt=new Date(iso); return dt.toLocaleDateString('pt-BR')+' '+dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); }
function fmtMoney(v){ return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function fmtNum(v){ return (Number(v)||0).toLocaleString('pt-BR',{maximumFractionDigits:2}); }
function todayISO(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function monthRangeISO(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const lastDay = new Date(y, d.getMonth()+1, 0).getDate();
  return { de: y+'-'+m+'-01', ate: y+'-'+m+'-'+String(lastDay).padStart(2,'0') };
}
function diasEntre(de, ate){
  if(!de || !ate) return null;
  return Math.round((new Date(ate+'T12:00:00') - new Date(de+'T12:00:00'))/86400000);
}
function isLate(atrib){ return atrib.dataProgramada < todayISO() && !['Concluído','Cancelado'].includes(atrib.status); }
const ALERT_VENCER_DIAS = 30;
const ALERT_VIABILIDADE_DIAS = 20;
const ALERT_VIAB_BREVE_DIAS = 5;
function prazoViabilidadeProjeto(p){
  if(!p?.dataRecebimentoCarteira) return '';
  return shiftISO(p.dataRecebimentoCarteira, ALERT_VIABILIDADE_DIAS);
}
function equipeLabel(eq){
  if(!eq) return '—';
  const parts=[];
  if(eq.eqtl) parts.push(eq.eqtl);
  if(eq.prtn) parts.push(eq.prtn);
  return parts.length? parts.join(' / ') : ('Equipe #'+eq.id);
}
function eqtlLabel(eq){ return (eq && eq.eqtl)? eq.eqtl : '—'; }
function prtnLabel(eq){ return (eq && eq.prtn)? eq.prtn : '—'; }
function cicloMask(v){
  const d = String(v??'').replace(/\D/g,'').slice(0,6);
  if(!d) return '';
  return 'CICLO-' + d.slice(0,2) + (d.length>2? '/'+d.slice(2,6) : '');
}
function isCicloValido(v){ return /^CICLO-\d{2}\/\d{4}$/.test(String(v??'')); }
function bindCicloMasks(root){
  root.querySelectorAll('.ciclo-input').forEach(inp=>{
    inp.addEventListener('input', ()=>{ inp.value = cicloMask(inp.value); });
  });
}
function metaDiaria(eq){ return Number(eq?.metaDiaria)||0; }
function valorProgramadoAtrib(atrib){
  return (atrib?.atividades||[]).reduce((s,a)=> s + ((a.quantidadePrevista||0)*(findAtividade(a.atividadeId)?.valorUnitario||0)), 0);
}
function metaWarningHtml(atrib){
  const eq = findEquipe(atrib?.equipeId); const meta = metaDiaria(eq); if(!meta) return '';
  const val = valorProgramadoAtrib(atrib);
  if(val >= meta) return '';
  return `<span class="badge meta-warn" title="Meta diária da equipe: ${fmtMoney(meta)}">${icon('alert',11)} ${fmtMoney(val)} de ${fmtMoney(meta)}</span>`;
}
function findEquipe(id){ return DB.equipes.find(e=>e.id===Number(id)); }
function findAtividade(id){ return DB.atividades.find(a=>a.id===Number(id)); }
function findProjeto(id){ return DB.projetos.find(p=>p.id===Number(id)); }
function esc(s){ return String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function anexoSrc(a){ return (a&&(a.url||a.dataUrl))||''; }
function uploadToImgbb(file, tentativas=3){
  const fd = new FormData();
  fd.append('image', file);
  return fetch('https://api.imgbb.com/1/upload?key='+IMGGB_KEY, { method:'POST', body: fd })
    .then(res=>res.json())
    .then(j=>{
      if(j.success) return (j.data && (j.data.url || j.data.display_url)) || '';
      const msg = (j.error&&j.error.message)||'Falha no upload';
      if(tentativas>1) return new Promise(resolve=>setTimeout(()=>resolve(uploadToImgbb(file, tentativas-1)), 800));
      throw new Error(msg);
    });
}
function comprimirImagem(file, maxLado=1800, qualidade=0.88){
  return new Promise((resolve, reject)=>{
    if(!file || !/^image\//.test(file.type)){ reject(new Error('Arquivo não é imagem')); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = ()=>{
      try{
        const escala = Math.min(1, maxLado/Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth*escala));
        const h = Math.max(1, Math.round(img.naturalHeight*escala));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob=>{
          URL.revokeObjectURL(url);
          blob? resolve(blob) : reject(new Error('Falha na compressão'));
        }, 'image/jpeg', qualidade);
      }catch(e){ URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = ()=>{ URL.revokeObjectURL(url); reject(new Error('Imagem inválida')); };
    img.src = url;
  });
}
function anexosGridHtml(anexos, editable){
  const list = anexos||[];
  if(!list.length) return editable? '<div class="field-hint">Nenhum anexo ainda. Envie imagens para a equipe visualizar (croqui, localização, detalhe do serviço) — elas também saem no RDO.</div>' : '';
  return `<div class="anexos-grid">${list.map((a,i)=>`
    <div class="anexo-thumb">
      <img src="${esc(anexoSrc(a))}" alt="${esc(a.nome||'anexo')}">
      <div class="anexo-meta">${esc(a.nome||'')}</div>
      ${editable? `<button type="button" class="icon-btn anexo-remove" data-i="${i}" title="Remover anexo">${icon('close',12)}</button>`:''}
    </div>`).join('')}</div>`;
}
function anexosDisplayHtml(anexos, print=false){
  const list = anexos||[];
  if(!list.length) return '';
  if(print) return `<div class="fotos">${list.map(a=>`<figure><img src="${esc(anexoSrc(a))}" alt="${esc(a.nome||'anexo')}"><figcaption>${esc(a.nome||'Anexo do programador')}</figcaption></figure>`).join('')}</div>`;
  return `<div class="anexos-grid">${list.map(a=>`
    <div class="anexo-thumb" role="button" tabindex="0" title="${esc(a.nome||'')}">
      <img src="${esc(anexoSrc(a))}" alt="${esc(a.nome||'anexo')}">
      <div class="anexo-meta">${esc(a.nome||'')}</div>
    </div>`).join('')}</div>`;
}
function openLightbox(srcs, index){
  if(!srcs || !srcs.length) return;
  let i = Math.max(0, Math.min(index||0, srcs.length-1));
  const wrap = document.createElement('div');
  wrap.className = 'lb-overlay';
  wrap.innerHTML = `
    <button type="button" class="lb-close" title="Fechar (Esc)">&times;</button>
    ${srcs.length>1? `<button type="button" class="lb-nav lb-prev" title="Anterior">&#8249;</button><button type="button" class="lb-nav lb-next" title="Próxima">&#8250;</button>`:''}
    <div class="lb-counter">${i+1} / ${srcs.length}</div>
    <img class="lb-img" src="${esc(srcs[i])}" alt="">`;
  document.body.appendChild(wrap);
  const img = wrap.querySelector('.lb-img');
  const counter = wrap.querySelector('.lb-counter');
  function close(){ wrap.remove(); document.removeEventListener('keydown', onKey); }
  function show(){ img.src = srcs[i]; counter.textContent = (i+1)+' / '+srcs.length; }
  function onKey(e){
    if(e.key==='Escape') close();
    else if(e.key==='ArrowRight'){ i=(i+1)%srcs.length; show(); }
    else if(e.key==='ArrowLeft'){ i=(i-1+srcs.length)%srcs.length; show(); }
  }
  wrap.querySelector('.lb-close').addEventListener('click', close);
  const prev=wrap.querySelector('.lb-prev'), next=wrap.querySelector('.lb-next');
  if(prev) prev.addEventListener('click', e=>{ e.stopPropagation(); i=(i-1+srcs.length)%srcs.length; show(); });
  if(next) next.addEventListener('click', e=>{ e.stopPropagation(); i=(i+1)%srcs.length; show(); });
  wrap.addEventListener('click', e=>{ if(e.target===wrap) close(); });
  document.addEventListener('keydown', onKey);
}
document.addEventListener('click', (e)=>{
  if(e.target.closest('.anexo-remove')) return;
  const thumb = e.target.closest('.anexos-grid .anexo-thumb');
  if(thumb){
    const grid = thumb.closest('.anexos-grid');
    const thumbs = Array.from(grid.querySelectorAll('.anexo-thumb'));
    openLightbox(thumbs.map(t=>t.querySelector('img').src), thumbs.indexOf(thumb));
    return;
  }
  const foto = e.target.closest('.rdo-foto');
  if(foto){
    const container = foto.closest('.rdo-fotos');
    const imgs = Array.from(container.querySelectorAll('.rdo-foto'));
    openLightbox(imgs.map(x=>x.src), imgs.indexOf(foto));
  }
});
function toast(msg, kind='ok'){
  const wrap = document.getElementById('toast-wrap');
  const t = document.createElement('div'); t.className='toast';
  if(kind==='error') t.style.borderLeftColor='var(--red)';
  t.textContent = msg; wrap.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transition='.25s'; setTimeout(()=>t.remove(),250); }, 2600);
}
function bgFromVar(cssVar){
  const map = {'var(--blue)':'rgba(91,141,239,.14)','var(--accent)':'rgba(224,164,88,.14)','var(--green)':'rgba(76,175,109,.14)','var(--purple)':'rgba(180,140,224,.14)','var(--red)':'rgba(224,97,91,.14)'};
  return map[cssVar] || 'rgba(255,255,255,.06)';
}
function statusBadge(status, pending){
  const c = STATUS_COLOR[status] || 'var(--muted)';
  return `<span class="badge ${pending?'blink-red':''}" style="color:${pending?'var(--red)':c};background:${bgFromVar(pending?'var(--red)':c)}"><span class="badge-dot"></span>${status}</span>`;
}
function atividadesResumo(atividadesArr){
  return atividadesArr.map(a=>{ const at=findAtividade(a.atividadeId); return `${esc(at?.codigo||'?')} · ${esc(at?.descricao||'')} ×${a.quantidadePrevista??'—'}`; }).join(', ');
}

/* --- Exportação Excel (CSV) --- */
function exportCSV(filename, headers, rows){
  const sep=';';
  const escCell = v => { v = String(v??''); return /[;"\n]/.test(v)? '"'+v.replace(/"/g,'""')+'"' : v; };
  const lines = [headers.map(escCell).join(sep), ...rows.map(r=>r.map(escCell).join(sep))];
  const blob = new Blob(["\uFEFF"+lines.join('\r\n')], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  toast('Exportado: '+filename);
}
function exportEquipesCSV(){
  exportCSV('equipes.csv',
    ['Nome da equipe','Nome complementar','Setor','Coordenação','Supervisor','Encarregado','Motorista','Meta diária','Eletricistas','Situação'],
    equipesVisiveis().map(e=>[e.eqtl, e.prtn, e.setor||'', e.coordenacao||'', e.supervisor, e.encarregado, e.motorista, e.metaDiaria||'', (e.eletricistas||[]).join(', '), e.ativo? 'Ativa':'Inativa']));
}
function exportAtividadesCSV(){
  exportCSV('atividades.csv',
    ['Código','Descrição','Unidade','Valor unitário','Favorita'],
    DB.atividades.map(a=>[a.codigo, a.descricao, a.unidade||'', fmtMoney(a.valorUnitario), a.fav? 'Sim':'Não']));
}
function exportProjetosCSV(){
  exportCSV('projetos.csv',
    ['Código','Nome','Início','Fim','Receb. carteira','Vencimento','Viabilização','Setor','Coordenação','Ciclo','Status','Orçado (R$)','Executado (R$)','Restante (R$)','% Físico','% Financeiro','Atividades concluídas','Atividades totais'],
    projetosVisiveis().map(p=>{
      const av = projetoAvanco(p);
      return [p.codigo, p.nome, fmtDate(p.dataInicio), fmtDate(p.dataFim), fmtDate(p.dataRecebimentoCarteira), fmtDate(p.dataVencimento), fmtDate(p.dataViabilizacao), p.setor||'', p.coordenacao||'', p.ciclo||'', p.status, fmtMoney(av.valorOrcado), fmtMoney(av.valorExecutado), fmtMoney(av.restante), av.fisicoPct.toFixed(1)+'%', av.financeiroPct.toFixed(1)+'%', av.concluidoLinhas, av.totalLinhas];
    }));
}
function exportAlertasCSV(){
  const hoje = todayISO();
  const rows = [];
  projetosVisiveis().forEach(p=>{
    if(['Concluído','Cancelado'].includes(p.status)) return;
    if(p.dataVencimento){
      const dias = diasEntre(hoje, p.dataVencimento);
      const sit = dias<0? `Vencido há ${-dias} dia(s)` : (dias===0? 'Vence hoje' : `Vence em ${dias} dia(s)`);
      rows.push(['Vencimento', p.codigo, p.nome, fmtDate(p.dataVencimento), sit, p.status]);
    }
    if(p.dataRecebimentoCarteira){
      const prazo = prazoViabilidadeProjeto(p);
      const dias = diasEntre(hoje, prazo);
      const sit = p.dataViabilizacao? `Viabilizado em ${fmtDate(p.dataViabilizacao)}` : (dias<0? `Viabilização atrasada há ${-dias} dia(s)` : `${dias} dia(s) para o prazo de viabilização`);
      rows.push(['Viabilidade', p.codigo, p.nome, fmtDate(prazo), sit, p.status]);
    }
  });
  flatAtribuicoes().filter(x=>x.atribuicao.status==='Reprogramado').forEach(x=>{
    const p=x.atribuicao, pr=findProjeto(x.programacao.projetoId);
    rows.push(['Reprogramação', pr?.codigo||'', pr?.nome||'', fmtDate(p.dataProgramada), 'Reprogramação pendente', p.status]);
  });
  exportCSV('alertas.csv', ['Tipo','Código','Projeto','Data referência','Situação','Status'], rows);
}
function exportProgramacoesCSV(){
  exportCSV('programacoes.csv',
    ['Data','Projeto','Setor','Coordenação','Ciclo','Equipe','Equipe comp.','Atividades','Valor previsto','Status'],
    programacoesFiltradas().map(x=>{
      const p=x.atribuicao, pr=findProjeto(x.programacao.projetoId), eq=findEquipe(p.equipeId);
      return [fmtDate(p.dataProgramada), pr?.nome||'-', pr?.setor||'', pr?.coordenacao||'', x.programacao.ciclo||'', eqtlLabel(eq), prtnLabel(eq), atividadesResumo(p.atividades), fmtMoney(valorProgramadoAtrib(p)), p.status];
    }));
}
function exportAvancoCSV(){
  exportCSV('avanco.csv',
    ['Código','Projeto','Status','Orçado (R$)','Executado (R$)','Restante (R$)','% Físico','% Financeiro','Concluídas','Total'],
    projetosVisiveis().map(p=>{
      const av = projetoAvanco(p);
      return [p.codigo, p.nome, p.status, fmtMoney(av.valorOrcado), fmtMoney(av.valorExecutado), fmtMoney(av.restante), av.fisicoPct.toFixed(1)+'%', av.financeiroPct.toFixed(1)+'%', av.concluidoLinhas, av.totalLinhas];
    }));
}
function exportHistoricoCSV(){
  const rows = [];
  flatAtribuicoes().forEach(x=>{
    const p=x.atribuicao, pr=findProjeto(x.programacao.projetoId), eq=findEquipe(p.equipeId);
    p.atividades.forEach(a=>{
      const at = findAtividade(a.atividadeId);
      const qtdPrev = a.quantidadePrevista??0;
      const qtdExec = (a.quantidadeExecutada!=null)? a.quantidadeExecutada : (p.status==='Concluído'? qtdPrev : 0);
      const vu = at?.valorUnitario||0;
      rows.push([
        fmtDate(p.dataProgramada), x.programacao.ciclo||'', pr?.codigo||'', pr?.nome||'', pr?.setor||'', pr?.coordenacao||'',
        eqtlLabel(eq), prtnLabel(eq), p.status, at?.codigo||'?', at?.descricao||'', at?.unidade||'',
        qtdPrev, qtdExec, vu, qtdPrev*vu, qtdExec*vu
      ]);
    });
  });
  exportCSV('historico_atividades.csv',
    ['Data','Ciclo','Projeto código','Projeto','Setor','Coordenação','Equipe','Equipe comp.','Status','Atividade código','Descrição','Unidade','Qtd. prevista','Qtd. executada','Valor unitário','Valor bruto previsto','Valor bruto executado'],
    rows);
}

/* --- Atividades favoritas --- */
function atividadesOrdenadas(){
  return [...DB.atividades].sort((a,b)=> (b.fav?1:0)-(a.fav?1:0) || String(a.codigo||'').localeCompare(String(b.codigo||''), 'pt', {numeric:true}));
}
function toggleFavAtividade(id){
  if(!requerEscrita()) return;
  const at = findAtividade(id); if(!at) return;
  at.fav = !at.fav; saveData(); renderContent(); toast(at.fav? 'Marcada como favorita.' : 'Removida das favoritas.');
}
function importarAtividadesTexto(texto){
  const parseValor = s => { const t=String(s??'').trim(); if(!t) return 0; const v = t.includes(',')? parseFloat(t.replace(/\./g,'').replace(',', '.')) : parseFloat(t); return isNaN(v)? 0 : v; };
  const codigoExiste = c => DB.atividades.some(a=>String(a.codigo).toLowerCase()===String(c).toLowerCase());
  let criadas=0, ignoradas=0, erros=0;
  const msgErro=[];
  texto.split(/\r?\n/).forEach((linha,i)=>{
    const partes = linha.split(/[;\t]/).map(p=>p.trim());
    const codigo = partes[0]||'';
    const descricao = partes[1]||'';
    if(!codigo || !descricao){ erros++; if(msgErro.length<3) msgErro.push('Linha '+(i+1)+': faltando código ou descrição'); return; }
    if(codigoExiste(codigo)){ ignoradas++; return; }
    DB.atividades.push({ id:nextId(), codigo, descricao, unidade: partes[2]||'', valorUnitario: parseValor(partes[3]), fav:false, custom:{} });
    criadas++;
  });
  return { criadas, ignoradas, erros, msgErro };
}
function openImportAtividadesModal(){
  if(!requerEscrita()) return;
  const body = `
    <div class="field"><label>Cole as linhas <span class="req">*</span></label>
      <textarea name="linhas" id="imp-linhas" rows="8" placeholder="MAN-100;Substituição de poste;un;850&#10;CON-050;Instalação de rede BT;m;42,5&#10;POD-022;Poda de árvore;un;180"></textarea>
      <div class="field-hint">Uma atividade por linha. Formato: <strong>Código;Descrição;Unidade;Valor unitário</strong>. Separe por ponto e vírgula, vírgula ou TAB (colar direto do Excel).</div>
    </div>
    <div class="field"><label>Ou escolha um arquivo CSV/TXT</label><input type="file" id="imp-arquivo" accept=".csv,.txt"></div>
  `;
  openModal({
    title:'Importar atividades em massa', bodyHtml: body, submitLabel:'Importar atividades',
    onMount:(root)=>{
      const ta = root.querySelector('#imp-linhas');
      const arq = root.querySelector('#imp-arquivo');
      arq.addEventListener('change', e=>{
        const f = e.target.files[0]; if(!f) return;
        const rd = new FileReader();
        rd.onload = ()=>{ ta.value = String(rd.result||'').replace(/^\uFEFF/,''); };
        rd.readAsText(f, 'utf-8');
        e.target.value='';
      });
    },
    onSubmit:(fd)=>{
      const texto = String(fd.get('linhas')||'').trim();
      if(!texto){ toast('Cole as linhas ou escolha um arquivo.', 'error'); return false; }
      const r = importarAtividadesTexto(texto);
      if(r.criadas){ saveData(); renderContent(); }
      toast(`Importadas ${r.criadas} atividade(s).`+(r.ignoradas? ` ${r.ignoradas} já existente(s) ignorada(s).`:'')+(r.erros? ` ${r.erros} linha(s) com erro.`:'')+(r.msgErro.length? ' '+r.msgErro.join(' — '):''));
      return true;
    }
  });
}
/* =========================================================
   ATRIBUIÇÕES (flatten programação -> equipe)
========================================================= */
function flatAtribuicoes(){
  const out=[];
  const vis = projetosVisiveis().map(p=>p.id);
  DB.programacoes.forEach(pg=>{ if(vis.includes(pg.projetoId)) (pg.atribuicoes||[]).forEach(at=> out.push({ programacao: pg, atribuicao: at })); });
  return out;
}
function pendingList(){
  return flatAtribuicoes().filter(x=> isLate(x.atribuicao));
}
function alertaCount(){
  const hoje = todayISO();
  const ps = projetosVisiveis();
  const vencidos = ps.filter(p=> p.dataVencimento && !['Concluído','Cancelado'].includes(p.status) && p.dataVencimento < hoje).length;
  const viabAtraso = ps.filter(p=> p.dataRecebimentoCarteira && !p.dataViabilizacao && prazoViabilidadeProjeto(p) < hoje).length;
  const reprog = flatAtribuicoes().filter(x=>x.atribuicao.status==='Reprogramado').length;
  const cem = ps.filter(p=> !['Encerrado','Cancelado'].includes(p.status) && (projetoAvanco(p).fisicoPct>=100 || projetoAvanco(p).financeiroPct>=100)).length;
  return vencidos + viabAtraso + reprog + cem;
}
function teamEdits(atrib){ return (atrib?.historico||[]).filter(h=>h.tipo==='equipe'); }
function lastTeamEdit(atrib){ const l=teamEdits(atrib); return l[l.length-1]||null; }
function teamBadgeHtml(atrib){
  const e = lastTeamEdit(atrib);
  if(!e) return '';
  return `<span class="badge team-badge" title="Alterada pela equipe em ${fmtDateTime(e.ts)} — ${esc(e.motivo||'')}">${icon('alert',11)} Alterada pela equipe</span>`;
}

/* =========================================================
   CAMPOS PERSONALIZADOS
========================================================= */
function renderCustomFieldsInputs(moduleKey, record){
  const fields = DB.customFields[moduleKey]||[];
  if(!fields.length) return '';
  return fields.map(f=>{
    const val = record?.custom?.[f.id] ?? '';
    if(f.tipo==='select'){
      return `<div class="field"><label>${esc(f.label)}</label><select name="custom_${f.id}"><option value="">Selecione…</option>${(f.opcoes||[]).map(o=>`<option ${val===o?'selected':''}>${esc(o)}</option>`).join('')}</select></div>`;
    }
    const type = f.tipo==='numero'?'number': f.tipo==='data'?'date':'text';
    return `<div class="field"><label>${esc(f.label)}</label><input type="${type}" name="custom_${f.id}" value="${esc(val)}"></div>`;
  }).join('');
}
function parseCustomFieldsFromForm(moduleKey, fd){
  const fields = DB.customFields[moduleKey]||[];
  const out={};
  fields.forEach(f=>{ out[f.id] = fd.get('custom_'+f.id) || ''; });
  return out;
}

/* =========================================================
   MODAL GENÉRICO
========================================================= */
function openModal({title, bodyHtml, onMount, onSubmit, submitLabel='Salvar', wide=false, extraWide=false, footerBtns=[]}){
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal" style="${extraWide?'max-width:900px':wide?'max-width:660px':''}">
        <div class="modal-head"><h3>${title}</h3><button class="icon-btn" id="modal-close">${icon('close')}</button></div>
        <form id="modal-form">
          <div class="modal-body">${bodyHtml}</div>
          <div class="modal-foot">${footerBtns.map((b,i)=>`<button type="button" class="${b.cls||'btn btn-ghost'}" id="modal-btn-${i}">${b.label}</button>`).join('')}<button type="button" class="btn btn-ghost" id="modal-cancel">Cancelar</button><button type="submit" class="btn btn-primary">${submitLabel}</button></div>
        </form>
      </div>
    </div>`;
  const close = ()=>{ root.innerHTML=''; };
  document.getElementById('modal-close').addEventListener('click', close);
  document.getElementById('modal-cancel').addEventListener('click', close);
  document.getElementById('modal-overlay').addEventListener('click', (e)=>{ if(e.target.id==='modal-overlay') close(); });
  document.getElementById('modal-form').addEventListener('submit', (e)=>{ e.preventDefault(); const ok = onSubmit(new FormData(e.target), e.target); if(ok!==false) close(); });
  footerBtns.forEach((b,i)=>{ const el=document.getElementById('modal-btn-'+i); if(el) el.addEventListener('click', ()=> b.onClick(el)); });
  if(onMount) onMount(root);
}

/* =========================================================
   BANNER GLOBAL DE PENDÊNCIAS
========================================================= */
function renderBanner(){
  const area = document.getElementById('banner-area');
  const list = pendingList();
  if(!list.length){ area.innerHTML=''; return; }
  area.innerHTML = `
    <div class="pending-banner">
      <div class="pb-text">${icon('alert',15)} <strong>${list.length} programação(ões) vencida(s)</strong> aguardando confirmação de execução.</div>
      <button class="btn btn-danger-solid btn-sm" id="banner-responder">Responder agora</button>
    </div>`;
  document.getElementById('banner-responder').addEventListener('click', ()=> checkPendingConfirmations(true));
}

function checkPendingConfirmations(force){
  const list = pendingList();
  if(!list.length) return;
  const item = list[0];
  openConfirmacaoModal(item.programacao, item.atribuicao, ()=>{ renderBanner(); checkPendingConfirmations(); });
}

/* =========================================================
   MODAL DE CONFIRMAÇÃO (SIM / NÃO) — bloqueante
========================================================= */
function createActivityEditorInline(containerEl, initial){
  let items = JSON.parse(JSON.stringify((initial&&initial.length)? initial.map(x=>({atividadeId:x.atividadeId, quantidadePrevista:x.quantidadePrevista})) : [{atividadeId:'',quantidadePrevista:''}]));
  function paint(){
    containerEl.innerHTML = items.map((it,j)=>`
      <div class="activity-row" data-j="${j}">
        <select class="ae-select" data-j="${j}"><option value="">Atividade…</option>${atividadesOrdenadas().map(x=>`<option value="${x.id}" ${String(it.atividadeId)===String(x.id)?'selected':''}>${x.fav?'★ ':''}${esc(x.codigo)} · ${esc(x.descricao)}</option>`).join('')}</select>
        <input type="number" step="0.01" min="0" class="ae-qty" data-j="${j}" placeholder="Qtd." value="${it.quantidadePrevista??''}">
        ${items.length>1?`<button type="button" class="icon-btn ae-remove" data-j="${j}">${icon('close',13)}</button>`:''}
      </div>`).join('');
    containerEl.querySelectorAll('.ae-select').forEach(s=>s.addEventListener('change', e=>{ items[e.target.dataset.j].atividadeId = e.target.value; }));
    containerEl.querySelectorAll('.ae-qty').forEach(s=>s.addEventListener('input', e=>{ items[e.target.dataset.j].quantidadePrevista = e.target.value; }));
    containerEl.querySelectorAll('.ae-remove').forEach(b=>b.addEventListener('click', e=>{ items.splice(Number(e.currentTarget.dataset.j),1); paint(); }));
  }
  paint();
  return { addRow(){ items.push({atividadeId:'',quantidadePrevista:''}); paint(); }, getData(){ return items.filter(it=>it.atividadeId).map(it=>({atividadeId:Number(it.atividadeId), quantidadePrevista: it.quantidadePrevista?parseFloat(it.quantidadePrevista):null})); } };
}

function openConfirmacaoModal(prog, atrib, onResolved){
  const root = document.getElementById('modal-root');
  const eq = findEquipe(atrib.equipeId);
  let editor = null;

  function activitiesSummaryHtml(){
    return atrib.atividades.map(a=>{ const at=findAtividade(a.atividadeId); return `${esc(at?.codigo||'')} · ${esc(at?.descricao||'')} <span style="color:var(--muted-2);">(${a.quantidadePrevista??'-'} previsto)</span>`; }).join('<br>');
  }

  function renderStep(step){
    let inner='';
    if(step==='question'){
      inner = `
        <div class="modal-body">
          <div style="font-size:12.5px;color:var(--muted);">Programação vencida — equipe <strong>${equipeLabel(eq)}</strong> — data prevista ${fmtDate(atrib.dataProgramada)}</div>
          <div style="margin:10px 0;font-size:13px;line-height:1.7;">${activitiesSummaryHtml()}</div>
          <div class="confirm-question">A PROGRAMAÇÃO FOI EXECUTADA?</div>
        </div>
        <div class="modal-foot" style="justify-content:center;gap:14px;">
          <button type="button" class="btn btn-danger-solid" id="c-nao">NÃO</button>
          <button type="button" class="btn btn-primary" id="c-sim">SIM</button>
        </div>`;
    } else if(step==='sim'){
      inner = `
        <div class="modal-body">
          <div style="font-size:12.5px;color:var(--muted);">Confirme as quantidades executadas por <strong>${equipeLabel(eq)}</strong>. Você pode manter os valores previstos ou editar antes de concluir.</div>
          ${atrib.atividades.map((a,idx)=>{ const at=findAtividade(a.atividadeId);
            return `<div class="field"><label>${esc(at?.codigo||'')} · ${esc(at?.descricao||'')}</label><input type="number" step="0.01" class="exec-qty" data-idx="${idx}" value="${a.quantidadeExecutada ?? a.quantidadePrevista ?? ''}"></div>`;
          }).join('')}
          <div class="field"><label>Motivo da conclusão <span class="req">*</span></label><input type="text" id="sim-motivo" maxlength="200" placeholder="Ex.: serviço executado conforme programado"></div>
        </div>
        <div class="modal-foot"><button type="button" class="btn btn-ghost" id="c-back">← Voltar</button><button type="button" class="btn btn-primary" id="c-concluir">Manter/editar e concluir</button></div>`;
    } else if(step==='nao'){
      inner = `
        <div class="modal-body">
          <div class="field"><label>Motivo <span class="req">*</span></label><select id="nao-motivo"><option value="">Selecione…</option>${MOTIVOS_REPROG.map(m=>`<option>${m}</option>`).join('')}</select></div>
          <div class="field"><label>Observações</label><textarea id="nao-obs" placeholder="Detalhes sobre o não cumprimento"></textarea></div>
          <div class="field"><label>Nova data <span class="req">*</span></label><input type="date" id="nao-data" value="${atrib.dataProgramada}"></div>
          <div class="field" style="flex-direction:row;align-items:center;gap:8px;"><input type="checkbox" id="nao-editar" style="width:auto;"><label style="margin:0;" for="nao-editar">Também quero editar as atividades / quantidades desta equipe</label></div>
          <div id="nao-editor" style="display:none;"></div>
        </div>
        <div class="modal-foot"><button type="button" class="btn btn-ghost" id="c-back2">← Voltar</button><button type="button" class="btn btn-primary" id="c-reprogramar">Reprogramar</button></div>`;
    }
    root.innerHTML = `<div class="modal-overlay" id="modal-overlay-conf"><div class="modal"><div class="modal-head"><h3>Confirmação de execução</h3></div>${inner}</div></div>`;
    bind(step);
  }
  function bind(step){
    if(step==='question'){
      document.getElementById('c-sim').addEventListener('click', ()=>renderStep('sim'));
      document.getElementById('c-nao').addEventListener('click', ()=>renderStep('nao'));
    } else if(step==='sim'){
      document.getElementById('c-back').addEventListener('click', ()=>renderStep('question'));
      document.getElementById('c-concluir').addEventListener('click', ()=>{
        const motivo = document.getElementById('sim-motivo').value.trim();
        if(!motivo){ toast('Informe o motivo da conclusão.', 'error'); return; }
        document.querySelectorAll('.exec-qty').forEach(inp=>{ atrib.atividades[Number(inp.dataset.idx)].quantidadeExecutada = parseFloat(inp.value)||0; });
        const de = atrib.status;
        atrib.status='Concluído';
        atrib.historico = atrib.historico||[];
        atrib.historico.push({...currentAutor(), ts:Date.now(), tipo:'confirmacao', de, para:'Concluído', motivo});
        saveData(); root.innerHTML=''; toast('Programação concluída.'); renderContent(); onResolved && onResolved();
      });
    } else if(step==='nao'){
      document.getElementById('c-back2').addEventListener('click', ()=>renderStep('question'));
      document.getElementById('nao-editar').addEventListener('change', (e)=>{
        const box = document.getElementById('nao-editor');
        if(e.target.checked){ box.style.display='block'; box.innerHTML = `<div class="ae-list"></div><button type="button" class="btn btn-sm btn-ghost" id="ae-add" style="margin-top:6px;">${icon('plus',13)} Adicionar atividade</button>`;
          editor = createActivityEditorInline(box.querySelector('.ae-list'), atrib.atividades);
          document.getElementById('ae-add').addEventListener('click', ()=>editor.addRow());
        } else { box.style.display='none'; box.innerHTML=''; editor=null; }
      });
      document.getElementById('c-reprogramar').addEventListener('click', ()=>{
        const motivo = document.getElementById('nao-motivo').value;
        const obs = document.getElementById('nao-obs').value.trim();
        const novaData = document.getElementById('nao-data').value;
        if(!motivo || !novaData){ toast('Preencha motivo e nova data.', 'error'); return; }
        const dataAntiga = atrib.dataProgramada;
        atrib.dataProgramada = novaData;
        atrib.status = 'Reprogramado';
        if(editor){ const data = editor.getData(); if(data.length) atrib.atividades = data.map(d=>({...d, quantidadeExecutada:null})); }
        atrib.historico = atrib.historico||[];
        atrib.historico.push({...currentAutor(), ts:Date.now(), tipo:'reprogramacao', de:dataAntiga, para:novaData, motivo, obs});
        saveData(); root.innerHTML=''; toast('Programação reprogramada.'); renderContent(); onResolved && onResolved();
      });
    }
  }
  renderStep('question');
}

/* =========================================================
   VIEW: DASHBOARD
========================================================= */
function renderDashboard(){
  const el = document.getElementById('content');
  const hoje = todayISO();
  const cicloAtivo = progFilters.ciclo || cicloPadrao();
  const flat = flatPorCicloPadrao();
  const eqs = equipesVisiveis();
  const equipesAtivas = eqs.filter(e=>e.ativo).length;
  const ps = projetosVisiveis();
  const projetosAndamento = ps.filter(p=>p.status==='Em Andamento').length;
  const progHoje = flat.filter(x=> x.atribuicao.dataProgramada===hoje && x.atribuicao.status!=='Cancelado').length;
  const atrasadas = flat.filter(x=> isLate(x.atribuicao)).length;
  const concluidas = flat.filter(x=> x.atribuicao.status==='Concluído').length;
  const valorOrcadoTotal = ps.reduce((s,p)=> s + (p.valorOrcado||0), 0);
  const valorExecutadoTotal = ps.reduce((s,p)=> s + projetoAvanco(p).valorExecutado, 0);

  const proximas = flat.filter(x=>!['Concluído','Cancelado'].includes(x.atribuicao.status))
    .sort((a,b)=> a.atribuicao.dataProgramada.localeCompare(b.atribuicao.dataProgramada)).slice(0,7);

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
      <span style="font-size:12px;color:var(--muted);">Filtro padrão:</span>
      <span class="badge" style="color:var(--teal);background:rgba(87,199,199,.12);font-size:11px;">${cicloAtivo? 'Ciclo '+cicloAtivo : 'Todos os ciclos'}</span>
      ${cicloAtivo? `<span style="font-size:11.5px;color:var(--muted-2);">maior ciclo cadastrado com programações concluídas — vale para todas as telas com filtro</span>`:''}
    </div>
    <div class="grid-stats">
      <div class="stat-card clickable" data-go="equipes" style="--accent-c:var(--blue)"><div class="lbl">Equipes ativas</div><div class="val">${equipesAtivas}<small> / ${eqs.length}</small></div></div>
      <div class="stat-card clickable" data-go="projetos" style="--accent-c:var(--teal)"><div class="lbl">Projetos em andamento</div><div class="val">${projetosAndamento}<small> / ${ps.length}</small></div></div>
      <div class="stat-card clickable" data-go="hoje" style="--accent-c:var(--accent)"><div class="lbl">Programado p/ hoje</div><div class="val">${progHoje}</div></div>
      <div class="stat-card clickable" data-go="vencidas" style="--accent-c:var(--red)"><div class="lbl">Vencidas (aguardando confirmação)</div><div class="val">${atrasadas}</div></div>
      <div class="stat-card clickable" data-go="concluidas" style="--accent-c:var(--green)"><div class="lbl">Programações concluídas</div><div class="val">${concluidas}</div></div>
      <div class="stat-card clickable" data-go="avanco" style="--accent-c:var(--purple)"><div class="lbl">Orçado × executado</div><div class="val" style="font-size:19px;">${fmtMoney(valorExecutadoTotal)}<small style="font-size:10.5px;"> de ${fmtMoney(valorOrcadoTotal)}</small></div></div>
    </div>
    <div class="panel section-gap">
      <div class="panel-head"><h3>Próximas programações</h3><button class="btn btn-sm btn-ghost" id="go-prog">Ver todas →</button></div>
      <div class="table-scroll"><table>
        <thead><tr><th>Data</th><th>Projeto</th><th>Equipe</th><th>Equipe comp.</th><th>Atividades</th><th>Valor prev.</th><th>Status</th></tr></thead>
        <tbody>
          ${proximas.length? proximas.map(x=>{
            const p=x.atribuicao, pr=findProjeto(x.programacao.projetoId), eq=findEquipe(p.equipeId), late=isLate(p);
            const valPrev = p.atividades.reduce((s,a)=> s + (a.quantidadePrevista||0)*(findAtividade(a.atividadeId)?.valorUnitario||0), 0);
            return `<tr class="clickable-row" data-open-prog="${p.id}" title="Abrir detalhes">
              <td class="mono">${fmtDate(p.dataProgramada)} ${late?`<div class="blink-red" style="font-size:10.5px;color:var(--red);">VENCIDA</div>`:''}</td>
              <td>${esc(pr?.nome||'—')}</td>
              <td><span class="badge-prefix">${eqtlLabel(eq)}</span></td>
              <td><span class="badge-prefix">${prtnLabel(eq)}</span></td>
              <td style="font-size:12px;color:var(--muted);">${atividadesResumo(p.atividades)}</td>
              <td class="mono">${fmtMoney(valPrev)}</td>
              <td>${statusBadge(p.status, late)}${teamBadgeHtml(p)? `<div style="margin-top:4px;">${teamBadgeHtml(p)}</div>`:''}</td>
            </tr>`;
          }).join('') : `<tr class="empty-row"><td colspan="7">Nenhuma programação futura cadastrada no ciclo ${cicloAtivo||'atual'}.</td></tr>`}
        </tbody>
      </table></div>
    </div>
    ${renderProjetosProgressPanel()}
    <div class="panel"><div class="panel-head"><h3>Atividade recente</h3></div>${renderHistoricoTimeline(globalHistorico().slice(0,6), true)}</div>
  `;
  el.querySelectorAll('.stat-card.clickable').forEach(c=>c.addEventListener('click', ()=>{
    const go = c.dataset.go;
    if(go==='hoje'){ progFilters.modo='calendario'; progFilters.calView='dia'; progFilters.calDay=todayISO(); setView('programacoes'); }
    else if(go==='vencidas'){ progFilters.modo='fluxo'; setView('programacoes'); }
    else if(go==='concluidas'){ progFilters.status='Concluído'; progFilters.modo='lista'; setView('programacoes'); }
    else if(go==='avanco'){ setView('avanco'); }
    else setView(go);
  }));
  el.querySelectorAll('[data-open-prog]').forEach(r=>r.addEventListener('click', ()=>openAtribDetalhe(r.dataset.openProg)));
  el.querySelectorAll('[data-open-atrib]').forEach(r=>r.addEventListener('click', ()=>openAtribDetalhe(r.dataset.openAtrib)));
  document.getElementById('go-prog').addEventListener('click', ()=> setView('programacoes'));
  const goAvanc = el.querySelector('#go-avanco'); if(goAvanc) goAvanc.addEventListener('click', ()=> setView('avanco'));
}

/* =========================================================
   VIEW: ALERTAS (vencimento, reprogramações, viabilidade)
========================================================= */
function renderAlertas(){
  const el = document.getElementById('content');
  const hoje = todayISO();
  const ativos = p=> !['Concluído','Cancelado'].includes(p.status);
  const ps = projetosVisiveis();

  const projetosVencendo = ps.filter(p=> p.dataVencimento && ativos(p) && p.dataVencimento <= shiftISO(hoje, ALERT_VENCER_DIAS))
    .map(p=>({ p, dias: diasEntre(hoje, p.dataVencimento) }))
    .sort((a,b)=> a.p.dataVencimento.localeCompare(b.p.dataVencimento));
  const vencidos = projetosVencendo.filter(x=>x.dias<0);
  const venceHoje = projetosVencendo.filter(x=>x.dias===0);

  const reprog = flatAtribuicoes().filter(x=>x.atribuicao.status==='Reprogramado');

  const viabilidade = ps.filter(p=> p.dataRecebimentoCarteira && ativos(p)).map(p=>{
    const prazo = prazoViabilidadeProjeto(p);
    return { p, prazo, viabilizado: !!p.dataViabilizacao, dias: diasEntre(hoje, prazo) };
  }).sort((a,b)=> a.prazo.localeCompare(b.prazo));
  const viabVencidos = viabilidade.filter(x=>!x.viabilizado && x.dias<0);

  const proj100 = ps.filter(p=> !['Encerrado','Cancelado'].includes(p.status)).map(p=>({ p, av: projetoAvanco(p) }))
    .filter(x=> x.av.fisicoPct>=100 || x.av.financeiroPct>=100);

  el.innerHTML = `
    <div class="grid-stats">
      <div class="stat-card" style="--accent-c:var(--red)"><div class="lbl">Projetos em 100%</div><div class="val">${proj100.length}</div></div>
      <div class="stat-card" style="--accent-c:var(--red)"><div class="lbl">Projetos vencidos</div><div class="val">${vencidos.length}</div></div>
      <div class="stat-card" style="--accent-c:var(--accent)"><div class="lbl">Vencimento hoje</div><div class="val">${venceHoje.length}</div></div>
      <div class="stat-card" style="--accent-c:var(--purple)"><div class="lbl">Reprogramações pendentes</div><div class="val">${reprog.length}</div></div>
      <div class="stat-card" style="--accent-c:var(--red)"><div class="lbl">Viabilização em atraso</div><div class="val">${viabVencidos.length}</div></div>
    </div>
    ${renderAlertasCemPanel(proj100)}
    ${renderAlertasProjetosPanel(projetosVencendo)}
    ${renderAlertasReprogsPanel(reprog)}
    ${renderAlertasViabilidadePanel(viabilidade)}
  `;
  el.querySelectorAll('[data-avanco-alerta]').forEach(b=>b.addEventListener('click', ()=>openAvancoDetalhe(b.dataset.avancoAlerta)));
  el.querySelectorAll('[data-edit-alerta]').forEach(b=>b.addEventListener('click', ()=>openProjetoModal(b.dataset.editAlerta)));
  el.querySelectorAll('[data-encerrar-alerta]').forEach(b=>b.addEventListener('click', ()=>encerrarProjeto(b.dataset.encerrarAlerta)));
}
function renderAlertasCemPanel(list){
  return `<div class="panel section-gap" style="border-color:var(--red);">
    <div class="panel-head"><h3>Projetos com 100% de avanço — aguardando encerramento</h3><span style="font-size:12px;color:var(--muted);">${list.length} projeto(s)</span></div>
    <div class="table-scroll"><table>
      <thead><tr><th>Código</th><th>Projeto</th><th>Avanço físico</th><th>Avanço financeiro</th><th>Status</th><th></th></tr></thead>
      <tbody>${list.length? list.map(({p,av})=>`<tr>
        <td class="mono">${esc(p.codigo)}</td>
        <td><strong>${esc(p.nome)}</strong><div style="color:var(--muted-2);font-size:11px;">${esc(p.cidade||'')} · ${esc(p.setor||'')}</div></td>
        <td>${av.fisicoPct.toFixed(1)}%</td>
        <td>${av.financeiroPct.toFixed(1)}%</td>
        <td>${projStatusBadge(p.status)}</td>
        <td><div class="row-actions">
          <button class="icon-btn" title="Ver avanço" data-avanco-alerta="${p.id}">${icon('trend',14)}</button>
          <button class="btn btn-sm btn-danger-solid" data-encerrar-alerta="${p.id}">${icon('check',13)} Encerrar projeto</button>
        </div></td>
      </tr>`).join('') : `<tr class="empty-row"><td colspan="6">Nenhum projeto em 100% de avanço.</td></tr>`}</tbody>
    </table></div>
  </div>`;
}
function renderAlertasProjetosPanel(list){
  return `<div class="panel section-gap">
    <div class="panel-head"><h3>Projetos vencendo (próximos ${ALERT_VENCER_DIAS} dias)</h3><span style="font-size:12px;color:var(--muted);">${list.length} projeto(s)</span></div>
    <div class="table-scroll"><table>
      <thead><tr><th>Código</th><th>Projeto</th><th>Receb. carteira</th><th>Vencimento</th><th>Prazo</th><th>Status</th><th></th></tr></thead>
      <tbody>${list.length? list.map(({p,dias})=>{
        const c = dias<0? 'var(--red)' : dias<=ALERT_VIAB_BREVE_DIAS? 'var(--accent)' : 'var(--muted)';
        const prazoTxt = dias<0? `VENCIDO há ${-dias} dia(s)` : dias===0? 'Vence hoje' : `Vence em ${dias} dia(s)`;
        return `<tr>
          <td class="mono">${esc(p.codigo)}</td>
          <td><strong>${esc(p.nome)}</strong></td>
          <td class="mono">${fmtDate(p.dataRecebimentoCarteira)}</td>
          <td class="mono">${fmtDate(p.dataVencimento)}</td>
          <td><span class="badge ${dias<0?'blink-red':''}" style="color:${c};background:${bgFromVar(c)};">${prazoTxt}</span></td>
          <td>${projStatusBadge(p.status)}</td>
          <td><div class="row-actions">
            <button class="icon-btn" title="Ver avanço" data-avanco-alerta="${p.id}">${icon('trend',14)}</button>
            <button class="icon-btn" title="Editar projeto" data-edit-alerta="${p.id}">${icon('edit',14)}</button>
          </div></td>
        </tr>`;
      }).join('') : `<tr class="empty-row"><td colspan="7">Nenhum projeto vencendo nos próximos ${ALERT_VENCER_DIAS} dias.</td></tr>`}</tbody>
    </table></div>
  </div>`;
}
function renderAlertasReprogsPanel(list){
  return `<div class="panel section-gap">
    <div class="panel-head"><h3>Reprogramações pendentes</h3><span style="font-size:12px;color:var(--muted);">${list.length} programação(ões)</span></div>
    <div class="table-scroll"><table>
      <thead><tr><th>Data atual</th><th>Projeto</th><th>Equipe</th><th>Último motivo</th><th>Vezes</th><th>Status</th></tr></thead>
      <tbody>${list.length? list.map(x=>{
        const p=x.atribuicao, pr=findProjeto(x.programacao.projetoId), eq=findEquipe(p.equipeId);
        const reprogs = (p.historico||[]).filter(h=>h.tipo==='reprogramacao');
        const last = reprogs[reprogs.length-1];
        const late = isLate(p);
        return `<tr>
          <td class="mono">${fmtDate(p.dataProgramada)} ${late?`<div class="blink-red" style="font-size:10.5px;color:var(--red);">NOVAMENTE VENCIDA</div>`:''}</td>
          <td>${esc(pr?.nome||'—')}<div style="color:var(--muted-2);font-size:11px;">${esc(pr?.codigo||'')}</div></td>
          <td>${equipeLabel(eq)}</td>
          <td style="font-size:12px;color:var(--muted);">${esc(last?.motivo||'—')}${last?.obs? ' — '+esc(last.obs):''}</td>
          <td class="mono">${reprogs.length}</td>
          <td>${statusBadge(p.status)}</td>
        </tr>`;
      }).join('') : `<tr class="empty-row"><td colspan="6">Nenhuma reprogramação pendente.</td></tr>`}</tbody>
    </table></div>
  </div>`;
}
function renderAlertasViabilidadePanel(list){
  return `<div class="panel">
    <div class="panel-head"><h3>Viabilidade (prazo de ${ALERT_VIABILIDADE_DIAS} dias corridos após recebimento da carteira)</h3><span style="font-size:12px;color:var(--muted);">${list.length} projeto(s)</span></div>
    <div class="table-scroll"><table>
      <thead><tr><th>Código</th><th>Projeto</th><th>Receb. carteira</th><th>Prazo limite</th><th>Situação</th><th>Data viabilização</th><th></th></tr></thead>
      <tbody>${list.length? list.map(({p,prazo,viabilizado,dias})=>{
        let situacao, c;
        if(viabilizado){
          const dentro = p.dataViabilizacao && p.dataViabilizacao<=prazo;
          situacao = dentro? 'Viabilizado dentro do prazo' : 'Viabilizado fora do prazo';
          c = dentro? 'var(--green)' : 'var(--accent)';
        } else if(dias<0){
          situacao = `Prazo vencido há ${-dias} dia(s)`; c='var(--red)';
        } else if(dias<=ALERT_VIAB_BREVE_DIAS){
          situacao = `Vence em ${dias} dia(s)`; c='var(--accent)';
        } else {
          situacao = `${dias} dia(s) restantes`; c='var(--muted)';
        }
        return `<tr>
          <td class="mono">${esc(p.codigo)}</td>
          <td><strong>${esc(p.nome)}</strong></td>
          <td class="mono">${fmtDate(p.dataRecebimentoCarteira)}</td>
          <td class="mono">${fmtDate(prazo)}</td>
          <td><span class="badge ${(!viabilizado && dias<0)?'blink-red':''}" style="color:${c};background:${bgFromVar(c)};">${situacao}</span></td>
          <td class="mono">${fmtDate(p.dataViabilizacao)}</td>
          <td><div class="row-actions"><button class="icon-btn" title="Editar projeto" data-edit-alerta="${p.id}">${icon('edit',14)}</button></div></td>
        </tr>`;
      }).join('') : `<tr class="empty-row"><td colspan="7">Nenhum projeto com data de recebimento de carteira.</td></tr>`}</tbody>
    </table></div>
  </div>`;
}

/* =========================================================
   VIEW: EQUIPES
========================================================= */
function renderEquipes(){
  const el = document.getElementById('content');
  const visiveis = equipesVisiveis();
  if(!visiveis.length){ el.innerHTML = emptyState('Nenhuma equipe cadastrada', 'Cadastre equipes de campo informando o nome da equipe, supervisor, encarregado, motorista, meta diária e eletricistas.'); bindEmptyCta(el, ()=>openEquipeModal()); return; }
  const list = visiveis.filter(e=>{
    if(equipeFilters.status==='ativa' && !e.ativo) return false;
    if(equipeFilters.status==='inativa' && e.ativo) return false;
    if(equipeFilters.q){ const t=(e.eqtl+' '+(e.prtn||'')+' '+(e.setor||'')+' '+(e.coordenacao||'')+' '+(e.supervisor||'')+' '+(e.encarregado||'')+' '+(e.motorista||'')+' '+(e.eletricistas||[]).join(' ')).toLowerCase(); if(!t.includes(equipeFilters.q.toLowerCase())) return false; }
    return true;
  });
  el.innerHTML = `
    <div class="panel-head" style="padding:0;margin-bottom:16px;border:none;">
      <div class="filters">
        <input id="f-eq-q" placeholder="Buscar equipe (nome, supervisor, encarregado…)…" value="${esc(equipeFilters.q)}">
        <select id="f-eq-status"><option value="">Todas as situações</option><option value="ativa" ${equipeFilters.status==='ativa'?'selected':''}>Ativas</option><option value="inativa" ${equipeFilters.status==='inativa'?'selected':''}>Inativas</option></select>
      </div>
      <span style="font-size:12px;color:var(--muted);">${list.length} de ${visiveis.length} equipes</span>
    </div>
    ${list.length? `<div class="grid-crews">${list.map(crewCard).join('')}</div>` : `<div class="panel"><div class="empty-state">${icon('empty',34)}<p>Nenhuma equipe encontrada com os filtros.</p></div></div>`}`;
  document.getElementById('f-eq-q').addEventListener('input', e=>{ equipeFilters.q=e.target.value; renderContent(); });
  document.getElementById('f-eq-status').addEventListener('change', e=>{ equipeFilters.status=e.target.value; renderContent(); });
  el.querySelectorAll('[data-edit-equipe]').forEach(b=>b.addEventListener('click', ()=>openEquipeModal(b.dataset.editEquipe)));
  el.querySelectorAll('[data-del-equipe]').forEach(b=>b.addEventListener('click', ()=>deleteEquipe(b.dataset.delEquipe)));
}
function crewCard(eq){
  const eletricistas = (eq.eletricistas||[]).filter(Boolean);
  const customFields = DB.customFields.equipes||[];
  return `
  <div class="crew-card">
    <div class="crew-card-head">
      <div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${eq.eqtl? `<span class="badge-prefix">${esc(eq.eqtl)}</span>`:''}
          ${eq.prtn? `<span class="badge-prefix alt">${esc(eq.prtn)}</span>`:''}
        </div>
        <div style="margin-top:8px;font-size:12px;color:var(--muted);"><span class="crew-status-dot ${eq.ativo?'':'off'}"></span>${eq.ativo? 'Ativa':'Inativa'}${eq.setor||eq.coordenacao? ' · '+esc([eq.setor,eq.coordenacao].filter(Boolean).join(' / ')):''}</div>
      </div>
      <div class="row-actions">
        <button class="icon-btn" data-edit-equipe="${eq.id}">${icon('edit',14)}</button>
        <button class="icon-btn" data-del-equipe="${eq.id}">${icon('trash',14)}</button>
      </div>
    </div>
    <div class="crew-roles">
      <div class="crew-role"><span class="r-lbl">Supervisor</span><span class="r-val">${esc(eq.supervisor||'—')}</span></div>
      <div class="crew-role"><span class="r-lbl">Encarregado</span><span class="r-val">${esc(eq.encarregado||'—')}</span></div>
      <div class="crew-role"><span class="r-lbl">Motorista</span><span class="r-val">${esc(eq.motorista||'—')}</span></div>
      <div class="crew-role"><span class="r-lbl">WhatsApp</span><span class="r-val">${eq.whatsapp? `<a href="${esc(waLink(eq.whatsapp, 'Olá!'))}" target="_blank" rel="noopener" style="color:var(--green);font-weight:600;">${esc(eq.whatsapp)}</a>` : '—'}</span></div>
      <div class="crew-role"><span class="r-lbl">Meta diária</span><span class="r-val mono">${metaDiaria(eq)? fmtMoney(metaDiaria(eq)) : '—'}</span></div>
      <div class="crew-role"><span class="r-lbl">Eletricistas</span><span class="r-val">${eletricistas.length? esc(eletricistas.join(', ')) : '—'}</span></div>
      ${customFields.map(f=>`<div class="crew-role"><span class="r-lbl">${esc(f.label)}</span><span class="r-val">${esc(eq.custom?.[f.id]||'—')}</span></div>`).join('')}
    </div>
  </div>`;
}
    function openEquipeModal(id){
      if(!requerEscrita()) return;
      const eq = id ? findEquipe(id) : null;
  const body = `
    <div class="field-row">
      <div class="field"><label>Nome da equipe <span class="req">*</span></label><input type="text" name="eqtl" value="${esc(eq?.eqtl||'')}" placeholder="Ex: Equipe Alfa"></div>
      <div class="field"><label>Nome complementar</label><input type="text" name="prtn" value="${esc(eq?.prtn||'')}" placeholder="Ex: Equipe Bravo"></div>
    </div>
    <div class="field-hint" style="margin-top:-6px;">Preencha ao menos um dos nomes da equipe.</div>
    <div class="field"><label>Supervisor</label><input type="text" name="supervisor" value="${esc(eq?.supervisor||'')}" placeholder="Nome do supervisor"></div>
    <div class="field"><label>Encarregado</label><input type="text" name="encarregado" value="${esc(eq?.encarregado||'')}" placeholder="Nome do encarregado"></div>
    <div class="field"><label>Motorista</label><input type="text" name="motorista" value="${esc(eq?.motorista||'')}" placeholder="Nome do motorista"></div>
    <div class="field"><label>WhatsApp</label><input type="text" name="whatsapp" value="${esc(eq?.whatsapp||'')}" placeholder="Ex: (11) 98765-4321" inputmode="tel"><div class="field-hint">Usado no botão "Encaminhar para equipe" das programações. Informe com DDD.</div></div>
    <div class="field"><label>Meta diária (R$)</label><input type="number" step="0.01" min="0" name="metaDiaria" value="${eq?.metaDiaria??''}" placeholder="0,00"><div class="field-hint">Se a programação do dia ficar abaixo deste valor, o sistema alerta na programação.</div></div>
    <div class="field"><label>Eletricistas</label><input type="text" name="eletricistas" value="${esc((eq?.eletricistas||[]).join(', '))}" placeholder="Separe por vírgula: Fulano, Ciclano"><div class="field-hint">Separe os nomes por vírgula.</div></div>
    <div class="field-row">
      <div class="field"><label>Setor <span class="req">*</span></label><select name="setor" required><option value="">Selecione…</option><option ${eq?.setor==='MANUTENÇÃO'||(usuarioRestrito()&&CURRENT_USER.setor==='MANUTENÇÃO')?'selected':''}>MANUTENÇÃO</option><option ${eq?.setor==='OBRAS'||(usuarioRestrito()&&CURRENT_USER.setor==='OBRAS')?'selected':''}>OBRAS</option></select><div class="field-hint">Vincular a equipe ao setor onde ela atua.</div></div>
      <div class="field"><label>Coordenação <span class="req">*</span></label><select name="coordenacao" required><option value="">Selecione…</option><option ${eq?.coordenacao==='RIO VERDE'||(usuarioRestrito()&&CURRENT_USER.coordenacao==='RIO VERDE')?'selected':''}>RIO VERDE</option><option ${eq?.coordenacao==='QUIRINOPOLIS'||(usuarioRestrito()&&CURRENT_USER.coordenacao==='QUIRINOPOLIS')?'selected':''}>QUIRINOPOLIS</option></select><div class="field-hint">Vincular a equipe à coordenação onde ela atua.</div></div>
    </div>
    ${renderCustomFieldsInputs('equipes', eq)}
    <div class="field" style="flex-direction:row;align-items:center;gap:8px;"><input type="checkbox" name="ativo" id="eq-ativo" style="width:auto;" ${eq? (eq.ativo?'checked':'') : 'checked'}><label for="eq-ativo" style="margin:0;">Equipe ativa</label></div>
  `;
  openModal({
    title: eq? `Editar equipe` : 'Nova equipe', bodyHtml: body, submitLabel: eq? 'Salvar alterações' : 'Cadastrar equipe',
    onSubmit:(fd)=>{
      const eqtl = fd.get('eqtl').trim(), prtn = fd.get('prtn').trim();
      if(!eqtl && !prtn){ toast('Preencha ao menos o nome da equipe.', 'error'); return false; }
      if(!fd.get('setor') || !fd.get('coordenacao')){ toast('Selecione o setor e a coordenação da equipe.', 'error'); return false; }
      const setor = usuarioRestrito()? CURRENT_USER.setor : fd.get('setor');
      const coordenacao = usuarioRestrito()? CURRENT_USER.coordenacao : fd.get('coordenacao');
      const data = { eqtl, prtn, setor, coordenacao, supervisor: fd.get('supervisor').trim(), encarregado: fd.get('encarregado').trim(), motorista: fd.get('motorista').trim(), whatsapp: fd.get('whatsapp').trim(), metaDiaria: parseFloat(fd.get('metaDiaria'))||0,
        eletricistas: fd.get('eletricistas').split(',').map(s=>s.trim()).filter(Boolean), ativo: fd.get('ativo')==='on', custom: parseCustomFieldsFromForm('equipes', fd) };
      if(eq){ Object.assign(eq, data); toast('Equipe atualizada.'); registrarEvento('edicao','equipe',eq.id,eq.eqtl||eq.prtn,'Equipe atualizada'); }
      else { data.id = nextId(); DB.equipes.push(data); toast('Equipe cadastrada.'); registrarEvento('criacao','equipe',data.id,data.eqtl||data.prtn,'Equipe criada · '+data.setor); }
      saveData(); renderContent();
    }
  });
}
    function deleteEquipe(id){
      if(!requerEscrita()) return;
      id = Number(id);
  const inUse = flatAtribuicoes().some(x=>x.atribuicao.equipeId===id);
  if(inUse && !ehMestre()){ toast('Equipe possui programações vinculadas. Remova ou reatribua antes de excluir.', 'error'); return; }
  if(inUse){
    if(!confirm('Excluir esta equipe e REMOVER esta equipe de todas as programações vinculadas?\n\nEsta ação não pode ser desfeita.')) return;
  } else {
    if(!confirm('Excluir esta equipe?')) return;
  }
  DB.equipes = DB.equipes.filter(e=>e.id!==id);
  DB.programacoes.forEach(pg=>{ pg.atribuicoes = (pg.atribuicoes||[]).filter(a=>a.equipeId!==id); });
  DB.programacoes = DB.programacoes.filter(pg=>(pg.atribuicoes||[]).length);
  registrarEvento('exclusao','equipe',id,equipeLabel(findEquipe(id)),'Equipe excluída'+(inUse? ' e removida das programações':''));
  saveData(); renderContent(); toast('Equipe excluída.');
}

/* =========================================================
   VIEW: ATIVIDADES
========================================================= */
function renderAtividades(){
  const el = document.getElementById('content');
  if(!DB.atividades.length){ el.innerHTML = emptyState('Nenhuma atividade cadastrada', 'Cadastre as atividades executadas em campo com código, descrição e valor unitário.'); bindEmptyCta(el, ()=>openAtividadeModal()); return; }
  const customFields = DB.customFields.atividades||[];
  const list = atividadesOrdenadas().filter(a=>{
    if(ativFilters.fav==='fav' && !a.fav) return false;
    if(ativFilters.fav==='normal' && a.fav) return false;
    if(ativFilters.q){ const t=(a.codigo+' '+(a.descricao||'')).toLowerCase(); if(!t.includes(ativFilters.q.toLowerCase())) return false; }
    return true;
  });
  el.innerHTML = `
    <div class="panel-head" style="padding:0;margin-bottom:16px;border:none;">
      <div class="filters">
        <input id="f-at-q" placeholder="Buscar atividade…" value="${esc(ativFilters.q)}">
        <select id="f-at-fav"><option value="">Todas</option><option value="fav" ${ativFilters.fav==='fav'?'selected':''}>★ Favoritas</option><option value="normal" ${ativFilters.fav==='normal'?'selected':''}>Sem estrela</option></select>
      </div>
      <span style="font-size:12px;color:var(--muted);">${list.length} de ${DB.atividades.length} atividades</span>
    </div>
    <div class="panel"><div class="table-scroll"><table>
      <thead><tr><th>Fav.</th><th>Código</th><th>Descrição</th><th>Unidade</th><th>Valor unitário</th>${customFields.map(f=>`<th>${esc(f.label)}</th>`).join('')}<th></th></tr></thead>
      <tbody>${list.map(a=>`<tr>
        <td><button class="icon-btn ${a.fav?'fav':'star-off'}" title="${a.fav?'Favorita':'Marcar favorita'}" data-fav-at="${a.id}">${icon('star',15)}</button></td>
        <td><span class="mono" style="color:var(--accent);font-weight:700;">${esc(a.codigo)}</span></td>
        <td>${esc(a.descricao)}</td><td>${esc(a.unidade||'—')}</td><td class="mono">${fmtMoney(a.valorUnitario)}</td>
        ${customFields.map(f=>`<td>${esc(a.custom?.[f.id]||'—')}</td>`).join('')}
        <td><div class="row-actions"><button class="icon-btn" data-edit-at="${a.id}">${icon('edit',14)}</button><button class="icon-btn" data-del-at="${a.id}">${icon('trash',14)}</button></div></td>
      </tr>`).join('') || `<tr class="empty-row"><td colspan="${6+customFields.length}">Nenhuma atividade encontrada com os filtros.</td></tr>`}
      </tbody></table></div></div>`;
  document.getElementById('f-at-q').addEventListener('input', e=>{ ativFilters.q=e.target.value; renderContent(); });
  document.getElementById('f-at-fav').addEventListener('change', e=>{ ativFilters.fav=e.target.value; renderContent(); });
  el.querySelectorAll('[data-fav-at]').forEach(b=>b.addEventListener('click', ()=>toggleFavAtividade(b.dataset.favAt)));
  el.querySelectorAll('[data-edit-at]').forEach(b=>b.addEventListener('click', ()=>openAtividadeModal(b.dataset.editAt)));
  el.querySelectorAll('[data-del-at]').forEach(b=>b.addEventListener('click', ()=>deleteAtividade(b.dataset.delAt)));
}
    function openAtividadeModal(id){
      if(!requerEscrita()) return;
      const at = id ? findAtividade(id) : null;
  const body = `
    <div class="field-row">
      <div class="field"><label>Código <span class="req">*</span></label><input type="text" name="codigo" required value="${esc(at?.codigo||'')}" placeholder="Ex: MAN-014"></div>
      <div class="field"><label>Unidade</label><input type="text" name="unidade" value="${esc(at?.unidade||'')}" placeholder="un, m, poste..."></div>
    </div>
    <div class="field"><label>Descrição <span class="req">*</span></label><textarea name="descricao" required placeholder="Descrição da atividade">${esc(at?.descricao||'')}</textarea></div>
    <div class="field"><label>Valor unitário (R$) <span class="req">*</span></label><input type="number" step="0.01" min="0" name="valorUnitario" required value="${at?.valorUnitario??''}" placeholder="0,00"></div>
    <div class="field" style="flex-direction:row;align-items:center;gap:8px;"><input type="checkbox" name="fav" id="at-fav" style="width:auto;" ${at?.fav?'checked':''}><label for="at-fav" style="margin:0;">${icon('star',14)} Marcar como atividade favorita</label><div class="field-hint">Favoritas aparecem em primeiro na lista e nos seletores.</div></div>
    ${renderCustomFieldsInputs('atividades', at)}
  `;
  openModal({
    title: at? 'Editar atividade' : 'Nova atividade', bodyHtml: body, submitLabel: at? 'Salvar alterações' : 'Cadastrar atividade',
    onSubmit:(fd)=>{
      const codigo = fd.get('codigo').trim();
      const dup = DB.atividades.find(a=>a.codigo.toLowerCase()===codigo.toLowerCase() && a.id!==at?.id);
      if(dup){ toast('Já existe uma atividade com esse código.', 'error'); return false; }
      const data = { codigo, descricao: fd.get('descricao').trim(), unidade: fd.get('unidade').trim(), valorUnitario: parseFloat(fd.get('valorUnitario'))||0, fav: fd.get('fav')==='on', custom: parseCustomFieldsFromForm('atividades', fd) };
      if(at){ Object.assign(at, data); toast('Atividade atualizada.'); registrarEvento('edicao','atividade',at.id,at.codigo+' · '+at.descricao,'Atividade atualizada'); }
      else { data.id = nextId(); DB.atividades.push(data); toast('Atividade cadastrada.'); registrarEvento('criacao','atividade',data.id,data.codigo+' · '+data.descricao,'Atividade criada'); }
      saveData(); renderContent();
    }
  });
}
    function deleteAtividade(id){
      if(!requerEscrita()) return;
      id = Number(id);
  const inUse = flatAtribuicoes().some(x=>x.atribuicao.atividades.some(a=>a.atividadeId===id));
  if(inUse && !ehMestre()){ toast('Atividade possui programações vinculadas. Não é possível excluir.', 'error'); return; }
  if(inUse){
    if(!confirm('Excluir esta atividade de TODAS as programações e planos físicos?\n\nEsta ação não pode ser desfeita.')) return;
  } else {
    if(!confirm('Excluir esta atividade?')) return;
  }
  DB.atividades = DB.atividades.filter(a=>a.id!==id);
  DB.programacoes.forEach(pg=>{ pg.atribuicoes = (pg.atribuicoes||[]).filter(at=>{ at.atividades = (at.atividades||[]).filter(x=>x.atividadeId!==id); return (at.atividades||[]).length; }); });
  DB.programacoes = DB.programacoes.filter(pg=>(pg.atribuicoes||[]).length);
  DB.projetos.forEach(p=>{ p.planoFisico = (p.planoFisico||[]).filter(x=>x.atividadeId!==id); });
  registrarEvento('exclusao','atividade',id,findAtividade(id)? findAtividade(id).codigo+' · '+findAtividade(id).descricao : String(id),'Atividade excluída'+(inUse? ' e removida das programações':''));
  saveData(); renderContent(); toast('Atividade excluída.');
}

/* =========================================================
   VIEW: PROJETOS
========================================================= */
function renderProjetos(){
  const el = document.getElementById('content');
  const visiveis = projetosVisiveis();
  if(!visiveis.length){ el.innerHTML = emptyState('Nenhum projeto cadastrado', 'Cadastre projetos de construção ou manutenção para agrupar as programações.'); bindEmptyCta(el, ()=>openProjetoModal()); return; }
  const customFields = DB.customFields.projetos||[];
  const list = visiveis.filter(p=>{
    if(projFilters.status && p.status!==projFilters.status) return false;
    if(projFilters.q){ const t=(p.codigo+' '+(p.nome||'')+' '+(p.descricao||'')+' '+(p.ciclo||'')+' '+(p.setor||'')+' '+(p.coordenacao||'')+' '+(p.cidade||'')).toLowerCase(); if(!t.includes(projFilters.q.toLowerCase())) return false; }
    return true;
  });
  el.innerHTML = `
    <div class="panel-head" style="padding:0;margin-bottom:16px;border:none;">
      <div class="filters">
        <input id="f-pj-q" placeholder="Buscar projeto…" value="${esc(projFilters.q)}">
        <select id="f-pj-status"><option value="">Todos os status</option>${STATUS_PROJETO.map(s=>`<option ${projFilters.status===s?'selected':''}>${s}</option>`).join('')}</select>
      </div>
      <span style="font-size:12px;color:var(--muted);">${list.length} de ${visiveis.length} projetos</span>
    </div>
    <div class="panel"><div class="table-scroll"><table>
      <thead><tr><th>Código</th><th>Projeto</th><th>Período</th><th>Receb. carteira</th><th>Vencimento</th><th>Setor · Coordenação</th><th>Cidade</th><th>Ciclo</th><th>Orçado</th><th>Avanço</th><th>Status</th><th>Programações</th>${customFields.map(f=>`<th>${esc(f.label)}</th>`).join('')}<th></th></tr></thead>
      <tbody>${list.map(p=>{
      const count = DB.programacoes.filter(x=>x.projetoId===p.id).reduce((s,pg)=>s+(pg.atribuicoes?.length||0),0);
      const av = projetoAvanco(p);
      const aberto = !['Encerrado','Cancelado'].includes(p.status);
      const atingiu100 = aberto && (av.fisicoPct>=100 || av.financeiroPct>=100);
      const alerta = atingiu100? `<tr class="proj-100-alert-row"><td colspan="${13+customFields.length}"><div class="proj-100-alert">${icon('alert',14)}<span><strong>Projeto em 100% de avanço</strong> · ${av.fisicoPct.toFixed(1)}% físico · ${av.financeiroPct.toFixed(1)}% financeiro — <span class="blink-red">encerre o projeto</span> para ele deixar de aparecer nas opções de programação.</span><button class="btn btn-sm btn-danger-solid" data-encerrar-pj="${p.id}">${icon('check',13)} Encerrar projeto</button></div></td></tr>`:'';
      return `<tr>
        <td class="mono">${esc(p.codigo)}</td>
        <td><strong>${esc(p.nome)}</strong><div style="color:var(--muted-2);font-size:11.5px;margin-top:2px;">${esc(p.descricao||'')}</div></td>
        <td class="mono" style="font-size:12px;">${fmtDate(p.dataInicio)} → ${fmtDate(p.dataFim)}</td>
        <td class="mono" style="font-size:12px;">${fmtDate(p.dataRecebimentoCarteira)}${viabilidadeAlertBadge(p)}</td>
        <td class="mono" style="font-size:12px;">${fmtDate(p.dataVencimento)}${vencimentoAlertBadge(p)}</td>
        <td style="font-size:12px;">${esc(p.setor||'—')}<div style="color:var(--muted-2);font-size:11px;">${esc(p.coordenacao||'—')}</div></td>
        <td style="font-size:12px;">${esc(p.cidade||'—')}</td>
        <td><span class="badge" style="color:var(--teal);background:rgba(87,199,199,.12);">${esc(p.ciclo||'—')}</span></td>
        <td class="mono">${fmtMoney(p.valorOrcado||0)}</td>
        <td style="min-width:130px;">${progBarHtml(av.fisicoPct,{thin:true})}<div style="font-size:10.5px;color:var(--muted);margin-top:3px;">${av.fisicoPct.toFixed(1)}% · ${av.concluidoLinhas}/${av.totalLinhas}</div></td>
        <td>${projStatusBadge(p.status)}</td><td>${count}</td>
        ${customFields.map(f=>`<td>${esc(p.custom?.[f.id]||'—')}</td>`).join('')}
        <td><div class="row-actions"><button class="icon-btn" title="Imprimir projeto" data-print-pj="${p.id}">${icon('printer',14)}</button><button class="icon-btn" title="Ver avanço" data-avanco-detalhe="${p.id}">${icon('trend',14)}</button><button class="icon-btn" data-edit-pj="${p.id}">${icon('edit',14)}</button><button class="icon-btn" data-del-pj="${p.id}">${icon('trash',14)}</button></div></td>
      </tr>${alerta}`;
    }).join('') || `<tr class="empty-row"><td colspan="${13+customFields.length}">Nenhum projeto encontrado com os filtros.</td></tr>`}</tbody></table></div></div>`;
  document.getElementById('f-pj-q').addEventListener('input', e=>{ projFilters.q=e.target.value; renderContent(); });
  document.getElementById('f-pj-status').addEventListener('change', e=>{ projFilters.status=e.target.value; renderContent(); });
  el.querySelectorAll('[data-avanco-detalhe]').forEach(b=>b.addEventListener('click', ()=>openAvancoDetalhe(b.dataset.avancoDetalhe)));
  el.querySelectorAll('[data-edit-pj]').forEach(b=>b.addEventListener('click', ()=>openProjetoModal(b.dataset.editPj)));
  el.querySelectorAll('[data-del-pj]').forEach(b=>b.addEventListener('click', ()=>deleteProjeto(b.dataset.delPj)));
  el.querySelectorAll('[data-encerrar-pj]').forEach(b=>b.addEventListener('click', ()=>encerrarProjeto(b.dataset.encerrarPj)));
  el.querySelectorAll('[data-print-pj]').forEach(b=>b.addEventListener('click', ()=>printProjeto(b.dataset.printPj)));
}
function projStatusBadge(status){
  const colors = {'Aguardando Viabilidade':'var(--blue)','Em Andamento':'var(--accent)','Concluído':'var(--green)','Encerrado':'var(--muted)','Cancelado':'var(--red)'};
  const c = colors[status]||'var(--muted)';
  return `<span class="badge" style="color:${c};background:${bgFromVar(c)}"><span class="badge-dot"></span>${status}</span>`;
}
function vencimentoAlertBadge(p){
  if(!p.dataVencimento || ['Concluído','Cancelado'].includes(p.status)) return '';
  const dias = diasEntre(todayISO(), p.dataVencimento);
  if(dias<0) return `<div class="blink-red" style="font-size:10.5px;color:var(--red);margin-top:2px;">VENCIDO há ${-dias} dia(s)</div>`;
  if(dias===0) return `<div style="font-size:10.5px;color:var(--accent);margin-top:2px;">Vence hoje</div>`;
  if(dias<=5) return `<div style="font-size:10.5px;color:var(--accent);margin-top:2px;">Vence em ${dias} dia(s)</div>`;
  return '';
}
function viabilidadeAlertBadge(p){
  if(!p.dataRecebimentoCarteira || p.dataViabilizacao || ['Concluído','Cancelado'].includes(p.status)) return '';
  const dias = diasEntre(todayISO(), prazoViabilidadeProjeto(p));
  if(dias<0) return `<div class="blink-red" style="font-size:10.5px;color:var(--red);margin-top:2px;">VIABILIDADE ATRASADA há ${-dias} dia(s)</div>`;
  if(dias<=ALERT_VIAB_BREVE_DIAS) return `<div style="font-size:10.5px;color:var(--accent);margin-top:2px;">Viabilizar em ${dias} dia(s)</div>`;
  return '';
}
    function openProjetoModal(id){
      if(!requerEscrita()) return;
      const pj = id ? findProjeto(id) : null;
  let planoEditor = null;
  const body = `
    <div class="field-row">
      <div class="field"><label>Código <span class="req">*</span></label><input type="text" name="codigo" required value="${esc(pj?.codigo||'')}" placeholder="Ex: PRJ-2026-01"></div>
      <div class="field"><label>Status</label><select name="status">${STATUS_PROJETO.map(s=>`<option ${pj?.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label>Nome do projeto <span class="req">*</span></label><input type="text" name="nome" required value="${esc(pj?.nome||'')}" placeholder="Ex: Reforço de rede - Setor Norte"></div>
    <div class="field"><label>Descrição</label><textarea name="descricao" placeholder="Detalhes do projeto">${esc(pj?.descricao||'')}</textarea></div>
    <div class="field-row">
      <div class="field"><label>Data de início <span class="req">*</span></label><input type="date" name="dataInicio" required value="${pj?.dataInicio||''}"></div>
      <div class="field"><label>Data fim prevista</label><input type="date" name="dataFim" value="${pj?.dataFim||''}"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Data recebimento carteira <span class="req">*</span></label><input type="date" name="dataRecebimentoCarteira" required value="${pj?.dataRecebimentoCarteira||''}"><div class="field-hint">Início da contagem do prazo de viabilização (20 dias corridos).</div></div>
      <div class="field"><label>Data vencimento do projeto <span class="req">*</span></label><input type="date" name="dataVencimento" required value="${pj?.dataVencimento||''}"><div class="field-hint">Referência para os alertas de projetos vencendo.</div></div>
    </div>
    <div class="field"><label>Data de viabilização</label><input type="date" name="dataViabilizacao" value="${pj?.dataViabilizacao||''}"><div class="field-hint">Informe a data quando o projeto for viabilizado. Enquanto vazio, o alerta de viabilidade permanece até o prazo de 20 dias corridos após o recebimento da carteira.</div></div>
    <div class="field-row">
      <div class="field"><label>Setor <span class="req">*</span></label><select name="setor" required><option value="">Selecione…</option><option ${pj?.setor==='MANUTENÇÃO'||(usuarioRestrito()&&CURRENT_USER.setor==='MANUTENÇÃO')?'selected':''}>MANUTENÇÃO</option><option ${pj?.setor==='OBRAS'||(usuarioRestrito()&&CURRENT_USER.setor==='OBRAS')?'selected':''}>OBRAS</option></select></div>
      <div class="field"><label>Coordenação <span class="req">*</span></label><select name="coordenacao" required><option value="">Selecione…</option><option ${pj?.coordenacao==='RIO VERDE'||(usuarioRestrito()&&CURRENT_USER.coordenacao==='RIO VERDE')?'selected':''}>RIO VERDE</option><option ${pj?.coordenacao==='QUIRINOPOLIS'||(usuarioRestrito()&&CURRENT_USER.coordenacao==='QUIRINOPOLIS')?'selected':''}>QUIRINOPOLIS</option></select></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Cidade</label><input type="text" name="cidade" value="${esc(pj?.cidade||'')}" placeholder="Ex: Rio Verde"><div class="field-hint">Município de referência do projeto (usado na localização dos relatórios).</div></div>
      <div class="field"><label>Valor orçado (R$)</label><input type="number" step="0.01" min="0" name="valorOrcado" value="${pj?.valorOrcado??''}" placeholder="0,00"><div class="field-hint">O avanço financeiro é calculado conforme as atividades concluídas pelas equipes.</div></div>
    </div>
    <div class="field"><label>Ciclo recebido carteira <span class="req">*</span></label><input type="text" name="ciclo" class="ciclo-input" required maxlength="13" value="${esc(pj?.ciclo||'')}" placeholder="CICLO-XX/XXXX"><div class="field-hint">Digite apenas o mês e o ano (ex.: 01/2026). O prefixo "CICLO-" é automático.</div></div>
    <div class="field">
      <label>Plano físico — atividades e quantidades</label>
      <div id="pj-plano-list"></div>
      <button type="button" class="btn btn-sm" id="pj-plano-add" style="margin-top:6px;align-self:flex-start;">${icon('plus',13)} Adicionar atividade</button>
      <div class="field-hint">Cadastre as atividades e quantidades previstas do projeto. O avanço físico avança conforme as programações concluídas pelas equipes.</div>
    </div>
    ${renderCustomFieldsInputs('projetos', pj)}
  `;
  openModal({
    title: pj? 'Editar projeto' : 'Novo projeto', bodyHtml: body, submitLabel: pj? 'Salvar alterações' : 'Cadastrar projeto',
    onMount:(root)=>{
      bindCicloMasks(root);
      planoEditor = createActivityEditorInline(root.querySelector('#pj-plano-list'), (pj?.planoFisico||[]).map(x=>({atividadeId:x.atividadeId, quantidadePrevista:x.quantidade})));
      document.getElementById('pj-plano-add').addEventListener('click', ()=>planoEditor.addRow());
    },
    onSubmit:(fd)=>{
      const ciclo = cicloMask(fd.get('ciclo'));
      if(!isCicloValido(ciclo)){ toast('Informe o ciclo recebido no formato CICLO-XX/XXXX (ex.: CICLO-01/2026).', 'error'); return false; }
      if(!fd.get('setor') || !fd.get('coordenacao')){ toast('Selecione o setor e a coordenação do projeto.', 'error'); return false; }
      const setor = usuarioRestrito()? CURRENT_USER.setor : fd.get('setor');
      const coordenacao = usuarioRestrito()? CURRENT_USER.coordenacao : fd.get('coordenacao');
      const data = { codigo: fd.get('codigo').trim(), nome: fd.get('nome').trim(), descricao: fd.get('descricao').trim(), dataInicio: fd.get('dataInicio'), dataFim: fd.get('dataFim'), dataRecebimentoCarteira: fd.get('dataRecebimentoCarteira'), dataVencimento: fd.get('dataVencimento'), dataViabilizacao: fd.get('dataViabilizacao')||'', setor, coordenacao, cidade: fd.get('cidade').trim(), status: fd.get('status'), valorOrcado: parseFloat(fd.get('valorOrcado'))||0, ciclo, planoFisico: (planoEditor? planoEditor.getData() : []).map(x=>({atividadeId:x.atividadeId, quantidade:x.quantidadePrevista})), custom: parseCustomFieldsFromForm('projetos', fd) };
      if(pj){ Object.assign(pj, data); toast('Projeto atualizado.'); registrarEvento('edicao','projeto',pj.id,pj.codigo+' · '+pj.nome,'Projeto atualizado'); }
      else { data.id = nextId(); DB.projetos.push(data); toast('Projeto cadastrado.'); registrarEvento('criacao','projeto',data.id,data.codigo+' · '+data.nome,'Projeto criado · '+data.ciclo); }
      saveData(); renderContent();
    }
  });
}
function openPlanoFisicoModal(pjId){
  const pj = findProjeto(pjId); if(!pj) return;
  let editor = null;
  const body = `
    <div style="font-size:12.5px;color:var(--muted);margin-bottom:2px;">Projeto: <strong>${esc(pj.nome)}</strong></div>
    <div class="field"><label>Plano físico — atividades e quantidades previstas</label>
      <div class="ae-list"></div>
      <button type="button" class="btn btn-sm" id="pf-add" style="margin-top:6px;align-self:flex-start;">${icon('plus',13)} Adicionar atividade</button>
      <div class="field-hint">O avanço físico avança conforme as programações concluídas pelas equipes, comparando o executado com este plano.</div>
    </div>`;
  openModal({
    title:'Plano físico do projeto', bodyHtml:body, submitLabel:'Salvar plano físico',
    onMount:(root)=>{
      editor = createActivityEditorInline(root.querySelector('.ae-list'), (pj.planoFisico||[]).map(x=>({atividadeId:x.atividadeId, quantidadePrevista:x.quantidade})));
      document.getElementById('pf-add').addEventListener('click', ()=>editor.addRow());
    },
    onSubmit:()=>{
      pj.planoFisico = editor.getData().map(x=>({atividadeId:x.atividadeId, quantidade:x.quantidadePrevista}));
      saveData(); renderContent(); toast('Plano físico salvo.');
    }
  });
}
    function deleteProjeto(id){
      if(!requerEscrita()) return;
      id = Number(id);
  const vinculadas = DB.programacoes.filter(p=>p.projetoId===id);
  if(vinculadas.length){
    if(ehMestre()){
      if(!confirm(`Excluir este projeto e TODAS as ${vinculadas.length} programação(ões) vinculadas?\n\nEsta ação não pode ser desfeita.`)) return;
      DB.programacoes = DB.programacoes.filter(p=>p.projetoId!==id);
    } else {
      toast('Projeto possui programações vinculadas. Não é possível excluir.', 'error'); return;
    }
  } else {
    if(!confirm('Excluir este projeto?')) return;
  }
  DB.projetos = DB.projetos.filter(p=>p.id!==id);
  registrarEvento('exclusao','projeto',id,findProjeto(id)? findProjeto(id).codigo+' · '+findProjeto(id).nome : String(id),'Projeto excluído'+(vinculadas.length? ' com '+vinculadas.length+' programação(ões) vinculada(s)':''));
  saveData(); renderContent(); toast('Projeto excluído.');
}
function encerrarProjeto(id){
  if(!requerEscrita()) return;
  id = Number(id);
  const pj = findProjeto(id); if(!pj) return;
  if(!confirm('Encerrar o projeto '+pj.codigo+' — '+pj.nome+'?\n\nApós encerrado, o projeto não aparecerá mais nas opções de novas programações.')) return;
  pj.status = 'Encerrado';
  pj.dataEncerrado = todayISO();
  registrarEvento('config','projeto',pj.id,pj.codigo+' · '+pj.nome,'Projeto encerrado');
  saveData(); renderContent(); toast('Projeto encerrado.');
}

/* =========================================================
   AVANÇO DOS PROJETOS (físico e financeiro)
========================================================= */
function projetoAvanco(pj){
  const pgs = DB.programacoes.filter(p=>p.projetoId===pj.id);
  const plano = (pj.planoFisico||[]).filter(a=>a.atividadeId && a.quantidade);
  const hasPlano = plano.length>0;
  let totalLinhas=0, concluidoLinhas=0, totalQty=0, execQty=0, valorExecutado=0, valorPlanejado=0;
  const porEquipe = {};
  const porStatus = {};
  const execByAtividade = {};
  STATUS_PROG.forEach(s=>porStatus[s]=0);
  const linhas=[];
  if(hasPlano){
    plano.forEach(a=>{
      const atDef = findAtividade(a.atividadeId);
      totalQty += a.quantidade||0;
      valorPlanejado += (a.quantidade||0)*(atDef?.valorUnitario||0);
    });
  }
  pgs.forEach(pg=> (pg.atribuicoes||[]).forEach(at=>{
    const eq = porEquipe[at.equipeId] || (porEquipe[at.equipeId]={ totalLinhas:0, concluidoLinhas:0, totalQty:0, execQty:0, valorExecutado:0, valorPlanejado:0 });
    at.atividades.forEach(a=>{
      const atDef = findAtividade(a.atividadeId);
      const vu = atDef?.valorUnitario||0;
      const prev = a.quantidadePrevista||0;
      const feito = at.status==='Concluído';
      const exec = feito ? (a.quantidadeExecutada!=null? a.quantidadeExecutada : prev) : 0;
      totalLinhas++;
      if(!hasPlano){ totalQty+=prev; valorPlanejado+= prev*vu; }
      eq.totalLinhas++; eq.totalQty+=prev; eq.valorPlanejado+=prev*vu;
      porStatus[at.status] = (porStatus[at.status]||0)+1;
      if(feito){
        concluidoLinhas++; execQty+=exec; valorExecutado+=exec*vu;
        eq.concluidoLinhas++; eq.execQty+=exec; eq.valorExecutado+=exec*vu;
        execByAtividade[a.atividadeId] = (execByAtividade[a.atividadeId]||0) + exec;
      }
      linhas.push({ data: at.dataProgramada||pg.dataProgramada, equipeId:at.equipeId, status:at.status, codigo:atDef?.codigo||'?', descricao:atDef?.descricao||'', unidade:atDef?.unidade||'', prev, exec, vu, execVal: exec*vu });
    });
  }));
  const fisicoPct = Math.min(100, totalQty>0 ? execQty/totalQty*100 : (totalLinhas>0 ? concluidoLinhas/totalLinhas*100 : 0));
  const valorOrcado = pj.valorOrcado||0;
  const financeiroPct = valorOrcado>0 ? Math.min(100, valorExecutado/valorOrcado*100) : 0;
  return { valorOrcado, valorExecutado, restante: Math.max(0, valorOrcado-valorExecutado), valorPlanejado, totalLinhas, concluidoLinhas, totalQty, execQty, fisicoPct, financeiroPct, porEquipe, porStatus, linhas, execByAtividade, plano, hasPlano };
}
function progBarHtml(pct, opts={}){
  const p = Math.max(0, Math.min(100, pct||0));
  const color = p>=100? 'var(--green)' : (p>0? 'var(--accent)' : 'var(--muted-2)');
  return `<div class="progbar ${opts.thin?'thin':''}"><div style="width:${p}%;background:${color};"></div></div>`;
}
function renderProjetosProgressPanel(){
  const visiveis = projetosVisiveis();
  if(!visiveis.length) return '';
  return `<div class="panel section-gap">
    <div class="panel-head"><h3>Avanço dos projetos</h3><button class="btn btn-sm btn-ghost" id="go-avanco">Ver módulo →</button></div>
    <div class="table-scroll"><table>
      <thead><tr><th>Projeto</th><th>Orçado</th><th>Executado</th><th>Avanço físico</th><th>%</th></tr></thead>
      <tbody>${visiveis.map(p=>{
        const av = projetoAvanco(p);
        return `<tr>
          <td><strong>${esc(p.nome)}</strong><div style="color:var(--muted-2);font-size:11.5px;">${esc(p.codigo)}</div></td>
          <td class="mono">${fmtMoney(av.valorOrcado)}</td>
          <td class="mono">${fmtMoney(av.valorExecutado)}</td>
          <td style="min-width:150px;">${progBarHtml(av.fisicoPct,{thin:true})}</td>
          <td class="mono">${av.fisicoPct.toFixed(1)}%</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>
  </div>`;
}

function renderAvanco(){
  const el = document.getElementById('content');
  const visiveis = projetosVisiveis();
  if(!visiveis.length){ el.innerHTML = emptyState('Nenhum projeto cadastrado', 'Cadastre projetos para acompanhar o avanço físico e financeiro conforme as atividades concluídas pelas equipes.'); bindEmptyCta(el, ()=>setView('projetos')); return; }
  const list = visiveis.filter(p=>{
    if(avancoFilters.status && p.status!==avancoFilters.status) return false;
    if(avancoFilters.q){ const t=(p.codigo+' '+(p.nome||'')).toLowerCase(); if(!t.includes(avancoFilters.q.toLowerCase())) return false; }
    return true;
  });
  el.innerHTML = `
    <div class="panel-head" style="padding:0;margin-bottom:16px;border:none;">
      <div class="filters">
        <input id="f-av-q" placeholder="Buscar projeto…" value="${esc(avancoFilters.q)}">
        <select id="f-av-status"><option value="">Todos os status</option>${STATUS_PROJETO.map(s=>`<option ${avancoFilters.status===s?'selected':''}>${s}</option>`).join('')}</select>
      </div>
      <span style="font-size:12px;color:var(--muted);">${list.length} de ${visiveis.length} projetos</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:18px;">${list.length? list.map(avancoCard).join('') : `<div class="panel"><div class="empty-state">${icon('empty',34)}<p>Nenhum projeto encontrado com os filtros.</p></div></div>`}</div>`;
  document.getElementById('f-av-q').addEventListener('input', e=>{ avancoFilters.q=e.target.value; renderContent(); });
  document.getElementById('f-av-status').addEventListener('change', e=>{ avancoFilters.status=e.target.value; renderContent(); });
  el.querySelectorAll('[data-avanco-detalhe]').forEach(b=>b.addEventListener('click', ()=>openAvancoDetalhe(b.dataset.avancoDetalhe)));
  el.querySelectorAll('[data-plano-pj]').forEach(b=>b.addEventListener('click', ()=>openPlanoFisicoModal(b.dataset.planoPj)));
}
function avancoCard(pj){
  const av = projetoAvanco(pj);
  const eqRows = Object.keys(av.porEquipe).map(id=>({ id:Number(id), ...av.porEquipe[id] }));
  const hintFisico = av.hasPlano
    ? `${av.execQty} de ${av.totalQty} unidades executadas do plano físico (${av.fisicoPct.toFixed(1)}%)`
    : `${av.fisicoPct.toFixed(1)}% das atividades concluídas pelas equipes`;
  return `
  <div class="panel">
    <div class="panel-head">
      <div><h3>${esc(pj.nome)}</h3><div class="admin-field-meta">${esc(pj.codigo)} · ${fmtDate(pj.dataInicio)}${pj.dataFim?' → '+fmtDate(pj.dataFim):''}</div></div>
      ${projStatusBadge(pj.status)}
    </div>
    <div style="padding:14px 18px;display:flex;flex-direction:column;gap:14px;">
      <div class="grid-stats" style="margin:0;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));">
        <div class="stat-card" style="--accent-c:var(--blue);padding:12px 14px;"><div class="lbl">Orçado</div><div class="val" style="font-size:18px;">${fmtMoney(av.valorOrcado)}</div></div>
        <div class="stat-card" style="--accent-c:var(--green);padding:12px 14px;"><div class="lbl">Executado</div><div class="val" style="font-size:18px;">${fmtMoney(av.valorExecutado)}</div></div>
        <div class="stat-card" style="--accent-c:var(--red);padding:12px 14px;"><div class="lbl">Restante</div><div class="val" style="font-size:18px;">${fmtMoney(av.restante)}</div></div>
        <div class="stat-card" style="--accent-c:var(--accent);padding:12px 14px;"><div class="lbl">Concluídas</div><div class="val" style="font-size:18px;">${av.concluidoLinhas}<small>/ ${av.totalLinhas}</small></div></div>
      </div>
      <div class="field"><label>Avanço físico</label>${progBarHtml(av.fisicoPct)}<div class="field-hint">${hintFisico}</div></div>
      <div class="field"><label>Avanço financeiro</label>${progBarHtml(av.financeiroPct)}<div class="field-hint">${fmtMoney(av.valorExecutado)} executados de ${fmtMoney(av.valorOrcado)} orçados (${av.financeiroPct.toFixed(1)}%)</div></div>
      ${eqRows.length? `<div class="table-scroll"><table class="min">
        <thead><tr><th>Equipe</th><th>Equipe comp.</th><th>Concluídas</th><th>Executado (R$)</th><th>Físico</th></tr></thead>
        <tbody>${eqRows.map(e=>{
          const eq=findEquipe(e.id);
          const pct = e.totalQty>0? e.execQty/e.totalQty*100 : (e.totalLinhas>0? e.concluidoLinhas/e.totalLinhas*100:0);
          return `<tr><td><span class="badge-prefix">${eqtlLabel(eq)}</span></td><td><span class="badge-prefix">${prtnLabel(eq)}</span></td><td>${e.concluidoLinhas}/${e.totalLinhas}</td><td class="mono">${fmtMoney(e.valorExecutado)}</td><td style="min-width:130px;">${progBarHtml(pct,{thin:true})}</td></tr>`;
        }).join('')}</tbody></table></div>`:''}
      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button class="btn btn-sm" data-plano-pj="${pj.id}">${icon('edit',13)} Plano físico</button>
        <button class="btn btn-sm" data-avanco-detalhe="${pj.id}">${icon('history',13)} Ver detalhes completos</button>
      </div>
    </div>
  </div>`;
}
function openAvancoDetalhe(pjId){
  const pj = findProjeto(pjId); if(!pj) return;
  const av = projetoAvanco(pj);
  const rows = [...av.linhas].sort((a,b)=>a.data.localeCompare(b.data));
  const body = `
    <div class="grid-stats" style="margin:0 0 6px;">
      <div class="stat-card" style="--accent-c:var(--blue)"><div class="lbl">Valor orçado</div><div class="val" style="font-size:19px;">${fmtMoney(av.valorOrcado)}</div></div>
      <div class="stat-card" style="--accent-c:var(--green)"><div class="lbl">Valor executado</div><div class="val" style="font-size:19px;">${fmtMoney(av.valorExecutado)}</div></div>
      <div class="stat-card" style="--accent-c:var(--red)"><div class="lbl">Restante</div><div class="val" style="font-size:19px;">${fmtMoney(av.restante)}</div></div>
      <div class="stat-card" style="--accent-c:var(--accent)"><div class="lbl">Atividades</div><div class="val" style="font-size:19px;">${av.concluidoLinhas}<small> / ${av.totalLinhas}</small></div></div>
    </div>
    <div class="field"><label>Avanço físico (${av.fisicoPct.toFixed(1)}%)</label>${progBarHtml(av.fisicoPct)}<div class="field-hint">${av.hasPlano? `${av.execQty} de ${av.totalQty} unidades do plano físico executadas` : `${av.concluidoLinhas} de ${av.totalLinhas} atividades concluídas`}</div></div>
    <div class="field"><label>Avanço financeiro (${av.financeiroPct.toFixed(1)}%)</label>${progBarHtml(av.financeiroPct)}</div>
    ${av.hasPlano? `
    <div class="field">
      <label>Plano físico (atividade × quantidade)</label>
      <div class="panel" style="max-height:220px;overflow:auto;">
        <div class="table-scroll"><table>
          <thead><tr><th>Atividade</th><th>Planejado</th><th>Executado</th><th>% física</th></tr></thead>
          <tbody>${av.plano.map(a=>{
            const at=findAtividade(a.atividadeId);
            const exec = av.execByAtividade[a.atividadeId]||0;
            const pct = a.quantidade>0? Math.min(100, exec/a.quantidade*100):0;
            return `<tr>
              <td><span class="mono" style="color:var(--accent);">${esc(at?.codigo||'?')}</span> <span style="color:var(--muted-2);font-size:11.5px;">${esc(at?.descricao||'')}</span></td>
              <td class="mono">${a.quantidade}</td>
              <td class="mono">${exec}</td>
              <td style="min-width:130px;">${progBarHtml(pct,{thin:true})}</td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>
      </div>
    </div>` : ''}
    <div class="field">
      <label>Detalhes por atividade</label>
      <div class="panel" style="max-height:300px;overflow:auto;">
        <div class="table-scroll"><table>
          <thead><tr><th>Data</th><th>Equipe</th><th>Equipe comp.</th><th>Atividade</th><th>Prev.</th><th>Exec.</th><th>Valor exec.</th><th>Status</th></tr></thead>
          <tbody>${rows.length? rows.map(r=>`
            <tr>
              <td class="mono">${fmtDate(r.data)}</td>
              <td><span class="badge-prefix">${eqtlLabel(findEquipe(r.equipeId))}</span></td>
              <td><span class="badge-prefix">${prtnLabel(findEquipe(r.equipeId))}</span></td>
              <td><span class="mono" style="color:var(--accent);">${esc(r.codigo)}</span> <span style="color:var(--muted-2);font-size:11.5px;">${esc(r.descricao)}</span></td>
              <td class="mono">${r.prev||'—'}</td>
              <td class="mono">${r.exec!=null? r.exec:'—'}</td>
              <td class="mono">${fmtMoney(r.execVal)}</td>
              <td>${statusBadge(r.status)}</td>
            </tr>`).join('') : `<tr class="empty-row"><td colspan="8">Nenhuma atividade vinculada a este projeto.</td></tr>`}
          </tbody>
        </table></div>
      </div>
    </div>
  `;
  openModal({ title:`Avanço — ${esc(pj.nome)}`, bodyHtml:body, submitLabel:'Fechar', onSubmit:()=>true, wide:true });
}

/* =========================================================
   VIEW: PROGRAMAÇÕES (lista, fluxo, calendário)
========================================================= */
function programacoesFiltradas(){
  return flatAtribuicoes().filter(x=>{
    if(progFilters.projeto && String(x.programacao.projetoId)!==progFilters.projeto) return false;
    if(progFilters.equipe && String(x.atribuicao.equipeId)!==progFilters.equipe) return false;
    if(progFilters.status && x.atribuicao.status!==progFilters.status) return false;
    if(progFilters.ciclo && (x.programacao.ciclo||'')!==progFilters.ciclo) return false;
    if(progFilters.dataDe && x.atribuicao.dataProgramada < progFilters.dataDe) return false;
    if(progFilters.dataAte && x.atribuicao.dataProgramada > progFilters.dataAte) return false;
    return true;
  }).sort((a,b)=> a.atribuicao.dataProgramada.localeCompare(b.atribuicao.dataProgramada));
}
function ciclosUnicos(){ return [...new Set(DB.programacoes.map(p=>p.ciclo).filter(Boolean))].sort(); }
function cicloPadrao(){
  const ciclos = ciclosUnicos();
  for(let i=ciclos.length-1;i>=0;i--){
    const c = ciclos[i];
    if(DB.programacoes.some(p=>p.ciclo===c && (p.atribuicoes||[]).some(a=>a.status==='Concluído'))) return c;
  }
  return ciclos[ciclos.length-1] || '';
}
function flatPorCicloPadrao(){
  const c = progFilters.ciclo || cicloPadrao();
  if(!c) return flatAtribuicoes();
  return flatAtribuicoes().filter(x=>x.programacao.ciclo===c);
}
function renderProgramacoes(){
  const el = document.getElementById('content');
  if(!projetosVisiveis().length || !DB.atividades.length || !DB.equipes.length){
    el.innerHTML = emptyState('Cadastre projetos, atividades e equipes primeiro', 'Uma programação vincula um projeto, uma ou mais equipes (cada uma com suas atividades e quantidades) a uma data.');
    return;
  }
  const list = programacoesFiltradas();
  el.innerHTML = `
    <div class="panel-head" style="padding:0;margin-bottom:16px;border:none;">
      <div class="filters">
        <select id="f-projeto"><option value="">Todos os projetos</option>${projetosVisiveis().map(p=>`<option value="${p.id}" ${progFilters.projeto==String(p.id)?'selected':''}>${esc(p.codigo)} · ${esc(p.nome)}</option>`).join('')}</select>
        <select id="f-equipe"><option value="">Todas as equipes</option>${equipesVisiveis().map(e=>`<option value="${e.id}" ${progFilters.equipe==String(e.id)?'selected':''}>${equipeLabel(e)}${e.encarregado? ' — '+esc(e.encarregado):''}</option>`).join('')}</select>
        <select id="f-status"><option value="">Todos os status</option>${STATUS_PROG.map(s=>`<option ${progFilters.status===s?'selected':''}>${s}</option>`).join('')}</select>
        <select id="f-ciclo"><option value="">Todos os ciclos</option>${ciclosUnicos().map(c=>`<option ${progFilters.ciclo===c?'selected':''}>${c}</option>`).join('')}</select>
        <input type="date" id="f-data-de" value="${progFilters.dataDe}" title="Data inicial">
        <span style="color:var(--muted);font-size:12px;">até</span>
        <input type="date" id="f-data-ate" value="${progFilters.dataAte}" title="Data final">
        <button class="btn btn-sm" id="f-mes-atual" title="Filtrar pelo mês vigente">${icon('calendar',12)} Mês atual</button>
        <button class="btn btn-sm btn-ghost" id="f-limpar-datas" title="Remover o filtro de datas">Limpar</button>
      </div>
      <div class="tabs">
        <button class="tab ${progFilters.modo==='lista'?'active':''}" data-modo="lista">Lista</button>
        <button class="tab ${progFilters.modo==='fluxo'?'active':''}" data-modo="fluxo">Fluxo</button>
        <button class="tab ${progFilters.modo==='calendario'?'active':''}" data-modo="calendario">Calendário</button>
      </div>
    </div>
    <div id="prog-area"></div>`;
  document.getElementById('f-projeto').addEventListener('change', e=>{progFilters.projeto=e.target.value; renderContent();});
  document.getElementById('f-equipe').addEventListener('change', e=>{progFilters.equipe=e.target.value; renderContent();});
  document.getElementById('f-status').addEventListener('change', e=>{progFilters.status=e.target.value; renderContent();});
  document.getElementById('f-ciclo').addEventListener('change', e=>{progFilters.ciclo=e.target.value; renderContent();});
  document.getElementById('f-data-de').addEventListener('change', e=>{progFilters.dataDe=e.target.value; renderContent();});
  document.getElementById('f-data-ate').addEventListener('change', e=>{progFilters.dataAte=e.target.value; renderContent();});
  document.getElementById('f-mes-atual').addEventListener('click', ()=>{ const r=monthRangeISO(); progFilters.dataDe=r.de; progFilters.dataAte=r.ate; renderContent(); });
  document.getElementById('f-limpar-datas').addEventListener('click', ()=>{ progFilters.dataDe=''; progFilters.dataAte=''; renderContent(); });
  el.querySelectorAll('.tab').forEach(t=>t.addEventListener('click', ()=>{progFilters.modo=t.dataset.modo; renderContent();}));

  const area = document.getElementById('prog-area');
  if(progFilters.modo==='calendario'){ renderProgCalendarioInto(area, list); return; }
  if(!list.length){
    if(progFilters.ciclo){ progFilters.ciclo=''; renderProgramacoes(); return; }
    area.innerHTML = programacoesVisiveis().length
      ? emptyState('Nenhuma programação encontrada', 'Ajuste os filtros para ver as programações.')
      : emptyState('Nenhuma programação cadastrada', 'Clique em "Nova programação" para criar a primeira.');
    return;
  }
  if(progFilters.modo==='lista') renderProgListaInto(area, list); else renderProgFluxoInto(area, list);
}

function renderProgListaInto(area, list){
  area.innerHTML = `<div class="panel"><div class="table-scroll"><table>
    <thead><tr><th>ID</th><th>Data</th><th>Projeto</th><th>Ciclo</th><th>Equipe</th><th>Equipe comp.</th><th>Atividades</th><th>Valor prev.</th><th>Status</th><th></th></tr></thead>
    <tbody>${list.map(x=>{
      const p=x.atribuicao, pr=findProjeto(x.programacao.projetoId), eq=findEquipe(p.equipeId), late=isLate(p);
      const valPrev = p.atividades.reduce((s,a)=> s + (a.quantidadePrevista||0)*(findAtividade(a.atividadeId)?.valorUnitario||0), 0);
      const metaWarn = metaWarningHtml(p);
      return `<tr>
        <td class="mono" style="white-space:nowrap;">${progGid(x.programacao)}</td>
        <td class="mono">${fmtDate(p.dataProgramada)} ${late?`<div class="blink-red" style="font-size:10.5px;">VENCIDA</div>`:''}</td>
        <td>${esc(pr?.nome||'—')}<div style="color:var(--muted-2);font-size:11px;">${esc(pr?.setor||'')} · ${esc(pr?.coordenacao||'')}</div></td>
        <td><span class="badge" style="color:var(--teal);background:rgba(87,199,199,.12);font-size:10.5px;">${esc(x.programacao.ciclo||'—')}</span></td>
        <td><span class="badge-prefix">${eqtlLabel(eq)}</span></td>
        <td><span class="badge-prefix">${prtnLabel(eq)}</span>${metaWarn? `<div style="margin-top:4px;">${metaWarn}</div>`:''}</td>
        <td style="font-size:12px;color:var(--muted);">${atividadesResumo(p.atividades)}</td>
        <td class="mono">${fmtMoney(valPrev)}</td>
        <td>${statusBadge(p.status, late)}${teamBadgeHtml(p)? `<div style="margin-top:4px;">${teamBadgeHtml(p)}</div>`:''}</td>
        <td><div class="row-actions">
          <button class="icon-btn" title="Encaminhar para as equipes no WhatsApp" data-whats="${x.programacao.id}">${icon('whatsapp',14)}</button>
          <button class="icon-btn" title="Imprimir documento de campo" data-doc-prog="${x.programacao.id}">${icon('print',14)}</button>
          <button class="icon-btn" title="Histórico" data-hist="${p.id}">${icon('history',14)}</button>
          <button class="icon-btn" title="Reprogramar" data-reprog="${x.programacao.id}|${p.id}">${icon('reprog',14)}</button>
          <button class="icon-btn" title="Editar programação" data-edit-prog="${x.programacao.id}">${icon('edit',14)}</button>
          <button class="icon-btn" title="Excluir equipe desta programação" data-del-atrib="${x.programacao.id}|${p.id}">${icon('trash',14)}</button>
        </div></td>
      </tr>`;
    }).join('')}</tbody></table></div></div>`;
  bindProgRowActions(area);
}
function bindProgRowActions(area){
  area.querySelectorAll('[data-whats]').forEach(b=>b.addEventListener('click', ()=>encaminharWhats(b.dataset.whats)));
  area.querySelectorAll('[data-doc-prog]').forEach(b=>b.addEventListener('click', ()=>openDocProgramacao(b.dataset.docProg)));
  area.querySelectorAll('[data-hist]').forEach(b=>b.addEventListener('click', ()=>openHistoricoModal(b.dataset.hist)));
  area.querySelectorAll('[data-reprog]').forEach(b=>b.addEventListener('click', ()=>{ const [pgId,atId]=b.dataset.reprog.split('|'); openReprogramarManual(pgId, atId); }));
  area.querySelectorAll('[data-edit-prog]').forEach(b=>b.addEventListener('click', ()=>openProgramacaoModal(b.dataset.editProg)));
  area.querySelectorAll('[data-del-atrib]').forEach(b=>b.addEventListener('click', ()=>{ const [pgId,atId]=b.dataset.delAtrib.split('|'); deleteAtribuicao(pgId, atId); }));
}
function deleteAtribuicao(pgId, atId){
  if(!confirm('Remover esta equipe desta programação?')) return;
  const pg = DB.programacoes.find(p=>p.id===Number(pgId));
  pg.atribuicoes = pg.atribuicoes.filter(a=>a.id!==Number(atId));
  if(!pg.atribuicoes.length) DB.programacoes = DB.programacoes.filter(p=>p.id!==pg.id);
  saveData(); renderContent(); toast('Removido.');
}

function renderProgFluxoInto(area, list){
  const cols = STATUS_PROG.map(status=>{
    const items = list.filter(x=>x.atribuicao.status===status);
    const c = STATUS_COLOR[status];
    return `<div class="kanban-col" style="--col-c:${c}" data-drop-status="${status}">
      <div class="kanban-col-head"><h4>${status}</h4><span class="count">${items.length}</span></div>
      <div class="kanban-cards">${items.map(x=>{
        const p=x.atribuicao, pr=findProjeto(x.programacao.projetoId), eq=findEquipe(p.equipeId), late=isLate(p);
        const valPrev = valorProgramadoAtrib(p);
        const metaWarn = metaWarningHtml(p);
        return `<div class="kcard ${late?'pending':''}" draggable="true" data-atrib="${p.id}" data-open-prog="${p.id}">
          <div class="kc-code ${late?'blink-red':''}">${late?'VENCIDA · ':''}${equipeLabel(eq)}</div>
          <div class="kc-title">${esc(atividadesResumo(p.atividades))}</div>
          <div class="kc-meta"><span>${esc(pr?.nome||'—')}<span style="color:var(--muted-2);"> · ${esc(pr?.setor||'')} · ${esc(pr?.coordenacao||'')}</span></span><span class="badge" style="color:var(--teal);background:rgba(87,199,199,.12);font-size:10px;">${esc(x.programacao.ciclo||'')}</span></div>
          <div class="kc-meta"><span>${fmtDate(p.dataProgramada)}</span><span class="mono" style="color:var(--accent);">${progGid(x.programacao)}</span><span class="mono" style="color:var(--muted);">${p.atividades.length} ativ. · ${fmtMoney(valPrev)}</span></div>
          ${metaWarn? `<div class="kc-meta" style="justify-content:flex-start;">${metaWarn}</div>`:''}
          ${teamBadgeHtml(p)? `<div class="kc-meta" style="justify-content:flex-start;">${teamBadgeHtml(p)}</div>`:''}
        </div>`;
      }).join('') || `<div style="padding:14px;color:var(--muted-2);font-size:11.5px;">Vazio</div>`}</div>
    </div>`;
  }).join('');
  area.innerHTML = renderKanbanStrip() + `<div class="kanban">${cols}</div>`;
  bindKanbanDrag(area);
}
function renderKanbanStrip(){
  const days = [];
  const start = todayISO();
  for(let i=0;i<28;i++) days.push(shiftISO(start, i));
  return `<div class="kanban-strip">
    <div class="ks-title">${icon('reprog',13)} <strong>Reprogramar arrastando:</strong> arraste um card sobre uma data para reprogramar, ou sobre outra coluna para mudar o status.</div>
    <div class="ks-days">${days.map(iso=>{
      const d = new Date(iso+'T12:00:00');
      const dow = d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','');
      return `<div class="ks-day ${iso===todayISO()?'today':''}" data-date="${iso}" title="Reprogramar para ${fmtDate(iso)}"><span class="ks-dow">${dow}</span><span class="ks-num">${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}</span></div>`;
    }).join('')}</div>
  </div>`;
}
function findAtribuicaoGlobal(atribId){
  for(const p of DB.programacoes){ const f=(p.atribuicoes||[]).find(a=>a.id===Number(atribId)); if(f) return f; }
  return null;
}
function progDaAtribuicao(atribId){
  return DB.programacoes.find(p=> (p.atribuicoes||[]).some(a=>a.id===Number(atribId)));
}
function pedirMotivoStatus(atribId, novoStatus, onOk){
  if(!requerEscrita()) return;
  const atrib = findAtribuicaoGlobal(atribId);
  if(!atrib || atrib.status===novoStatus) return;
  const de = atrib.status;
  const eq = findEquipe(atrib.equipeId);
  const body = `
    <div class="modal-body">
      <div style="font-size:12.5px;color:var(--muted);margin-bottom:12px;">Alterar o status de <strong>${de}</strong> para <strong>${novoStatus}</strong>${eq? ' — '+esc(equipeLabel(eq)):''}</div>
      <div class="field"><label>Motivo <span class="req">*</span></label><input type="text" name="motivo" required maxlength="200" placeholder="Descreva o motivo desta alteração de status"></div>
      <div class="field"><label>Observações</label><textarea name="obs" rows="2" placeholder="Detalhes opcionais"></textarea></div>
    </div>`;
  openModal({
    title:'Motivo da alteração de status', bodyHtml: body, submitLabel:'Alterar status',
    onSubmit:(fd)=>{
      const motivo = String(fd.get('motivo')||'').trim();
      const obs = String(fd.get('obs')||'').trim();
      if(!motivo){ toast('Informe o motivo da alteração.', 'error'); return false; }
      atrib.status = novoStatus;
      atrib.historico = atrib.historico||[];
      atrib.historico.push({...currentAutor(), ts:Date.now(), tipo:'status', de, para:novoStatus, motivo, obs: obs||null});
      const pgX = progDaAtribuicao(atrib.id);
      registrarEvento('status','atribuicao',atrib.id, (pgX? progGid(pgX)+' · ': '')+equipeLabel(findEquipe(atrib.equipeId)), de+' → '+novoStatus+' · '+motivo+(obs? ' · '+obs:''));
      saveData(); renderContent(); renderBanner(); toast('Status alterado para '+novoStatus+'.');
      onOk && onOk();
    }
  });
}
    function setAtribStatusGlobal(atribId, status){
      if(!requerEscrita()) return;
      pedirMotivoStatus(atribId, status);
}
function bindKanbanDrag(area){
  let dragId = null;
  area.querySelectorAll('.kcard[draggable]').forEach(card=>{
    card.addEventListener('dragstart', e=>{
      dragId = card.dataset.atrib; card.classList.add('dragging');
      try{ e.dataTransfer.setData('text/plain', String(card.dataset.atrib)); e.dataTransfer.effectAllowed='move'; }catch(err){}
    });
    card.addEventListener('dragend', ()=>{ card.classList.remove('dragging'); });
  });
  area.querySelectorAll('.kanban-col').forEach(col=>{
    col.addEventListener('dragover', e=>{ e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', ()=>{ col.classList.remove('drag-over'); });
    col.addEventListener('drop', e=>{
      e.preventDefault(); col.classList.remove('drag-over');
      const id = Number(e.dataTransfer?.getData('text/plain') || dragId);
      if(id) setAtribStatusGlobal(id, col.dataset.dropStatus);
    });
  });
  area.querySelectorAll('.ks-day').forEach(day=>{
    day.addEventListener('dragover', e=>{ e.preventDefault(); day.classList.add('drag-over'); });
    day.addEventListener('dragleave', ()=>{ day.classList.remove('drag-over'); });
    day.addEventListener('drop', e=>{
      e.preventDefault(); day.classList.remove('drag-over');
      const id = Number(e.dataTransfer?.getData('text/plain') || dragId);
      if(id) openReprogramarConfirmacao(id, day.dataset.date);
    });
  });
  area.querySelectorAll('[data-open-prog]').forEach(c=>c.addEventListener('click', ()=>openAtribDetalhe(c.dataset.openProg)));
}

function shiftISO(iso, days){
  const d = new Date(iso+'T12:00:00'); d.setDate(d.getDate()+days);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function renderProgCalendarioInto(area, list){
  const subTabs = `
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
      <div class="tabs">
        <button class="tab ${progFilters.calView==='mes'?'active':''}" data-cal-view="mes">Mês (externa)</button>
        <button class="tab ${progFilters.calView==='dia'?'active':''}" data-cal-view="dia">Dia (interna)</button>
      </div>
      ${progFilters.calView==='dia'? `<div style="display:flex;align-items:center;gap:8px;">
        <button class="icon-btn" id="day-prev">${icon('chevL',16)}</button>
        <span class="mono" style="color:var(--text);font-weight:700;">${fmtDate(progFilters.calDay)}</span>
        <button class="icon-btn" id="day-next">${icon('chevR',16)}</button>
      </div>`:''}
      <span style="font-size:12px;color:var(--muted);">${list.length} programação(ões)</span>
    </div>`;
  const bindTabs = ()=>{
    area.querySelectorAll('.tab[data-cal-view]').forEach(b=>b.addEventListener('click', ()=>{ progFilters.calView=b.dataset.calView; renderContent(); }));
  };
  if(progFilters.calView==='dia'){
    const dayList = list.filter(x=>x.atribuicao.dataProgramada===progFilters.calDay);
    area.innerHTML = subTabs + (dayList.length? renderDayList(dayList) : `<div class="panel"><div class="empty-state">${icon('empty',34)}<p>Nenhuma programação em ${fmtDate(progFilters.calDay)}.</p></div></div>`);
    bindTabs();
    const pv=area.querySelector('#day-prev'), nx=area.querySelector('#day-next');
    if(pv) pv.addEventListener('click', ()=>{ progFilters.calDay=shiftISO(progFilters.calDay,-1); renderContent(); });
    if(nx) nx.addEventListener('click', ()=>{ progFilters.calDay=shiftISO(progFilters.calDay,1); renderContent(); });
    area.querySelectorAll('[data-open-prog]').forEach(c=>c.addEventListener('click', ()=>openAtribDetalhe(c.dataset.openProg)));
    area.querySelectorAll('[data-doc-prog]').forEach(c=>c.addEventListener('click', ()=>openDocProgramacao(c.dataset.docProg)));
    return;
  }
  const year = calRef.getFullYear(), month = calRef.getMonth();
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const monthName = calRef.toLocaleDateString('pt-BR', {month:'long', year:'numeric'});
  const byDate = {};
  list.forEach(x=>{ (byDate[x.atribuicao.dataProgramada] = byDate[x.atribuicao.dataProgramada]||[]).push(x); });

  let cells = '';
  for(let i=0;i<startDow;i++) cells += `<div class="cal-cell out"></div>`;
  for(let d=1; d<=daysInMonth; d++){
    const iso = year+'-'+String(month+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const items = byDate[iso]||[];
    const isToday = iso===todayISO();
    cells += `<div class="cal-cell ${isToday?'today':''}">
      <div class="cal-daynum" data-day-view="${iso}" style="cursor:pointer;" title="Ver dia">${d} ${items.length?`<span style="color:var(--accent);">· ${items.length}</span>`:''}</div>
      ${items.slice(0,3).map(x=>{
        const eq=findEquipe(x.atribuicao.equipeId); const late=isLate(x.atribuicao); const c=STATUS_COLOR[x.atribuicao.status];
        return `<div class="cal-chip ${late?'blink-red':''}" style="color:${late?'var(--red)':c};border-color:${late?'var(--red)':'var(--border)'}" data-open-prog="${x.atribuicao.id}">${equipeLabel(eq)}</div>`;
      }).join('')}
      ${items.length>3? `<div style="font-size:10px;color:var(--accent);cursor:pointer;" data-day-view="${iso}">+${items.length-3} mais</div>`:''}
    </div>`;
  }
  const dows = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  area.innerHTML = `
    ${subTabs}
    <div class="panel" style="padding:16px;">
      <div class="cal-nav">
        <button class="icon-btn" id="cal-prev">${icon('chevL',16)}</button>
        <h3 style="text-transform:capitalize;">${monthName}</h3>
        <button class="icon-btn" id="cal-next">${icon('chevR',16)}</button>
      </div>
      <div class="cal-grid">${dows.map(d=>`<div class="cal-dow">${d}</div>`).join('')}${cells}</div>
    </div>`;
  bindTabs();
  document.getElementById('cal-prev').addEventListener('click', ()=>{ calRef = new Date(year, month-1, 1); renderContent(); });
  document.getElementById('cal-next').addEventListener('click', ()=>{ calRef = new Date(year, month+1, 1); renderContent(); });
  area.querySelectorAll('[data-day-view]').forEach(c=>c.addEventListener('click', ()=>{ progFilters.calDay=c.dataset.dayView; progFilters.calView='dia'; renderContent(); }));
  area.querySelectorAll('[data-open-prog]').forEach(c=>c.addEventListener('click', ()=>openAtribDetalhe(c.dataset.openProg)));
}
function renderDayList(dayList){
  return `<div style="display:flex;flex-direction:column;gap:14px;">${dayList.map(x=>{
    const p=x.atribuicao, pr=findProjeto(x.programacao.projetoId), eq=findEquipe(p.equipeId), late=isLate(p);
    const valPrev = p.atividades.reduce((s,a)=> s + (a.quantidadePrevista||0)*(findAtividade(a.atividadeId)?.valorUnitario||0), 0);
    return `<div class="panel">
      <div class="panel-head">
        <div><h3>${esc(pr?.nome||'—')}</h3><div class="admin-field-meta">${progGid(x.programacao)} · ${esc(x.programacao.ciclo||'')} · ${equipeLabel(eq)} · ${fmtDate(p.dataProgramada)}</div></div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">${metaWarningHtml(p)}${teamBadgeHtml(p)}${statusBadge(p.status, late)}</div>
      </div>
      <div style="padding:12px 16px;">
        <div class="table-scroll"><table class="min">
          <thead><tr><th>Código</th><th>Descrição</th><th>Un.</th><th>Prev.</th><th>Exec.</th><th>V. unit.</th><th>V. prev.</th></tr></thead>
          <tbody>${p.atividades.map(a=>{const at=findAtividade(a.atividadeId); return `<tr>
            <td class="mono" style="color:var(--accent);font-weight:700;">${esc(at?.codigo||'?')}</td>
            <td>${esc(at?.descricao||'')}</td><td>${esc(at?.unidade||'')}</td>
            <td class="mono">${a.quantidadePrevista??'—'}</td>
            <td class="mono">${a.quantidadeExecutada!=null?a.quantidadeExecutada:'—'}</td>
            <td class="mono">${fmtMoney(at?.valorUnitario||0)}</td>
            <td class="mono">${fmtMoney((a.quantidadePrevista||0)*(at?.valorUnitario||0))}</td>
          </tr>`;}).join('')}
          <tr style="font-weight:700;"><td colspan="6" style="text-align:right;">Total previsto</td><td class="mono">${fmtMoney(valPrev)}</td></tr>
          </tbody>
        </table></div>
        <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;">
          <button class="btn btn-sm" data-doc-prog="${x.programacao.id}">${icon('print',13)} Imprimir</button>
          <button class="btn btn-sm" data-open-prog="${p.id}">${icon('calendar',13)} Ver detalhe</button>
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function openAtribDetalhe(atribId){
  atribId = Number(atribId);
  let programacao, atrib;
  for(const pg of DB.programacoes){ const found = (pg.atribuicoes||[]).find(a=>a.id===atribId); if(found){ programacao=pg; atrib=found; break; } }
  if(!atrib) return;
  const pr = findProjeto(programacao.projetoId), eq = findEquipe(atrib.equipeId), late = isLate(atrib);
  const rows = atrib.atividades.map(a=>{
    const at = findAtividade(a.atividadeId);
    const prev = a.quantidadePrevista||0;
    const exec = atrib.status==='Concluído'? (a.quantidadeExecutada!=null? a.quantidadeExecutada : prev) : (a.quantidadeExecutada!=null? a.quantidadeExecutada : null);
    const vu = at?.valorUnitario||0;
    return { at, prev, exec, vu, vp: prev*vu, ve: (exec||0)*vu };
  });
  const totPrev = rows.reduce((s,r)=>s+r.vp,0);
  const totExec = rows.reduce((s,r)=>s+r.ve,0);
  const av = projetoAvanco(pr);
  const teamE = lastTeamEdit(atrib);
  const body = `
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div class="dtl-header">
        <div style="min-width:0;">
          <div class="dtl-code">${esc(pr?.codigo||'—')} · ${esc(pr?.setor||'')} · ${esc(pr?.coordenacao||'')}</div>
          <div class="dtl-title">${esc(pr?.nome||'—')}</div>
          <div class="dtl-meta"><span>${icon('hash',12)} ${progGid(programacao)}</span><span>${icon('calendar',12)} Ciclo ${esc(programacao.ciclo||'—')}</span><span>${icon('trend',12)} Orçado ${fmtMoney(pr?.valorOrcado||0)}</span><span>${icon('star',12)} Avanço físico ${av.fisicoPct.toFixed(1)}%</span></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">${projStatusBadge(pr?.status)}${teamBadgeHtml(atrib)}</div>
      </div>

      <div class="dtl-grid">
        <div class="dtl-tile"><div class="dtl-tile-lbl">Equipe</div><div class="dtl-tile-val"><span class="badge-prefix">${equipeLabel(eq)}</span></div>${metaWarningHtml(atrib)? `<div style="margin-top:6px;">${metaWarningHtml(atrib)}</div>`:''}</div>
        <div class="dtl-tile"><div class="dtl-tile-lbl">Data programada</div><div class="dtl-tile-val mono">${fmtDate(atrib.dataProgramada)}</div>${late? `<div class="blink-red" style="font-size:11px;color:var(--red);margin-top:4px;">VENCIDA</div>`:''}</div>
        <div class="dtl-tile"><div class="dtl-tile-lbl">Encarregado</div><div class="dtl-tile-val">${esc(eq?.encarregado||'—')}</div></div>
        <div class="dtl-tile"><div class="dtl-tile-lbl">Status</div><div class="dtl-tile-val">${statusBadge(atrib.status, late)}</div></div>
        <div class="dtl-tile" style="grid-column:1/-1;"><div class="dtl-tile-lbl">Local de execução</div><div class="dtl-tile-val">${programacao.local? esc(programacao.local) : '—'}</div>${(programacao.local||programacao.localLat!=null)? `<div style="margin-top:4px;font-size:11.5px;"><a href="${esc(localMapsHref(programacao.local,programacao.localLat,programacao.localLng))}" target="_blank" rel="noopener" style="color:var(--blue);font-weight:600;">${icon('pin',11)} Abrir no Google Maps</a></div>`:''}</div>
      </div>

      ${teamE? `<div class="dtl-team-note">${icon('alert',14)} <div><strong>Alterada pela equipe</strong> em ${fmtDateTime(teamE.ts)} — ${esc(teamE.motivo||'')}</div></div>`:''}

      <div class="dtl-section">
        <div class="dtl-section-head"><h4>Atividades</h4><span class="mono">${fmtMoney(totPrev)} previsto</span></div>
        <div class="table-scroll"><table class="min">
          <thead><tr><th>Código</th><th>Descrição</th><th>Un.</th><th>Prev.</th><th>Exec.</th><th>V. unit.</th><th>V. prev.</th><th>V. exec.</th></tr></thead>
          <tbody>${rows.map(r=>`<tr>
            <td class="mono" style="color:var(--accent);font-weight:700;">${esc(r.at?.codigo||'?')}</td>
            <td>${esc(r.at?.descricao||'')}</td><td>${esc(r.at?.unidade||'')}</td>
            <td class="mono">${r.prev||'—'}</td>
            <td class="mono">${r.exec!=null? r.exec:'—'}</td>
            <td class="mono">${fmtMoney(r.vu)}</td>
            <td class="mono">${fmtMoney(r.vp)}</td>
            <td class="mono">${fmtMoney(r.ve)}</td>
          </tr>`).join('')}
          <tr class="dtl-total-row"><td colspan="6">Totais</td><td class="mono">${fmtMoney(totPrev)}</td><td class="mono">${fmtMoney(totExec)}</td></tr>
          </tbody>
        </table></div>
      </div>

      ${(programacao.anexos&&programacao.anexos.length)? `<div class="dtl-section">
        <div class="dtl-section-head"><h4>Anexos do programador</h4><span class="mono">${programacao.anexos.length} imagem(ns)</span></div>
        ${anexosDisplayHtml(programacao.anexos)}
      </div>`:''}

      ${(programacao.localLat!=null && programacao.localLng!=null)? `<div class="dtl-section">
        <div class="dtl-section-head"><h4>Localização no mapa</h4></div>
        <div style="padding:12px;"><a href="${esc(staticMapUrl(programacao.localLat,programacao.localLng,16,800,450))}" target="_blank" rel="noopener">${localThumbHtml(programacao.local,programacao.localLat,programacao.localLng)}</a></div>
      </div>`:''}

      ${String(programacao.orientacoesPlanejamento||'').trim()? `<div class="dtl-section">
        <div class="dtl-section-head"><h4>Orientações do Setor de Planejamento</h4></div>
        <div style="white-space:pre-wrap;line-height:1.55;">${esc(programacao.orientacoesPlanejamento)}</div>
      </div>`:''}

      <div class="dtl-actions">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span class="dtl-actions-lbl">Alterar status:</span>
          ${STATUS_PROG.filter(s=>s!==atrib.status).map(s=>`<button type="button" class="btn btn-sm" data-set-status="${s}">→ ${s}</button>`).join('')}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" class="btn btn-sm" data-whats-detail="${programacao.id}">${icon('whatsapp',13)} Encaminhar WhatsApp</button>
          <button type="button" class="btn btn-sm" data-edit-detail="${programacao.id}">${icon('edit',13)} Editar programação</button>
          <button type="button" class="btn btn-sm" data-doc-detail="${programacao.id}">${icon('print',13)} Documento de campo</button>
          <button type="button" class="btn btn-sm" data-reprog-detail="${programacao.id}|${atrib.id}">${icon('reprog',13)} Reprogramar</button>
          <button type="button" class="btn btn-sm" data-hist-detail="${atrib.id}">${icon('history',13)} Histórico</button>
        </div>
      </div>
    </div>`;
  openModal({ title:'Detalhe da programação', bodyHtml: body, submitLabel:'Fechar', wide:true,
    onMount:(root)=>{
      root.querySelectorAll('[data-set-status]').forEach(b=>b.addEventListener('click', ()=>{
        if(!requerEscrita()) return;
        pedirMotivoStatus(atrib.id, b.dataset.setStatus);
      }));
      root.querySelectorAll('[data-whats-detail]').forEach(b=>b.addEventListener('click', ()=>encaminharWhats(b.dataset.whatsDetail)));
      root.querySelectorAll('[data-edit-detail]').forEach(b=>b.addEventListener('click', ()=>{
        document.getElementById('modal-root').innerHTML='';
        openProgramacaoModal(b.dataset.editDetail);
      }));
      root.querySelectorAll('[data-doc-detail]').forEach(b=>b.addEventListener('click', ()=>openDocProgramacao(b.dataset.docDetail)));
      root.querySelectorAll('[data-reprog-detail]').forEach(b=>b.addEventListener('click', ()=>{ const [pgId,atId]=b.dataset.reprogDetail.split('|'); openReprogramarManual(pgId, atId); }));
      root.querySelectorAll('[data-hist-detail]').forEach(b=>b.addEventListener('click', ()=>openHistoricoModal(b.dataset.histDetail)));
    },
    onSubmit:()=>true
  });
}

/* --- criação/edição de programação com múltiplas equipes --- */
    function openProgramacaoModal(id){
      if(!requerEscrita()) return;
      const pg = id ? DB.programacoes.find(x=>x.id===Number(id)) : null;
  let atribs = pg ? pg.atribuicoes.map(a=>({ equipeId:String(a.equipeId), atividades: a.atividades.map(x=>({atividadeId:String(x.atividadeId), quantidadePrevista:x.quantidadePrevista??''})) })) : [{ equipeId:'', atividades:[{atividadeId:'',quantidadePrevista:''}] }];
  let selProjeto = pg? findProjeto(pg.projetoId) : null;
  let anexos = pg ? (pg.anexos||[]).map(a=>({...a})) : [];
  let anexosEnviando = false;
  let localAddr = pg?.local||'';
  let localLat = pg?.localLat??null;
  let localLng = pg?.localLng??null;

  function atribBlockHtml(a,i){
    return `<div class="atrib-block" data-idx="${i}">
      <div class="atrib-head">
        <select class="atrib-equipe" data-idx="${i}"><option value="">Selecione a equipe…</option>${equipesDoProjeto(selProjeto).map(e=>`<option value="${e.id}" ${String(a.equipeId)===String(e.id)?'selected':''}>${equipeLabel(e)}${e.encarregado? ' · '+esc(e.encarregado):''}</option>`).join('')}</select>
        ${atribs.length>1? `<button type="button" class="icon-btn atrib-remove" data-idx="${i}">${icon('trash',14)}</button>`:''}
      </div>
      <div class="atrib-meta-live" data-idx="${i}"></div>
      <div class="atrib-activities">${a.atividades.map((at,j)=>activityRowHtml(a,i,at,j)).join('')}</div>
      <button type="button" class="btn btn-sm btn-ghost atrib-add-activity" data-idx="${i}">${icon('plus',13)} Adicionar atividade</button>
    </div>`;
  }
  function activityRowHtml(a,i,at,j){
    return `<div class="activity-row" data-idx="${i}" data-jdx="${j}">
      <select class="act-select" data-idx="${i}" data-jdx="${j}"><option value="">Atividade…</option>${atividadesOrdenadas().map(x=>`<option value="${x.id}" ${String(at.atividadeId)===String(x.id)?'selected':''}>${x.fav?'★ ':''}${esc(x.codigo)} · ${esc(x.descricao)}</option>`).join('')}</select>
      <input type="number" step="0.01" min="0" class="act-qty" data-idx="${i}" data-jdx="${j}" placeholder="Qtd." value="${at.quantidadePrevista??''}">
      ${a.atividades.length>1? `<button type="button" class="icon-btn act-remove" data-idx="${i}" data-jdx="${j}">${icon('close',13)}</button>`:''}
    </div>`;
  }
  function renderAtribsHtml(){ return atribs.map((a,i)=> atribBlockHtml(a,i)).join(''); }

  const baseFieldsHtml = `
    <div class="field"><label>Projeto <span class="req">*</span></label><select name="projetoId" id="pg-projeto" required>${projetosVisiveis().filter(p=>!['Encerrado','Aguardando Viabilidade'].includes(p.status)).map(pr=>`<option value="${pr.id}" ${pg?.projetoId===pr.id?'selected':''}>${esc(pr.codigo)} · ${esc(pr.nome)}</option>`).join('')}</select></div>
    <div class="field-row">
      <div class="field"><label>Setor</label><input type="text" id="pg-setor" disabled value=""><div class="field-hint">Preenchido automaticamente do projeto.</div></div>
      <div class="field"><label>Coordenação</label><input type="text" id="pg-coord" disabled value=""><div class="field-hint">Preenchido automaticamente do projeto.</div></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Data programada (base) <span class="req">*</span></label><input type="date" name="dataProgramada" required value="${pg?.dataProgramada||''}"></div>
      <div class="field"><label>Ciclo recebido carteira <span class="req">*</span></label><input type="text" name="ciclo" class="ciclo-input" id="pg-ciclo" required maxlength="13" value="${esc(pg?.ciclo||'')}" placeholder="CICLO-XX/XXXX"><div class="field-hint">Preenchido automaticamente do projeto; pode ser ajustado.</div></div>
    </div>
    <div class="field"><label>Observações gerais</label><textarea name="observacoes">${esc(pg?.observacoes||'')}</textarea></div>
    <div class="field">
      <label>Local / endereço de execução</label>
      <input type="text" name="local" id="pg-local" value="${esc(pg?.local||'')}" placeholder="Digite o endereço onde a equipe vai executar…">
      <div class="field-hint">Enquanto você digita, geramos automaticamente o link do Google Maps com a localização. Também dá para abrir o mapa e marcar o ponto exato. O local e o mapa vão para o documento (PDF), para os registros e para a mensagem do WhatsApp.</div>
      <div id="pg-local-tools"></div>
      <div id="pg-map-wrap" style="display:none;margin-top:8px;">
        <div id="pg-local-map" style="height:460px;width:100%;border-radius:10px;overflow:hidden;border:1px solid var(--border-soft);"></div>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
          <button type="button" class="btn btn-sm btn-primary" id="pg-map-confirm">Confirmar local no mapa</button>
          <button type="button" class="btn btn-sm btn-ghost" id="pg-map-cancel">Fechar mapa</button>
        </div>
      </div>
    </div>
    <div class="field"><label>Anexos do programador</label>
      <input type="file" id="pg-anexos-input" accept="image/*" multiple>
      <div class="field-hint">Imagens para a equipe visualizar (croqui, localização, detalhe do serviço). Também saem no RDO. A programação só pode ser salva depois que todas as imagens terminarem de enviar.</div>
      <div id="pg-anexos-preview">${anexosGridHtml(anexos, true)}</div>
      <div id="pg-anexos-progress" style="display:none;margin-top:8px;">
        <div id="pg-anexos-progress-text" style="font-size:11px;color:var(--muted);margin-bottom:4px;">Enviando…</div>
        <div style="height:6px;background:var(--panel-2);border-radius:3px;overflow:hidden;"><div id="pg-anexos-progress-fill" style="height:100%;width:0%;background:var(--accent);transition:width .2s;"></div></div>
      </div>
    </div>
    <div class="field"><label>Orientações do Setor de Planejamento</label>
      <textarea name="orientacoesPlanejamento" rows="3" placeholder="Orientação de execução, restrições, pontos de atenção para a equipe de campo...">${esc(pg?.orientacoesPlanejamento||'')}</textarea>
    </div>
    ${renderCustomFieldsInputs('programacoes', pg)}
    <div class="field"><label>Equipes e atividades <span class="req">*</span></label>
      <div id="atribs-container">${renderAtribsHtml()}</div>
      <button type="button" class="btn btn-sm" id="add-atrib-btn" style="margin-top:6px;align-self:flex-start;">${icon('plus',13)} Adicionar equipe</button>
    </div>`;

  openModal({
    title: pg? 'Editar programação' : 'Nova programação', bodyHtml: baseFieldsHtml, extraWide: true, submitLabel: pg? 'Salvar alterações':'Programar',
    onMount:(root)=>{
      bindCicloMasks(root);
      const projSel = root.querySelector('#pg-projeto');
      function applyProjetoData(){
        const pr = projSel.value? findProjeto(Number(projSel.value)) : null;
        selProjeto = pr;
        root.querySelector('#pg-setor').value = pr?.setor||'';
        root.querySelector('#pg-coord').value = pr?.coordenacao||'';
        root.querySelector('#pg-ciclo').value = pr?.ciclo? cicloMask(pr.ciclo) : '';
        refreshContainer();
      }
      projSel.addEventListener('change', applyProjetoData);
      applyProjetoData();
      function refreshContainer(){
        const ok = equipesDoProjeto(selProjeto);
        atribs.forEach(a=>{ if(a.equipeId && !ok.some(e=>String(e.id)===String(a.equipeId))) a.equipeId=''; });
        document.getElementById('atribs-container').innerHTML = renderAtribsHtml(); bindDynamic();
      }
      function atualizarMetaIndicadores(){
        root.querySelectorAll('.atrib-meta-live').forEach(el=>{
          const i = Number(el.dataset.idx);
          const a = atribs[i];
          const eq = a && a.equipeId? findEquipe(a.equipeId) : null;
          const meta = metaDiaria(eq);
          const total = (a?.atividades||[]).reduce((s,at)=>{
            const atDef = at.atividadeId? findAtividade(at.atividadeId) : null;
            return s + (parseFloat(at.quantidadePrevista)||0) * (atDef?.valorUnitario||0);
          },0);
          if(!eq){ el.innerHTML=''; return; }
          if(!meta){
            el.innerHTML = `<div class="atrib-meta-wrap"><span style="font-size:11px;color:var(--muted);">Programação total: <strong>${fmtMoney(total)}</strong> (meta diária não definida para esta equipe)</span></div>`;
            return;
          }
          const pct = Math.round(total/meta*100);
          const cor = pct>=100? 'var(--green)' : pct>=50? 'var(--accent)' : 'var(--red)';
          el.innerHTML = `<div class="atrib-meta-wrap">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
              <strong style="font-size:11px;letter-spacing:.02em;">PROGRAMAÇÃO EM <span style="color:${cor};">${pct}%</span> DA META DA EQUIPE</strong>
              <span style="font-size:11px;color:var(--muted);">${fmtMoney(total)} de ${fmtMoney(meta)}</span>
            </div>
            <div class="atrib-meta-bar"><div style="width:${Math.min(100,pct)}%;background:${cor};"></div></div>
          </div>`;
        });
      }
      function bindDynamic(){
        root.querySelectorAll('.atrib-equipe').forEach(s=>s.addEventListener('change', e=>{ atribs[e.target.dataset.idx].equipeId = e.target.value; atualizarMetaIndicadores(); }));
        root.querySelectorAll('.atrib-remove').forEach(b=>b.addEventListener('click', e=>{ atribs.splice(Number(e.currentTarget.dataset.idx),1); refreshContainer(); }));
        root.querySelectorAll('.atrib-add-activity').forEach(b=>b.addEventListener('click', e=>{ atribs[Number(e.currentTarget.dataset.idx)].atividades.push({atividadeId:'',quantidadePrevista:''}); refreshContainer(); }));
        root.querySelectorAll('.act-select').forEach(s=>s.addEventListener('change', e=>{ atribs[e.target.dataset.idx].atividades[e.target.dataset.jdx].atividadeId = e.target.value; atualizarMetaIndicadores(); }));
        root.querySelectorAll('.act-qty').forEach(s=>s.addEventListener('input', e=>{ atribs[e.target.dataset.idx].atividades[e.target.dataset.jdx].quantidadePrevista = e.target.value; atualizarMetaIndicadores(); }));
        root.querySelectorAll('.act-remove').forEach(b=>b.addEventListener('click', e=>{ const i=Number(e.currentTarget.dataset.idx), j=Number(e.currentTarget.dataset.jdx); atribs[i].atividades.splice(j,1); refreshContainer(); }));
        atualizarMetaIndicadores();
      }
      bindDynamic();
      document.getElementById('add-atrib-btn').addEventListener('click', ()=>{ atribs.push({equipeId:'',atividades:[{atividadeId:'',quantidadePrevista:''}]}); refreshContainer(); });
      const anexosPreview = root.querySelector('#pg-anexos-preview');
      const anexosInput = root.querySelector('#pg-anexos-input');
      const anexosProgress = root.querySelector('#pg-anexos-progress');
      const anexosProgressText = root.querySelector('#pg-anexos-progress-text');
      const anexosProgressFill = root.querySelector('#pg-anexos-progress-fill');
      function paintAnexos(){
        anexosPreview.innerHTML = anexosGridHtml(anexos, true);
        anexosPreview.querySelectorAll('.anexo-remove').forEach(b=>b.addEventListener('click', ()=>{
          anexos.splice(Number(b.dataset.i),1); paintAnexos();
        }));
      }
      anexosInput.addEventListener('change', async ()=>{
        const files = Array.from(anexosInput.files||[]);
        if(!files.length) return;
        const sobra = Math.max(0, 8 - anexos.length);
        const fila = files.slice(0, sobra);
        if(files.length > sobra) toast('Máximo de 8 anexos por programação.', 'error');
        if(!fila.length){ anexosInput.value=''; return; }
        anexosInput.disabled = true;
        anexosEnviando = true;
        const total = fila.length;
        let feitos = 0;
        const atualizar = ()=>{
          anexosProgressFill.style.width = Math.round(feitos/total*100)+'%';
          anexosProgressText.textContent = total>1? `Enviando ${Math.min(feitos+1,total)} de ${total}…` : 'Enviando…';
        };
        anexosProgress.style.display = 'block';
        paintAnexos();
        atualizar();
        await Promise.all(fila.map(async (f)=>{
          let url = '';
          try{
            const blob = await comprimirImagem(f);
            url = await uploadToImgbb(blob);
          }catch(e){ toast('Falha ao enviar a imagem '+esc(f.name)+' ('+e.message+'). Tente novamente.', 'error'); }
          if(url) anexos.push({ nome: f.name||('anexo-'+Date.now()), url, ts: Date.now() });
          else toast('Falha ao enviar '+esc(f.name), 'error');
          feitos++;
          atualizar();
          paintAnexos();
        }));
        anexosEnviando = false;
        anexosProgress.style.display = 'none';
        anexosInput.disabled = false; anexosInput.value='';
        paintAnexos();
      });
      paintAnexos();
      /* --- Local / mapa (Geoapify) --- */
      const localInput = root.querySelector('#pg-local');
      const localTools = root.querySelector('#pg-local-tools');
      const mapWrap = root.querySelector('#pg-map-wrap');
      const mapEl = root.querySelector('#pg-local-map');
      let localDeb = null;
      let localMap = null, localMarker = null, localPicked = null;
      function paintLocalTools(){
        const btn = `<button type="button" class="btn btn-sm" id="pg-map-pick-btn">${icon('pin',13)} Selecionar no mapa</button>`;
        if(!localAddr && localLat==null && localLng==null){ localTools.innerHTML = `<div style="margin-top:8px;">${btn}</div>`; return; }
        localTools.innerHTML = `
          <div style="margin-top:8px;display:flex;flex-direction:column;gap:8px;align-items:flex-start;">
            ${btn}
            <a href="${esc(localMapsHref(localAddr,localLat,localLng))}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;color:var(--blue);font-weight:600;font-size:12.5px;">${icon('pin',13)} Abrir no Google Maps</a>
            ${(localLat!=null && localLng!=null)? `<a href="${esc(staticMapUrl(localLat,localLng,15,640,320))}" target="_blank" rel="noopener" title="Clique para ampliar o mapa">${localThumbHtml(localAddr,localLat,localLng)}</a>`:''}
          </div>`;
      }
      async function geocodeLocal(addr){
        const g = await geoapifyGeocode(addr);
        if(String(addr).trim()!==String(localInput.value).trim()) return;
        if(!g){ localLat=null; localLng=null; paintLocalTools(); return; }
        localLat = g.lat; localLng = g.lng; localAddr = g.label; localInput.value = g.label;
        paintLocalTools();
      }
      localInput.addEventListener('input', ()=>{
        const val = localInput.value.trim();
        localAddr = val;
        clearTimeout(localDeb);
        localDeb = setTimeout(()=>{
          if(!val){ localLat=null; localLng=null; paintLocalTools(); return; }
          paintLocalTools();
          geocodeLocal(val);
        }, 700);
      });
      function initLocalMap(){
        if(localMap) return;
        loadLeaflet().then(L=>{
          const hasFix = (localLat!=null&&localLng!=null);
          const center = hasFix? [localLat, localLng] : [-17.79, -50.92];
          localMap = L.map(mapEl, { maxZoom:22, minZoom:2, zoomSnap:1, zoomControl:true, touchZoom:true, scrollWheelZoom:true, layers:[] }).setView(center, hasFix? 16 : 12);
          // 1) Satélite (Esri World Imagery) — gratuito, mundial, alta resolução, sem chave
          const satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 20,
            maxNativeZoom: 20,
            attribution:'Tiles © <a href="https://www.esri.com/">Esri</a> — Source: Esri, Maxar, Earthstar Geographics'
          });
          // 2) Cartográfico (OSM) — fallback global
          const osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            maxNativeZoom: 19,
            attribution:'© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          });
          // 3) Geoapify (cartográfico melhorado) — se a chave funcionar
          const geoLayer = L.tileLayer('https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}{r}.png?apiKey={apiKey}', {
            apiKey: MAPS_KEY,
            maxZoom: 20,
            maxNativeZoom: 20,
            tileSize: 256,
            attribution:'Powered by <a href="https://www.geoapify.com/">Geoapify</a> | <a href="https://openmaptiles.org/">© OpenMapTiles</a> <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>'
          });
          // Adiciona satélite como base padrão
          satLayer.addTo(localMap);
          // Controle de camadas para o usuário escolher
          L.control.layers({
            'Satélite (Esri)': satLayer,
            'Cartográfico (OSM)': osmLayer,
            'Cartográfico (Geoapify)': geoLayer
          }, null, {collapsed:false, position:'topright'}).addTo(localMap);
          function placeMarker(pos){
            if(localMarker){ localMarker.setLatLng(pos); }
            else { localMarker = L.marker(pos, {draggable:true, riseOnHover:true}).addTo(localMap); localMarker.on('dragend', ()=>{ localPicked = localMarker.getLatLng(); }); }
            const z = localMap.getZoom();
            if(z < 16) localMap.setView(pos, 16); else localMap.panTo(pos);
          }
          if(hasFix) placeMarker([localLat, localLng]);
          localMap.on('click', e=>{ localPicked = e.latlng; placeMarker(e.latlng); });
          setTimeout(()=>{ localMap.invalidateSize(); }, 60);
        }).catch(()=>{ toast('Não foi possível carregar o mapa.', 'error'); mapWrap.style.display='none'; });
      }
      localTools.addEventListener('click', e=>{
        if(!e.target.closest('#pg-map-pick-btn')) return;
        mapWrap.style.display='block';
        if(!localMap) initLocalMap();
        else setTimeout(()=>{ localMap.invalidateSize(); }, 60);
      });
      root.querySelector('#pg-map-confirm').addEventListener('click', async ()=>{
        if(!localPicked){ toast('Clique no mapa para posicionar o marcador.', 'error'); return; }
        const lat = localPicked.lat, lng = localPicked.lng;
        const addr = await geoapifyReverse(lat, lng);
        localLat = lat; localLng = lng;
        if(addr){ localAddr = addr; localInput.value = addr; }
        else { localAddr = localInput.value.trim()||'Ponto marcado no mapa'; }
        mapWrap.style.display='none';
        paintLocalTools();
        toast('Local marcado no mapa.');
      });
      root.querySelector('#pg-map-cancel').addEventListener('click', ()=>{ mapWrap.style.display='none'; });
      paintLocalTools();
    },
    onSubmit:(fd)=>{
      if(anexosEnviando){ toast('Aguarde o envio das imagens dos anexos antes de salvar.', 'error'); return false; }
      const ciclo = cicloMask(fd.get('ciclo'));
      if(!isCicloValido(ciclo)){ toast('Informe o ciclo recebido no formato CICLO-XX/XXXX (ex.: CICLO-01/2026).', 'error'); return false; }
      if(!atribs.length || atribs.some(a=>!a.equipeId)){ toast('Selecione a equipe em todos os blocos.', 'error'); return false; }
      for(const a of atribs){ if(!a.atividades.length || a.atividades.some(x=>!x.atividadeId)){ toast('Selecione a atividade em todas as linhas.', 'error'); return false; } }
      const dataBase = fd.get('dataProgramada'); const projetoId = Number(fd.get('projetoId')); const observacoes = fd.get('observacoes').trim();
      const orientacoesPlanejamento = String(fd.get('orientacoesPlanejamento')||'').trim();
      const custom = parseCustomFieldsFromForm('programacoes', fd);
      const local = String(fd.get('local')||'').trim()||localAddr||'';
      const locLat = local? localLat : null;
      const locLng = local? localLng : null;
      if(pg){
        const dataBaseAntiga = pg.dataProgramada;
        pg.projetoId = projetoId; pg.dataProgramada = dataBase; pg.ciclo = ciclo; pg.observacoes = observacoes; pg.orientacoesPlanejamento = orientacoesPlanejamento; pg.custom = custom; pg.anexos = anexos; pg.local = local; pg.localLat = locLat; pg.localLng = locLng;
        const oldAtribs = pg.atribuicoes;
        pg.atribuicoes = atribs.map(a=>{
          const existing = oldAtribs.find(old => String(old.equipeId)===String(a.equipeId));
          const novasAtividades = a.atividades.map(x=>({atividadeId:Number(x.atividadeId), quantidadePrevista: x.quantidadePrevista?parseFloat(x.quantidadePrevista):null, quantidadeExecutada: existing? (existing.atividades.find(y=>y.atividadeId===Number(x.atividadeId))?.quantidadeExecutada ?? null) : null}));
          if(existing){ if(existing.dataProgramada===dataBaseAntiga) existing.dataProgramada = dataBase; existing.atividades = novasAtividades; return existing; }
          return { id: nextId(), equipeId:Number(a.equipeId), dataProgramada: dataBase, status:'Programado', atividades: novasAtividades, historico:[{...currentAutor(), ts:Date.now(),tipo:'criacao',de:null,para:'Programado',motivo:'Atribuição adicionada à programação'}] };
        });
        toast('Programação atualizada.');
        registrarEvento('edicao','programacao',pg.id,progGid(pg), (pg.atribuicoes||[]).length+' equipe(s), '+pg.atribuicoes.reduce((s,a)=>s+(a.atividades?.length||0),0)+' atividade(s), '+anexos.length+' anexo(s)');
      } else {
        const novaProg = { id: nextId(), gid: novoGid(), projetoId, dataProgramada: dataBase, ciclo, observacoes, orientacoesPlanejamento, custom, anexos, local, localLat: locLat, localLng: locLng,
          atribuicoes: atribs.map(a=> ({ id: nextId(), equipeId:Number(a.equipeId), dataProgramada: dataBase, status:'Programado',
            atividades: a.atividades.map(x=>({atividadeId:Number(x.atividadeId), quantidadePrevista:x.quantidadePrevista?parseFloat(x.quantidadePrevista):null, quantidadeExecutada:null})),
            historico:[{...currentAutor(), ts:Date.now(),tipo:'criacao',de:null,para:'Programado',motivo:'Programação criada'}] })) };
        DB.programacoes.push(novaProg); toast('Programação criada.');
        registrarEvento('criacao','programacao',novaProg.id,progGid(novaProg), novaProg.atribuicoes.length+' equipe(s), '+novaProg.atribuicoes.reduce((s,a)=>s+(a.atividades?.length||0),0)+' atividade(s), '+anexos.length+' anexo(s)');
      }
      saveData(); renderContent(); renderBanner();
    }
  });
}

function openReprogramarManual(pgId, atId){
  openReprogramarConfirmacao(atId);
}
    function openReprogramarConfirmacao(atribId, novaDataPrefill){
      if(!requerEscrita()) return;
      const atrib = findAtribuicaoGlobal(atribId);
  if(!atrib) return;
  if(['Concluído','Cancelado'].includes(atrib.status)){ toast('Não é possível reprogramar um item concluído ou cancelado.', 'error'); return; }
  const eq = findEquipe(atrib.equipeId);
  const body = `
    <div style="font-size:12.5px;color:var(--muted);margin-bottom:4px;">Equipe ${equipeLabel(eq)}</div>
    <div class="field"><label>Data atual</label><input type="text" value="${fmtDate(atrib.dataProgramada)}" disabled></div>
    <div class="field"><label>Nova data <span class="req">*</span></label><input type="date" name="novaData" required value="${novaDataPrefill||atrib.dataProgramada}"></div>
    <div class="field"><label>Motivo da reprogramação <span class="req">*</span></label><select name="motivo" required><option value="">Selecione…</option>${MOTIVOS_REPROG.map(m=>`<option>${m}</option>`).join('')}</select></div>
    <div class="field"><label>Observações <span class="req">*</span></label><textarea name="obs" required placeholder="Descreva o motivo e as observações da reprogramação"></textarea></div>
  `;
  openModal({
    title:'Reprogramar programação', bodyHtml: body, submitLabel:'Confirmar reprogramação',
    onSubmit:(fd)=>{
      const novaData = fd.get('novaData'); const motivo = fd.get('motivo'); const obs = fd.get('obs').trim();
      if(!motivo){ toast('Selecione o motivo da reprogramação.', 'error'); return false; }
      if(!obs){ toast('Informe a observação da reprogramação.', 'error'); return false; }
      const dataAntiga = atrib.dataProgramada;
      atrib.dataProgramada = novaData; atrib.status = 'Reprogramado';
      atrib.historico = atrib.historico||[];
        atrib.historico.push({...currentAutor(), ts:Date.now(), tipo:'reprogramacao', de:dataAntiga, para:novaData, motivo, obs});
        const pgY = progDaAtribuicao(atrib.id);
        registrarEvento('reprogramacao','atribuicao',atrib.id, (pgY? progGid(pgY)+' · ': '')+equipeLabel(findEquipe(atrib.equipeId)), fmtDate(dataAntiga)+' → '+fmtDate(novaData)+' · '+motivo+(obs? ' · '+obs:''));
        saveData(); renderContent(); renderBanner(); toast('Programação reprogramada.');
    }
  });
}

/* =========================================================
   DOCUMENTO DE CAMPO (impressão / PDF)
========================================================= */
function equipePageUrl(progId){
  let base = location.href.split(/[?#]/)[0];
  base = base.replace(/[\\/]index\.html$/i, '');
  if(base && !base.endsWith('/')) base += '/';
  return base + 'team.html?equipe=' + progId;
}

/* ── WHATSAPP ── */
const WHATS_SUPORTE = '556496151084';
function phoneDigits(p){ return String(p||'').replace(/\D/g,''); }
function waLink(phone, text){ return 'https://wa.me/' + phoneDigits(phone) + '?text=' + encodeURIComponent(text); }

/* =========================================================
   LOCAL DE EXECUÇÃO — Geoapify (mapa, geocodificação e imagem)
========================================================= */
const MAPS_KEY = 'cb9a3186df512370a0b85db130ca34d1';
function mapsLinkByAddress(addr){ return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(String(addr||'').trim()); }
function mapsLinkByCoords(lat,lng){ return 'https://www.google.com/maps/search/?api=1&query='+Number(lat)+','+Number(lng); }
function staticMapUrl(lat,lng,zoom,w,h){
  const z = zoom||16, width = w||640, height = h||360;
  return `https://maps.geoapify.com/v1/staticmap?style=osm-bright-smooth&width=${width}&height=${height}&center=lonlat:${Number(lng)},${Number(lat)}&zoom=${z}&scaleFactor=2&marker=lonlat:${Number(lng)},${Number(lat)};type:material;color:%23e02020;size:normal&apiKey=${MAPS_KEY}`;
}
function staticMapFallbackUrl(lat,lng,zoom,w,h){
  const z = zoom||16, width = w||640, height = h||360;
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${Number(lat)},${Number(lng)}&zoom=${z}&size=${width}x${height}&markers=${Number(lat)},${Number(lng)},red-pushpin`;
}
function staticMapImgTag(lat,lng,zoom,w,h,alt,style){
  const geo = staticMapUrl(lat,lng,zoom,w,h);
  const fb = staticMapFallbackUrl(lat,lng,zoom,w,h);
  return `<img src="${esc(geo)}" alt="${esc(alt||'Mapa')}" style="${esc(style||'width:100%;max-width:520px;border-radius:8px;border:1px solid var(--border-soft);display:block;')}" onerror="this.onerror=null; this.src='${esc(fb)}';">`;
}
async function geoapifyGeocode(addr){
  if(!String(addr||'').trim()) return null;
  try{
    const res = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(addr)}&apiKey=${MAPS_KEY}&limit=1&format=json`);
    if(!res.ok) return null;
    const j = await res.json();
    const f = j && j.features && j.features[0];
    if(!f) return null;
    const p = f.properties||{};
    return { lat:Number(f.lat??p.lat), lng:Number(f.lon??p.lon), label: p.formatted||String(addr) };
  }catch(e){ return null; }
}
async function geoapifyReverse(lat,lng){
  try{
    const res = await fetch(`https://api.geoapify.com/v1/geocode/reverse?lat=${Number(lat)}&lon=${Number(lng)}&apiKey=${MAPS_KEY}&limit=1&format=json`);
    if(!res.ok) return '';
    const j = await res.json();
    const p = j && j.features && j.features[0] && j.features[0].properties;
    return (p && p.formatted)||'';
  }catch(e){ return ''; }
}
function localMapsHref(local, lat, lng){
  if(lat!=null && lng!=null) return mapsLinkByCoords(lat,lng);
  return mapsLinkByAddress(local);
}
function qrCodeUrl(data, size=120){
  return 'https://api.qrserver.com/v1/create-qr-code/?size='+size+'x'+size+'&data='+encodeURIComponent(data);
}
function localThumbHtml(local, lat, lng){
  if(lat==null || lng==null) return '';
  return staticMapImgTag(lat,lng,17,640,320, 'Mapa: '+(local||''), 'width:100%;max-width:520px;border-radius:8px;border:1px solid var(--border-soft);display:block;');
}
let _leafletLoaded = null;
function loadLeaflet(){
  if(_leafletLoaded) return _leafletLoaded;
  if(window.L){ _leafletLoaded = Promise.resolve(window.L); return _leafletLoaded; }
  _leafletLoaded = new Promise((resolve,reject)=>{
    const link = document.createElement('link');
    link.rel='stylesheet'; link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const sc = document.createElement('script');
    sc.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    sc.onload = ()=> resolve(window.L);
    sc.onerror = ()=> reject(new Error('Falha ao carregar o mapa'));
    document.head.appendChild(sc);
  });
  return _leafletLoaded;
}
function localWhatsLine(local, lat, lng){
  if(!local && (lat==null || lng==null)) return '';
  if(lat!=null && lng!=null){
    return [`*Local:* ${local||'Ponto marcado no mapa'}`,`*Ver no mapa:* ${mapsLinkByCoords(lat,lng)}`,`*Imagem da localização:* ${staticMapUrl(lat,lng,15,640,360)}`];
  }
  return [`*Local:* ${local}`,`*Ver no mapa:* ${mapsLinkByAddress(local)}`];
}
function buildWhatsMessage(prog, atrib){
  const pr = findProjeto(prog.projetoId);
  const eq = findEquipe(atrib.equipeId);
  const ativs = (atrib.atividades||[]).map((a,i)=>{
    const at = findAtividade(a.atividadeId);
    return `${i+1}. *${at?.codigo||'?'}* · ${at?.descricao||''} — ${a.quantidadePrevista??'—'} ${at?.unidade||''}`;
  }).join('\n');
  return [
    `*G26 PLANNER · Programação de Redes Elétricas*`,
    ``,
    `*Programação:* ${progGid(prog)}`,
    `*Projeto:* ${pr?.nome||'—'} (${pr?.codigo||''})`,
    `*Setor:* ${pr?.setor||'—'}  ·  *Coordenação:* ${pr?.coordenacao||'—'}`,
    `*Data:* ${fmtDate(atrib.dataProgramada)}  ·  *Ciclo:* ${prog.ciclo||'—'}`,
    `*Equipe:* ${equipeLabel(eq)}`,
    ``,
    ...localWhatsLine(prog.local, prog.localLat, prog.localLng),
    ``,
    `*Atividades programadas:*`,
    ativs||'—',
    ``,
    `*Supervisor:* ${eq?.supervisor||'—'}`,
    `*Encarregado:* ${eq?.encarregado||'—'}  ·  *Motorista:* ${eq?.motorista||'—'}`,
    ``,
    `*Acesso da equipe (QR):*`,
    equipePageUrl(prog.id),
    ``,
    `_Caso tenha problemas técnicos com a ferramenta, entre em contato:_`,
    `https://wa.me/${WHATS_SUPORTE}`
  ].join('\n');
}
function encaminharWhats(progId){
  const prog = DB.programacoes.find(p=>p.id===Number(progId));
  if(!prog) return;
  const teams = (prog.atribuicoes||[]).filter(a=>a.status!=='Cancelado');
  if(!teams.length) return;
  const semWhats = [];
  let enviadas = 0;
  teams.forEach(atrib=>{
    const eq = findEquipe(atrib.equipeId);
    if(!eq?.whatsapp || !phoneDigits(eq.whatsapp)){ semWhats.push(equipeLabel(eq)); return; }
    window.open(waLink(eq.whatsapp, buildWhatsMessage(prog, atrib)), '_blank');
    enviadas++;
  });
  if(semWhats.length){
    toast('Sem WhatsApp cadastrado para: '+semWhats.join(', ')+'. Edite a equipe e informe o número.', 'error');
  }else{
    toast(enviadas>1? `Mensagem encaminhada para ${enviadas} equipes.` : 'Mensagem encaminhada para a equipe.');
  }
  registrarEvento('compartilhamento','programacao',prog.id,progGid(prog), 'Encaminhado via WhatsApp para '+(enviadas>0? enviadas+' equipe(s)':'nenhuma equipe')+(semWhats.length? ' · sem WhatsApp: '+semWhats.join(', '):''));
}
function qrSvgHtml(url, cellSize){
  if(typeof qrcode==='undefined' || !url) return '';
  try{
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    return qr.createSvgTag(cellSize||3, 2);
  }catch(e){ return ''; }
}
function printDocumento(html){
  const root = document.getElementById('print-root');
  root.innerHTML = `<div class="print-sheet">${html}</div>`;
  const imgs = root.querySelectorAll('img');
  if(!imgs.length){ window.print(); return; }
  let pendentes = 0, impresso = false;
  const tentar = ()=>{
    pendentes--;
    if(pendentes<=0 && !impresso){ impresso = true; window.print(); }
  };
  imgs.forEach(img=>{
    pendentes++;
    img.addEventListener('load', tentar, {once:true});
    img.addEventListener('error', tentar, {once:true});
  });
  setTimeout(()=>{ if(!impresso){ impresso = true; window.print(); } }, 1500);
}
function printProjeto(id){
  const pj = findProjeto(id);
  if(!pj){ toast('Projeto não encontrado.', 'error'); return; }
  printDocumento(buildDocProjeto(pj));
}
function buildDocProjeto(pj){
  const av = projetoAvanco(pj);
  const programacoes = DB.programacoes.filter(p=>p.projetoId===pj.id);
  const countProg = programacoes.length;
  const countEquipes = programacoes.reduce((s,pg)=>s+(pg.atribuicoes?.length||0),0);
  const totalAtividades = programacoes.reduce((s,pg)=>s+pg.atribuicoes.reduce((t,a)=>t+(a.atividades?.length||0),0),0);
  const qrUrl = location.origin + location.pathname.replace(/\/[^/]*$/,'') + '/team.html?projeto=' + pj.id;
  const statusColors = {'Aguardando Viabilidade':'#2563eb','Em Andamento':'#f59e0b','Concluído':'#16a34a','Encerrado':'#6b7280','Cancelado':'#dc2626'};
  const statusColor = statusColors[pj.status]||'#6b7280';
  const diasVencimento = pj.dataVencimento ? diasEntre(todayISO(), pj.dataVencimento) : null;
  const diasViabilidade = pj.dataRecebimentoCarteira && !pj.dataViabilizacao ? diasEntre(todayISO(), prazoViabilidadeProjeto(pj)) : null;
  const alertaVenc = (diasVencimento!=null && diasVencimento<0) ? `VENCIDO há ${-diasVencimento} dia(s)` : (diasVencimento!=null && diasVencimento===0 ? 'Vence hoje' : (diasVencimento!=null && diasVencimento<=5 ? `Vence em ${diasVencimento} dia(s)` : ''));
  const alertaViab = (diasViabilidade!=null && diasViabilidade<0) ? `VIABILIDADE ATRASADA ${-diasViabilidade} dia(s)` : (diasViabilidade!=null && diasViabilidade<=5 ? `Viabilizar em ${diasViabilidade} dia(s)` : '');
  const plano = pj.planoFisico||[];
  const rowsPlano = plano.map((x,idx)=>{
    const at = findAtividade(x.atividadeId);
    return `<tr><td style="text-align:center;">${idx+1}</td><td class="mono" style="font-weight:700;">${esc(at?.codigo||'?')}</td><td>${esc(at?.descricao||'')}</td><td style="text-align:center;">${esc(at?.unidade||'')}</td><td style="text-align:center;">${x.quantidade??'—'}</td></tr>`;
  }).join('') || '<tr><td colspan="5" style="text-align:center;color:#666;padding:12px;">Nenhuma atividade no plano físico</td></tr>';
  const rowsProg = programacoes.map(pg=>{
    const atrCount = pg.atribuicoes?.length||0;
    const atvCount = pg.atribuicoes.reduce((s,a)=>s+(a.atividades?.length||0),0);
    const eqLabels = pg.atribuicoes.map(a=>equipeLabel(findEquipe(a.equipeId))).join(', ')||'—';
    return `<tr><td>${esc(progGid(pg))}</td><td>${fmtDate(pg.dataProgramada)}</td><td>${esc(pg.ciclo||'—')}</td><td>${atrCount}</td><td>${atvCount}</td><td>${esc(eqLabels)}</td><td>${progStatusBadge(pg.status)}</td></tr>`;
  }).join('') || '<tr><td colspan="7" style="text-align:center;color:#666;padding:12px;">Nenhuma programação vinculada</td></tr>';
  const customFields = DB.customFields.projetos||[];
  const customRows = customFields.map(f=>`<tr><th>${esc(f.label)}</th><td colspan="3">${esc(pj.custom?.[f.id]||'—')}</td></tr>`).join('');
  return `
  <div class="ps-head" style="display:grid;grid-template-columns:280px 1fr;gap:16px;align-items:start;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:14px;">
    <div style="border:2px solid ${statusColor};border-radius:8px;padding:12px;background:${statusColor}15;">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:${statusColor};font-weight:700;margin-bottom:6px;">STATUS DO PROJETO</div>
      <div style="font-size:14px;font-weight:700;color:${statusColor};">${pj.status}</div>
      ${alertaVenc? `<div style="margin-top:8px;padding:6px 8px;background:#fef2f2;border:1px solid #fecaca;border-radius:4px;font-size:11px;color:#991b1b;">${icon('alert',12)} ${alertaVenc}</div>`:''}
      ${alertaViab? `<div style="margin-top:8px;padding:6px 8px;background:#fffbeb;border:1px solid #fde68a;border-radius:4px;font-size:11px;color:#92400e;">${icon('alert',12)} ${alertaViab}</div>`:''}
      <div style="margin-top:10px;border-top:1px solid ${statusColor}40;padding-top:10px;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#666;margin-bottom:4px;">AÇÕES DISPONÍVEIS</div>
        <ul style="margin:0;padding-left:16px;font-size:11px;line-height:1.8;color:#333;">
          <li>${pj.status==='Aguardando Viabilidade'? 'Viabilizar projeto (preencha data de viabilização)' : pj.status==='Em Andamento'? 'Criar programações, acompanhar avanço' : pj.status==='Concluído'? 'Encerrar projeto' : '—'}</li>
          <li>Imprimir / exportar PDF deste relatório</li>
          <li>Ver programações vinculadas</li>
          <li>${pj.status!=='Encerrado' && pj.status!=='Cancelado'? 'Editar dados do projeto' : 'Projeto finalizado'}</li>
        </ul>
      </div>
    </div>
    <div>
      <h1 style="margin:0;font-size:18px;font-weight:700;color:#000;">${esc(pj.codigo)} · ${esc(pj.nome)}</h1>
      <div style="margin-top:4px;font-size:12px;color:#333;">${esc(pj.descricao||'')}</div>
      <div style="display:flex;gap:24px;margin-top:10px;font-size:11px;color:#444;flex-wrap:wrap;">
        <div><strong>Setor/Coord.:</strong> ${esc(pj.setor||'—')} / ${esc(pj.coordenacao||'—')}</div>
        <div><strong>Cidade:</strong> ${esc(pj.cidade||'—')}</div>
        <div><strong>Ciclo:</strong> ${esc(pj.ciclo||'—')}</div>
        <div><strong>Período:</strong> ${fmtDate(pj.dataInicio)} → ${fmtDate(pj.dataFim||'—')}</div>
        <div><strong>Receb. carteira:</strong> ${fmtDate(pj.dataRecebimentoCarteira)}${pj.dataViabilizacao? ` · Viabilizado: ${fmtDate(pj.dataViabilizacao)}` : ''}</div>
        <div><strong>Vencimento:</strong> ${fmtDate(pj.dataVencimento||'—')}</div>
        <div><strong>Orçado:</strong> ${fmtMoney(pj.valorOrcado||0)}</div>
      </div>
      <div style="margin-top:10px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <div class="ps-qr" style="flex-shrink:0;">${qrSvgHtml(qrUrl, 3)}<div class="ps-qr-cap">Escaneie para ver detalhes</div></div>
        <div style="font-size:10px;color:#666;max-width:280px;">Link do projeto: ${esc(qrUrl)}</div>
      </div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px;">
    <div class="ps-block" style="break-inside:avoid;">
      <div class="ps-block-head">AVANÇO FÍSICO / FINANCEIRO</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div style="border:1px solid #ddd;border-radius:6px;padding:10px;background:#fafafa;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#666;margin-bottom:4px;">FÍSICO</div>
          <div style="font-size:22px;font-weight:700;color:${av.fisicoPct>=100?'#16a34a':av.fisicoPct>=80?'#f59e0b':'#2563eb'};">${av.fisicoPct.toFixed(1)}%</div>
          <div style="font-size:10.5px;color:#666;margin-top:2px;">${av.concluidoLinhas}/${av.totalLinhas} linhas concluídas</div>
        </div>
        <div style="border:1px solid #ddd;border-radius:6px;padding:10px;background:#fafafa;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#666;margin-bottom:4px;">FINANCEIRO</div>
          <div style="font-size:22px;font-weight:700;color:${av.financeiroPct>=100?'#16a34a':av.financeiroPct>=80?'#f59e0b':'#2563eb'};">${av.financeiroPct.toFixed(1)}%</div>
          <div style="font-size:10.5px;color:#666;margin-top:2px;">Executado: ${fmtMoney(av.financeiroExecutado)} / ${fmtMoney(pj.valorOrcado||0)}</div>
        </div>
      </div>
    </div>
    <div class="ps-block" style="break-inside:avoid;">
      <div class="ps-block-head">RESUMO DE PROGRAMAÇÕES</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:11px;text-align:center;">
        <div style="border:1px solid #ddd;border-radius:6px;padding:8px;background:#f0f9ff;"><div style="font-size:20px;font-weight:700;color:#2563eb;">${countProg}</div><div style="font-size:10px;color:#666;">Programações</div></div>
        <div style="border:1px solid #ddd;border-radius:6px;padding:8px;background:#f0fdf4;"><div style="font-size:20px;font-weight:700;color:#16a34a;">${countEquipes}</div><div style="font-size:10px;color:#666;">Equipes</div></div>
        <div style="border:1px solid #ddd;border-radius:6px;padding:8px;background:#fef3c7;"><div style="font-size:20px;font-weight:700;color:#f59e0b;">${totalAtividades}</div><div style="font-size:10px;color:#666;">Atividades</div></div>
      </div>
    </div>
  </div>
  <div class="ps-block" style="break-inside:avoid;margin-bottom:14px;">
    <div class="ps-block-head">PLANO FÍSICO — ATIVIDADES PREVISTAS</div>
    <table style="width:100%;border-collapse:collapse;font-size:10.5px;">
      <thead><tr style="background:#f4f4f4;"><th style="width:30px;border:1px solid #444;padding:4px;">#</th><th style="width:70px;border:1px solid #444;padding:4px;">Código</th><th style="border:1px solid #444;padding:4px;">Descrição</th><th style="width:50px;border:1px solid #444;padding:4px;">Unid.</th><th style="width:60px;border:1px solid #444;padding:4px;">Qtd.</th></tr></thead>
      <tbody>${rowsPlano}</tbody>
    </table>
  </div>
  ${programacoes.length? `
  <div class="ps-block" style="break-inside:avoid;margin-bottom:14px;">
    <div class="ps-block-head">PROGRAMAÇÕES VINCULADAS</div>
    <table style="width:100%;border-collapse:collapse;font-size:10px;">
      <thead><tr style="background:#f4f4f4;"><th style="border:1px solid #444;padding:4px;">GID</th><th style="border:1px solid #444;padding:4px;">Data</th><th style="border:1px solid #444;padding:4px;">Ciclo</th><th style="width:50px;border:1px solid #444;padding:4px;">Eqps</th><th style="width:50px;border:1px solid #444;padding:4px;">Atvs</th><th style="border:1px solid #444;padding:4px;">Equipes</th><th style="border:1px solid #444;padding:4px;">Status</th></tr></thead>
      <tbody>${rowsProg}</tbody>
    </table>
  </div>`:''}
  ${customRows? `
  <div class="ps-block" style="break-inside:avoid;margin-bottom:14px;">
    <div class="ps-block-head">CAMPOS PERSONALIZADOS</div>
    <table style="width:100%;border-collapse:collapse;font-size:10.5px;">
      <tbody>${customRows}</tbody>
    </table>
  </div>`:''}
  <div style="margin-top:10px;font-size:10.5px;color:#000;border-top:1px solid #444;padding-top:6px;display:flex;justify-content:space-between;">
    <div>Assinatura do responsável: <span class="ps-line" style="width:260px;"></span></div>
    <div>Data: ____/____/____</div>
  </div>`;
}
function docAtribuicaoHtml(prog, atrib){
  const pr = findProjeto(prog.projetoId);
  const eq = findEquipe(atrib.equipeId);
  const rows = atrib.atividades.map((a,idx)=>{
    const at = findAtividade(a.atividadeId);
    return `<tr>
      <td style="text-align:center;">${idx+1}</td>
      <td class="mono" style="font-weight:700;">${esc(at?.codigo||'?')}</td>
      <td>${esc(at?.descricao||'')}</td>
      <td style="text-align:center;">${esc(at?.unidade||'')}</td>
      <td style="text-align:center;">${a.quantidadePrevista??'—'}</td>
      <td style="height:22px;"></td>
      <td></td>
    </tr>`;
  }).join('');
  const qrUrl = equipePageUrl(prog.id);
  return `
  <div class="ps-block">
    <div class="ps-block-head">
      <div>${progGid(prog)} — ${esc(pr?.nome||'Projeto')} (${esc(pr?.codigo||'')}) — ${equipeLabel(eq)} — ${fmtDate(atrib.dataProgramada)}</div>
      <div class="ps-qr">${qrSvgHtml(qrUrl, 3)}<div class="ps-qr-cap">Escaneie para alterar as atividades</div></div>
    </div>
    <table class="ps-info">
      <tr><th>Supervisor</th><td>${esc(eq?.supervisor||'—')}</td><th>Encarregado</th><td>${esc(eq?.encarregado||'—')}</td></tr>
      <tr><th>Motorista</th><td>${esc(eq?.motorista||'—')}</td><th>Eletricistas</th><td>${esc((eq?.eletricistas||[]).filter(Boolean).join(', ')||'—')}</td></tr>
      ${prog.local? `<tr><th>Local de execução</th><td colspan="3"><strong>${esc(prog.local)}</strong>${(prog.localLat!=null&&prog.localLng!=null)? ` — <a href="${esc(mapsLinkByCoords(prog.localLat,prog.localLng))}">${esc(mapsLinkByCoords(prog.localLat,prog.localLng))}</a>`:''}</td></tr>`:''}
    </table>
    <table>
      <thead><tr><th style="width:26px;">#</th><th>Código</th><th>Descrição</th><th style="width:40px;">Un.</th><th style="width:52px;">Qtd prev.</th><th style="width:64px;">Qtd exec.</th><th>Obs.</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="ps-check"><div><strong>Executou?</strong> &nbsp;☐ SIM &nbsp;☐ NÃO &nbsp;☐ PARCIAL</div><div><strong>Data da execução:</strong> ____/____/____</div></div>
    <div class="ps-sign"><strong>Observações do campo:</strong><div class="ps-obs"></div></div>
    <div class="ps-sign"><strong>Assinatura do encarregado:</strong> <span class="ps-line"></span></div>
  </div>`;
}
function buildDocProgramacao(prog){
  const pr = findProjeto(prog.projetoId);
  return `
    <div class="ps-head">
      <div><h1>G26 Planner · Programação de Redes Elétricas</h1><div class="ps-sub">Documento de campo — programação</div></div>
      <div style="text-align:right;"><div style="font-size:14px;font-weight:700;">${fmtDate(prog.dataProgramada)}</div><div class="ps-sub">Emissão: ${fmtDateTime(Date.now())}</div></div>
    </div>
    <table class="ps-info">
      <tr><th>Programação</th><td><strong>${progGid(prog)}</strong></td><th>Emissão</th><td>${fmtDateTime(Date.now())}</td></tr>
      <tr><th>Projeto</th><td colspan="3"><strong>${esc(pr?.nome||'—')}</strong> (${esc(pr?.codigo||'')})</td></tr>
      <tr><th>Setor</th><td>${esc(pr?.setor||'—')}</td><th>Coordenação</th><td>${esc(pr?.coordenacao||'—')}</td></tr>
      <tr><th>Ciclo</th><td>${esc(prog.ciclo||'—')}</td><th>Valor orçado</th><td>${fmtMoney(pr?.valorOrcado||0)}</td></tr>
      <tr><th>Período do projeto</th><td colspan="3">${fmtDate(pr?.dataInicio)} → ${fmtDate(pr?.dataFim)}</td></tr>
      ${prog.observacoes? `<tr><th>Observações gerais</th><td colspan="3">${esc(prog.observacoes)}</td></tr>`:''}
      ${String(prog.orientacoesPlanejamento||'').trim()? `<tr><th>Orientações do Setor de Planejamento</th><td colspan="3">${esc(prog.orientacoesPlanejamento)}</td></tr>`:''}
      ${prog.local? `<tr><th>Local de execução</th><td colspan="3"><strong>${esc(prog.local)}</strong>${(prog.localLat!=null&&prog.localLng!=null)? ` — <a href="${esc(mapsLinkByCoords(prog.localLat,prog.localLng))}">${esc(mapsLinkByCoords(prog.localLat,prog.localLng))}</a>`:(prog.local? ` — <a href="${esc(mapsLinkByAddress(prog.local))}">${esc(mapsLinkByAddress(prog.local))}</a>`:'')}</td></tr>`:''}
    </table>
    ${prog.atribuicoes.map(at=> docAtribuicaoHtml(prog, at)).join('')}
    ${(prog.localLat!=null&&prog.localLng!=null)? `<div class="ps-block" style="page-break-before:auto;break-before:auto;margin-top:8px;">
      <div class="ps-block-head">Localização no mapa — ${progGid(prog)}</div>
      ${staticMapImgTag(prog.localLat,prog.localLng,16,720,420, 'Mapa: '+(prog.local||''), 'width:100%;max-width:620px;border:1px solid #999;border-radius:4px;')}
      <div style="margin-top:8px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <img src="${esc(qrCodeUrl(mapsLinkByCoords(prog.localLat,prog.localLng), 100))}" alt="QR Code localização" style="width:100px;height:100px;border:1px solid #999;border-radius:4px;">
        <div style="font-size:11px;color:#333;"><strong>Escaneie para abrir no Google Maps</strong><br>${esc(mapsLinkByCoords(prog.localLat,prog.localLng))}</div>
      </div>
    </div>`:''}
    <div style="margin-top:8px;font-size:10.5px;color:#000;border-top:1px solid #444;padding-top:6px;">Assinatura do fiscal / responsável: <span class="ps-line"></span> &nbsp;&nbsp; Data: ____/____/____</div>
    ${docAnexosHtml(prog)}
  `;
}
function docAnexosHtml(prog){
  const anexos = prog.anexos||[];
  if(!anexos.length) return '';
  return `
  <div class="ps-block" style="page-break-before:always;break-before:page;">
    <div class="ps-block-head">Anexos do programador — ${progGid(prog)}</div>
    <div class="ps-anexos">
      ${anexos.map(a=>`<figure class="ps-anexo"><img src="${esc(anexoSrc(a))}" alt="${esc(a.nome||'anexo')}"><figcaption>${esc(a.nome||'')}</figcaption></figure>`).join('')}
    </div>
    <div class="ps-sign"><strong>Assinatura do encarregado:</strong> <span class="ps-line"></span></div>
  </div>`;
}
function buildDocData(data, list){
  return `
    <div class="ps-head">
      <div><h1>G26 Planner · Programação de Redes Elétricas</h1><div class="ps-sub">Documento de campo — ${fmtDate(data)}</div></div>
      <div style="text-align:right;"><div style="font-size:14px;font-weight:700;">${fmtDate(data)}</div><div class="ps-sub">${list.length} equipe(s) programada(s)</div></div>
    </div>
    ${list.map(x=> docAtribuicaoHtml(x.programacao, x.atribuicao)).join('')}
    <div style="margin-top:8px;font-size:10.5px;color:#000;border-top:1px solid #444;padding-top:6px;">Assinatura do fiscal / responsável: <span class="ps-line"></span> &nbsp;&nbsp; Data: ____/____/____</div>
  `;
}
function openDocumentoDataModal(){
  const body = `
    <div class="field"><label>Data <span class="req">*</span></label><input type="date" name="data" required value="${todayISO()}"></div>
    <div class="field-hint">Gera um documento de campo com todas as equipes programadas nesta data, para imprimir e preencher em campo.</div>`;
  openModal({
    title:'Documento de campo — por data', bodyHtml:body, submitLabel:'Gerar e imprimir',
    onSubmit:(fd)=>{
      const data = fd.get('data');
      if(!data){ toast('Informe a data.', 'error'); return false; }
      const list = flatAtribuicoes().filter(x=> x.atribuicao.dataProgramada===data && x.atribuicao.status!=='Cancelado');
      if(!list.length){ toast('Nenhuma programação nesta data.', 'error'); return false; }
      printDocumento(buildDocData(data, list));
    }
  });
}
function openDocProgramacao(pgId){
  const prog = DB.programacoes.find(p=>p.id===Number(pgId));
  if(!prog) return;
  printDocumento(buildDocProgramacao(prog));
}

/* =========================================================
   HISTÓRICO
========================================================= */
function globalHistorico(){
  const events = [];
  flatAtribuicoes().forEach(x=> (x.atribuicao.historico||[]).forEach(h=> events.push({...h, atribId:x.atribuicao.id, projetoId:x.programacao.projetoId, equipeId:x.atribuicao.equipeId})));
  return events.sort((a,b)=> b.ts - a.ts);
}
const HIST_TIPOS = [{v:'',l:'Todos os eventos'},{v:'criacao',l:'Criação'},{v:'status',l:'Mudança de status'},{v:'reprogramacao',l:'Reprogramação'},{v:'confirmacao',l:'Confirmação de execução'},{v:'equipe',l:'Alteração da equipe'},{v:'rdo_edicao',l:'Edição de RDO'}];
function renderHistorico(){
  const el = document.getElementById('content');
  const minTs = histFilters.dataDe? new Date(histFilters.dataDe+'T00:00:00').getTime() : (histFilters.ultimasHs? Date.now()-histFilters.ultimasHs*3600e3 : -Infinity);
  const maxTs = histFilters.dataAte? new Date(histFilters.dataAte+'T23:59:59').getTime() : Infinity;
  const events = globalHistorico().filter(h=>{
    if(histFilters.tipo && h.tipo!==histFilters.tipo) return false;
    if(histFilters.projeto && String(h.projetoId)!==histFilters.projeto) return false;
    if(h.ts < minTs || h.ts > maxTs) return false;
    return true;
  });
  const janela = histFilters.ultimasHs? `últimas ${histFilters.ultimasHs}h` : (histFilters.dataDe||histFilters.dataAte? `de ${histFilters.dataDe||'…'} a ${histFilters.dataAte||'…'}` : 'tudo');
  el.innerHTML = `
    <div class="panel-head" style="padding:0;margin-bottom:16px;border:none;">
      <div class="filters">
        <select id="f-h-tipo">${HIST_TIPOS.map(t=>`<option value="${t.v}" ${histFilters.tipo===t.v?'selected':''}>${t.l}</option>`).join('')}</select>
        <select id="f-h-projeto"><option value="">Todos os projetos</option>${projetosVisiveis().map(p=>`<option value="${p.id}" ${histFilters.projeto==String(p.id)?'selected':''}>${esc(p.nome)}</option>`).join('')}</select>
        <input type="date" id="f-h-data-de" value="${histFilters.dataDe}" title="Data inicial">
        <span style="color:var(--muted);font-size:12px;">até</span>
        <input type="date" id="f-h-data-ate" value="${histFilters.dataAte}" title="Data final">
        <button class="btn btn-sm" id="f-h-12h" title="Últimas 12 horas">12h</button>
        <button class="btn btn-sm" id="f-h-24h" title="Últimas 24 horas">24h</button>
        <button class="btn btn-sm" id="f-h-7d" title="Últimos 7 dias">7 dias</button>
        <button class="btn btn-sm" id="f-h-mes-atual" title="Filtrar pelo mês vigente">Mês atual</button>
        <button class="btn btn-sm btn-ghost" id="f-h-limpar-datas" title="Remover filtros e mostrar tudo">Tudo</button>
      </div>
      <span style="font-size:12px;color:var(--muted);">${events.length} eventos · ${janela}</span>
    </div>
    ${events.length? `<div class="panel">${renderHistoricoTimeline(events, true)}</div>` : `<div class="panel"><div class="empty-state">${icon('empty',34)}<p>Nenhum evento encontrado com os filtros.</p></div></div>`}`;
  document.getElementById('f-h-tipo').addEventListener('change', e=>{ histFilters.tipo=e.target.value; renderContent(); });
  document.getElementById('f-h-projeto').addEventListener('change', e=>{ histFilters.projeto=e.target.value; renderContent(); });
  document.getElementById('f-h-data-de').addEventListener('change', e=>{ histFilters.dataDe=e.target.value; histFilters.ultimasHs=0; renderContent(); });
  document.getElementById('f-h-data-ate').addEventListener('change', e=>{ histFilters.dataAte=e.target.value; histFilters.ultimasHs=0; renderContent(); });
  document.getElementById('f-h-12h').addEventListener('click', ()=>{ histFilters.ultimasHs=12; histFilters.dataDe=''; histFilters.dataAte=''; renderContent(); });
  document.getElementById('f-h-24h').addEventListener('click', ()=>{ histFilters.ultimasHs=24; histFilters.dataDe=''; histFilters.dataAte=''; renderContent(); });
  document.getElementById('f-h-7d').addEventListener('click', ()=>{ histFilters.ultimasHs=168; histFilters.dataDe=''; histFilters.dataAte=''; renderContent(); });
  document.getElementById('f-h-mes-atual').addEventListener('click', ()=>{ const r=monthRangeISO(); histFilters.ultimasHs=0; histFilters.dataDe=r.de; histFilters.dataAte=r.ate; renderContent(); });
  document.getElementById('f-h-limpar-datas').addEventListener('click', ()=>{ histFilters.ultimasHs=0; histFilters.dataDe=''; histFilters.dataAte=''; renderContent(); });
  el.querySelectorAll('[data-open-atrib]').forEach(r=>r.addEventListener('click', ()=>openAtribDetalhe(r.dataset.openAtrib)));
}
function renderHistoricoTimeline(events, withContext){
  if(!events.length) return `<div style="padding:24px;color:var(--muted-2);font-size:12.5px;">Sem eventos recentes.</div>`;
  return `<div class="timeline">${events.map(h=>{
    let atrib=null, pg=null;
    for(const p of DB.programacoes){ const f=(p.atribuicoes||[]).find(a=>a.id===h.atribId); if(f){ atrib=f; pg=p; break; } }
    const eq = atrib? findEquipe(atrib.equipeId) : null;
    let dotColor='var(--muted)', title='';
    if(h.tipo==='criacao'){ dotColor='var(--blue)'; title='Programação criada'; }
    else if(h.tipo==='status'){ dotColor=STATUS_COLOR[h.para]||'var(--muted)'; title=`Status alterado: ${h.de} → ${h.para}`; }
    else if(h.tipo==='reprogramacao'){ dotColor='var(--purple)'; title=`Reprogramada: ${fmtDate(h.de)} → ${fmtDate(h.para)}`; }
    else if(h.tipo==='confirmacao'){ dotColor='var(--green)'; title='Execução confirmada'; }
    else if(h.tipo==='equipe'){ dotColor='var(--accent)'; title='Atividades alteradas pela equipe'; }
    else if(h.tipo==='rdo_edicao'){ dotColor='var(--purple)'; title='Registro RDO editado'; }
    const ctx = withContext && pg ? `<div class="tl-meta">${esc(findProjeto(pg.projetoId)?.nome||'')} · Equipe ${equipeLabel(eq)}</div>` : '';
    return `<div class="tl-item ${withContext?'clickable':''}" ${withContext?`data-open-atrib="${h.atribId}"`:''} style="--dot-c:${dotColor}"><div class="tl-title">${title}</div><div class="tl-meta">${fmtDateTime(h.ts)} · <strong style="color:var(--muted);">${autor(h)}</strong></div>${ctx}${h.motivo? `<div class="tl-motivo"><strong>Motivo:</strong> ${esc(h.motivo)}${h.obs? ' — '+esc(h.obs):''}</div>`:''}</div>`;
  }).join('')}</div>`;
}
function openHistoricoModal(atribId){
  atribId = Number(atribId);
  let atrib;
  for(const p of DB.programacoes){ const f=(p.atribuicoes||[]).find(a=>a.id===atribId); if(f){ atrib=f; break; } }
  if(!atrib) return;
  const body = renderHistoricoTimeline([...(atrib.historico||[])].map(h=>({...h,atribId})).sort((a,b)=>b.ts-a.ts));
  openModal({ title:'Histórico', bodyHtml:body, submitLabel:'Fechar', onSubmit:()=>true, wide:true });
}

/* =========================================================
   ADMINISTRAÇÃO — campos personalizados
========================================================= */
let adminModulo = 'equipes';
function renderAdmin(){
  const el = document.getElementById('content');
  el.innerHTML = `
    ${monPanelHtml()}
    <div class="tabs" style="margin-bottom:16px;">${MODULOS_ADMIN.map(m=>`<button class="tab ${adminModulo===m.k?'active':''}" data-mod="${m.k}">${m.l}</button>`).join('')}</div>
    <div class="panel" style="margin-bottom:16px;">
      <div class="panel-head">
        <div><h3>Usuários e níveis de acesso</h3><div class="admin-field-meta">Crie usuários e defina o papel e o nível de acesso de cada um.</div></div>
        <button class="btn btn-primary btn-sm" id="btn-novo-usuario">${icon('plus',13)} Novo usuário</button>
      </div>
      <div id="admin-users-list"></div>
    </div>
    <div class="panel">
      <div class="panel-head"><h3>Campos personalizados — ${MODULOS_ADMIN.find(m=>m.k===adminModulo).l}</h3></div>
      <div id="admin-fields-list"></div>
      <div class="admin-add-form">
        <div class="field-row">
          <div class="field"><label>Nome do campo</label><input type="text" id="new-field-label" placeholder="Ex: Contrato"></div>
          <div class="field"><label>Tipo</label><select id="new-field-type">${CUSTOM_FIELD_TYPES.map(t=>`<option value="${t.v}">${t.l}</option>`).join('')}</select></div>
        </div>
        <div class="field" id="new-field-opts-wrap" style="display:none;"><label>Opções (separadas por vírgula)</label><input type="text" id="new-field-opts" placeholder="Opção 1, Opção 2, Opção 3"></div>
        <button class="btn btn-primary btn-sm" id="add-field-btn" style="align-self:flex-start;">${icon('plus',13)} Adicionar campo</button>
      </div>
    </div>
    <div class="panel" style="margin-top:24px;">
      <div class="panel-head"><h3>Respostas RDO - Saída da Base</h3></div>
      <div id="admin-rdo-list"></div>
    </div>`;
  el.querySelectorAll('[data-mod]').forEach(b=>b.addEventListener('click', ()=>{ adminModulo=b.dataset.mod; renderAdmin(); }));
  bindMonPanel();
  paintAdminUsersList();
  document.getElementById('btn-novo-usuario').addEventListener('click', ()=>openUsuarioModal());
  paintAdminFieldsList();
  document.getElementById('new-field-type').addEventListener('change', e=>{ document.getElementById('new-field-opts-wrap').style.display = e.target.value==='select'? 'block':'none'; });
  document.getElementById('add-field-btn').addEventListener('click', ()=>{
    const label = document.getElementById('new-field-label').value.trim();
    const tipo = document.getElementById('new-field-type').value;
    const opts = document.getElementById('new-field-opts').value.split(',').map(s=>s.trim()).filter(Boolean);
    if(!label){ toast('Informe o nome do campo.', 'error'); return; }
    DB.customFields[adminModulo].push({ id: nextId(), label, tipo, opcoes: tipo==='select'? opts: [] });
    registrarEvento('config','sistema',null,'Campo personalizado', 'Campo "'+label+'" adicionado no módulo '+adminModulo);
    saveData(); toast('Campo adicionado.'); renderAdmin();
  });
  paintAdminRdoList();
}
function paintAdminUsersList(){
  const wrap = document.getElementById('admin-users-list');
  const users = DB.usuarios||[];
  wrap.innerHTML = users.length? users.map(u=>`
    <div class="admin-field-row">
      <div>
        <strong>${esc(u.nome)}</strong>
        <div class="admin-field-meta">${esc(u.login)} · ${roleLabel(u.role)} · ${nivelLabel(u.nivel)}${u.setor||u.coordenacao? ' · '+esc([u.setor,u.coordenacao].filter(Boolean).join(' / ')):''}${u.ativo?'':' · Inativo'}</div>
      </div>
      <div class="row-actions">
        <button class="icon-btn" data-edit-user="${u.id}">${icon('edit',14)}</button>
        <button class="icon-btn" data-del-user="${u.id}">${icon('trash',14)}</button>
      </div>
    </div>`).join('') : `<div style="padding:20px;color:var(--muted-2);font-size:12.5px;">Nenhum usuário cadastrado. Clique em "Novo usuário" para começar.</div>`;
  wrap.querySelectorAll('[data-edit-user]').forEach(b=>b.addEventListener('click', ()=>openUsuarioModal(b.dataset.editUser)));
  wrap.querySelectorAll('[data-del-user]').forEach(b=>b.addEventListener('click', ()=>deleteUsuario(b.dataset.delUser)));
}
    function openUsuarioModal(id){
      if(!requerEscrita()) return;
      const u = id ? (DB.usuarios||[]).find(x=>x.id===Number(id)) : null;
  const body = `
    <div class="field"><label>Nome <span class="req">*</span></label><input type="text" name="nome" required value="${esc(u?.nome||'')}" placeholder="Nome do usuário"></div>
    <div class="field"><label>Login <span class="req">*</span></label><input type="text" name="login" required value="${esc(u?.login||'')}" placeholder="Ex: jose.silva"></div>
    <div class="field"><label>Senha <span class="req">*</span></label><input type="password" name="senha" ${u? '': 'required'} value="" placeholder="${u? 'Deixe em branco para manter a atual':'Defina uma senha'}"></div>
    <div class="field"><label>Papel (role) <span class="req">*</span></label><select name="role" required><option value="">Selecione…</option>${ROLES.map(r=>`<option value="${r.v}" ${u?.role===r.v?'selected':''}>${r.l} — ${r.d}</option>`).join('')}</select></div>
    <div class="field"><label>Nível de acesso <span class="req">*</span></label><select name="nivel" required><option value="">Selecione…</option>${NIVEIS_ACESSO.map(n=>`<option value="${n.v}" ${u?.nivel===n.v?'selected':''}>${n.l} — ${n.d}</option>`).join('')}</select></div>
    <div class="field-row">
      <div class="field"><label>Setor</label><select name="setor"><option value="">Todos</option><option ${u?.setor==='MANUTENÇÃO'?'selected':''}>MANUTENÇÃO</option><option ${u?.setor==='OBRAS'?'selected':''}>OBRAS</option></select><div class="field-hint">Programadores só veem dados deste setor. Vazio = todos.</div></div>
      <div class="field"><label>Coordenação</label><select name="coordenacao"><option value="">Todas</option><option ${u?.coordenacao==='RIO VERDE'?'selected':''}>RIO VERDE</option><option ${u?.coordenacao==='QUIRINOPOLIS'?'selected':''}>QUIRINOPOLIS</option></select><div class="field-hint">Programadores só veem dados desta coordenação. Vazio = todas.</div></div>
    </div>
    <div class="field" style="flex-direction:row;align-items:center;gap:8px;"><input type="checkbox" name="ativo" id="u-ativo" style="width:auto;" ${u? (u.ativo?'checked':'') : 'checked'}><label for="u-ativo" style="margin:0;">Usuário ativo</label></div>
  `;
  openModal({
    title: u? 'Editar usuário' : 'Novo usuário', bodyHtml: body, submitLabel: u? 'Salvar alterações':'Criar usuário',
    onSubmit:(fd)=>{
      const nome = fd.get('nome').trim(), login = fd.get('login').trim(), role = fd.get('role'), nivel = fd.get('nivel');
      const senha = fd.get('senha');
      if(!nome || !login){ toast('Informe nome e login.', 'error'); return false; }
      if(!role){ toast('Selecione o papel do usuário.', 'error'); return false; }
      if(!nivel){ toast('Selecione o nível de acesso.', 'error'); return false; }
      if(!u && !senha){ toast('Defina uma senha.', 'error'); return false; }
      if(DB.usuarios.some(x=>x.login.toLowerCase()===login.toLowerCase() && String(x.id)!==String(u?.id))){ toast('Já existe um usuário com este login.', 'error'); return false; }
      const data = { nome, login, role, nivel, setor: fd.get('setor')||'', coordenacao: fd.get('coordenacao')||'', ativo: fd.get('ativo')==='on' };
      if(senha) data.senha = senha;
      if(u){ Object.assign(u, data); toast('Usuário atualizado.'); registrarEvento('edicao','usuario',u.id,u.login,'Usuário atualizado · papel '+roleLabel(u.role)); }
      else { data.id = nextId(); data.senha = senha; DB.usuarios.push(data); toast('Usuário criado.'); registrarEvento('criacao','usuario',data.id,data.login,'Usuário criado · '+roleLabel(data.role)); }
      saveData(); renderContent();
    }
  });
}
function deleteUsuario(id){
  const u = (DB.usuarios||[]).find(x=>x.id===Number(id));
  if(!u) return;
  if(u.role==='administrador' && (DB.usuarios||[]).filter(x=>x.role==='administrador' && x.ativo).length<=1){ toast('Deve existir ao menos um administrador ativo.', 'error'); return; }
  if(!confirm('Excluir o usuário "'+u.nome+'"?')) return;
  registrarEvento('exclusao','usuario',u.id,u.login,'Usuário excluído · '+roleLabel(u.role));
  DB.usuarios = DB.usuarios.filter(x=>x.id!==Number(id)); saveData(); renderContent(); toast('Usuário excluído.');
}
function paintAdminFieldsList(){
  const list = DB.customFields[adminModulo]||[];
  const wrap = document.getElementById('admin-fields-list');
  wrap.innerHTML = list.length? list.map(f=>`
    <div class="admin-field-row">
      <div><strong>${esc(f.label)}</strong><div class="admin-field-meta">${CUSTOM_FIELD_TYPES.find(t=>t.v===f.tipo)?.l||f.tipo}${f.tipo==='select'? ' · '+esc((f.opcoes||[]).join(', ')):''}</div></div>
      <button class="icon-btn" data-del-field="${f.id}">${icon('trash',14)}</button>
    </div>`).join('') : `<div style="padding:20px;color:var(--muted-2);font-size:12.5px;">Nenhum campo personalizado neste módulo ainda.</div>`;
  wrap.querySelectorAll('[data-del-field]').forEach(b=>b.addEventListener('click', ()=>{
    if(!confirm('Remover este campo? Os valores já preenchidos serão mantidos ocultos.')) return;
    const f = DB.customFields[adminModulo].find(f=>f.id===Number(b.dataset.delField));
    DB.customFields[adminModulo] = DB.customFields[adminModulo].filter(f=>f.id!==Number(b.dataset.delField));
    registrarEvento('config','sistema',null,'Campo personalizado', 'Campo "'+(f?.label||'')+'" removido do módulo '+adminModulo);
    saveData(); renderAdmin();
  }));
}
function paintAdminRdoList(){
  const wrap = document.getElementById('admin-rdo-list');
  const rdoEntries = [];
  (DB.programacoes||[]).forEach(pg=>{
    (pg.atribuicoes||[]).forEach(at=>{
      const rdo = at.rdoRespostas||{};
      rdoEntries.push({ programacao: pg, atribuicao: at, respostas: rdo });
    });
  });
  if(!rdoEntries.length){
    wrap.innerHTML = `<div style="padding:20px;color:var(--muted-2);font-size:12.5px;">Nenhuma resposta RDO registrada ainda. As equipes devem completar o RDO na página da equipe.</div>`;
    return;
  }
  wrap.innerHTML = rdoEntries.map(entry=>`
    <div class="admin-field-row" style="border-bottom:1px solid var(--border); padding-bottom:24px; margin-bottom:24px;">
      <div style="font-weight:700;font-size:14px;color:var(--dark);margin-bottom:8px;">
        Programação ${progGid(entry.prog)} - ${entry.prog.atribuicoes.map(a=>String(a.equipeId)).join(', ')} ${entry.atribuicao.status||'Programado'}
      </div>
      <div style="margin-bottom:16px;">
        <h4>Dados da Programação</h4>
        <p><strong>Data programada:</strong> ${fmtDate(entry.prog.dataProgramada)}</p>
        <p><strong>Ciclo:</strong> ${entry.prog.ciclo||'—'}</p>
        <p><strong>Projeto:</strong> ${entry.prog.projetoId ? (DB.projetos||[]).find(p=>p.id===entry.prog.projetoId)?.nome||'—' : '—'}</p>
        <p><strong>Local de execução:</strong> ${entry.prog.local? esc(entry.prog.local) : '—'}${entry.prog.local||entry.prog.localLat!=null? ` <a href="${esc(localMapsHref(entry.prog.local,entry.prog.localLat,entry.prog.localLng))}" target="_blank" rel="noopener" style="color:var(--blue);font-weight:600;font-size:12px;">${icon('pin',11)} Ver no Google Maps</a>`:''}</p>
        ${(entry.prog.localLat!=null && entry.prog.localLng!=null)? `<a href="${esc(staticMapUrl(entry.prog.localLat,entry.prog.localLng,17,800,360))}" target="_blank" rel="noopener" style="display:inline-block;max-width:480px;">${localThumbHtml(entry.prog.local,entry.prog.localLat,entry.prog.localLng)}</a>`:''}
      </div>
      <div style="margin-bottom:16px;">
        <h4>Respostas RDO</h4>
        <table style="width:100%;border-collapse:collapse;">
          ${RDO_QUESTIONS.map(q=>`
            <tr style="margin-bottom:8px;">
              <td style="width:40%;font-weight:600;padding-right:16px;">${q.label}</td>
              <td style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;min-width:200px;background:rgba(87,199,199,.08);">
                ${String(entry.respostas[q.id])||'-- não respondido --'}
              </td>
            </tr>`).join('')}
        </table>
      </div>
      <div style="margin-bottom:16px;">
        <h4>Horários</h4>
        <table style="width:100%;border-collapse:collapse;">
          ${RDO_HORARIOS.map(h=>`
            <tr><td style="font-weight:600;padding-right:16px;">${h.label}</td><td style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;">${entry.atribuicao[h.k]||'--'}</td></tr>`).join('')}
        </table>
      </div>
      <div style="margin-bottom:16px;">
        <h4>Condições Climáticas e Impedimentos</h4>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="font-weight:600;padding-right:16px;">Condições climáticas</td><td style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;">${entry.atribuicao.rdoCondicoes||'--'}</td></tr>
          <tr><td style="font-weight:600;padding-right:16px;">Impedimento execução (somente se sim)</td><td style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;">${entry.atribuicao.rdoImpedimento||'--'}</td></tr>
          <tr><td style="font-weight:600;padding-right:16px;">Falta de material</td><td style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;">${entry.atribuicao.rdoFaltaMaterial||'--'}</td></tr>
          <tr><td style="font-weight:600;padding-right:16px;">Projeto Incoerente</td><td style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;">${entry.atribuicao.rdoProjetoIncoerente||'--'}</td></tr>
          <tr><td style="font-weight:600;padding-right:16px;">Equipe incompleta</td><td style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;">${entry.atribuicao.rdoEquipeIncompleta||'--'}</td></tr>
          <tr><td style="font-weight:600;padding-right:16px;">Falta de veículo</td><td style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;">${entry.atribuicao.rdoFaltaVeiculo||'--'}</td></tr>
          <tr><td style="font-weight:600;padding-right:16px;">Impedimento de acesso</td><td style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;">${entry.atribuicao.rdoImpedimentoAcesso||'--'}</td></tr>
          <tr><td style="font-weight:600;padding-right:16px;">Licença ambiental</td><td style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;">${entry.atribuicao.rdoLicencaAmbiental||'--'}</td></tr>
          <tr><td style="font-weight:600;padding-right:16px;">Autorização/embargo</td><td style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;">${entry.atribuicao.rdoAutorizacaoEmbargo||'--'}</td></tr>
          <tr><td style="font-weight:600;padding-right:16px;">Desligamento conforme programado</td><td style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;">${entry.atribuicao.rdoDesligamento||'--'}</td></tr>
        </table>
      </div>
    </div>`).join('');
}

/* =========================================================
   EMPTY STATE
========================================================= */
function emptyState(title, sub){
  return `<div class="panel"><div class="empty-state">${icon('empty',36)}<h3 style="margin-bottom:6px;">${title}</h3><p>${sub}</p><button class="btn btn-primary" id="empty-cta" style="margin-top:16px;">${icon('plus',15)} Adicionar</button></div></div>`;
}
function bindEmptyCta(el, fn){ const b = el.querySelector('#empty-cta'); if(b) b.addEventListener('click', fn); }

/* =========================================================
   BACKUP
========================================================= */
document.getElementById('btn-backup').addEventListener('click', ()=>{
  const choice = confirm('Clique OK para EXPORTAR os dados (baixar backup). Clique Cancelar para IMPORTAR um arquivo de backup.');
  if(choice){
    const blob = new Blob([JSON.stringify(DB, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `g26_planner_backup_${todayISO()}.json`; a.click(); URL.revokeObjectURL(url);
    toast('Backup exportado.');
  } else { document.getElementById('import-file').click(); }
});
document.getElementById('import-file').addEventListener('change', (e)=>{
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev)=>{
    try{
      const parsed = JSON.parse(ev.target.result);
      if(!confirm('Importar substituirá TODOS os dados atuais. Continuar?')) return;
      DB = Object.assign(structuredClone(DEFAULT_DATA), parsed);
      DB.customFields = Object.assign(structuredClone(DEFAULT_DATA.customFields), parsed.customFields||{});
      migrarGids();
      saveData(); setView(currentView); toast('Dados importados com sucesso.');
    }catch(err){ toast('Arquivo inválido.', 'error'); }
  };
  reader.readAsText(file); e.target.value='';
});

/* =========================================================
   ROUTER
========================================================= */
function renderContent(){
  const map = { dashboard: renderDashboard, alertas: renderAlertas, equipes: renderEquipes, atividades: renderAtividades, projetos: renderProjetos, avanco: renderAvanco, programacoes: renderProgramacoes, historico: renderHistorico, admin: renderAdmin, RDO: renderProgramacoesConcluidas };
  (map[currentView]||renderDashboard)();
}

/* =========================================================
   SEED
========================================================= */
function seedIfEmpty(){
  if(DB.equipes.length || DB.atividades.length || DB.projetos.length) return;
  DB.usuarios = DB.usuarios||[];
  DB.usuarios.push({id:nextId(), nome:'Mestre', login:'1', senha:'1', role:'administrador', nivel:'total', ativo:true});
  const eq1 = {id:nextId(), eqtl:'Equipe Alfa', prtn:'', setor:'MANUTENÇÃO', coordenacao:'RIO VERDE', supervisor:'Marcos Lima', encarregado:'José Ferreira', motorista:'Paulo Souza', metaDiaria:5000, eletricistas:['Carlos Alves','Renato Dias'], ativo:true, custom:{}};
  const eq2 = {id:nextId(), eqtl:'', prtn:'Equipe Bravo', setor:'MANUTENÇÃO', coordenacao:'RIO VERDE', supervisor:'Ana Ribeiro', encarregado:'Bruno Castro', motorista:'Diego Nunes', metaDiaria:3000, eletricistas:['Felipe Rocha'], ativo:true, custom:{}};
  DB.equipes.push(eq1, eq2);
  const a1 = {id:nextId(), codigo:'MAN-014', descricao:'Substituição de poste de concreto', unidade:'un', valorUnitario:850, fav:true, custom:{}};
  const a2 = {id:nextId(), codigo:'MAN-022', descricao:'Poda de árvore próxima à rede', unidade:'un', valorUnitario:180, custom:{}};
  const a3 = {id:nextId(), codigo:'CON-005', descricao:'Instalação de rede de baixa tensão', unidade:'m', valorUnitario:42.5, custom:{}};
  DB.atividades.push(a1,a2,a3);
  const p1 = {id:nextId(), codigo:'PRJ-2026-01', nome:'Manutenção preventiva - Setor Leste', descricao:'Ronda de manutenção preventiva na rede do setor leste.', dataInicio:todayISO(), dataFim:'', dataRecebimentoCarteira:shiftISO(todayISO(), -10), dataVencimento:shiftISO(todayISO(), 60), dataViabilizacao:'', setor:'MANUTENÇÃO', coordenacao:'RIO VERDE', cidade:'Rio Verde', status:'Em Andamento', valorOrcado:60000, ciclo:'CICLO-01/2026', planoFisico:[{atividadeId:a1.id, quantidade:6},{atividadeId:a2.id, quantidade:12},{atividadeId:a3.id, quantidade:150}], custom:{}};
  DB.projetos.push(p1);
  const prog1 = { id:nextId(), projetoId:p1.id, dataProgramada:todayISO(), ciclo:'CICLO-01/2026', observacoes:'', custom:{},
    atribuicoes:[
      { id:nextId(), equipeId:eq1.id, dataProgramada:todayISO(), status:'Programado', atividades:[{atividadeId:a1.id, quantidadePrevista:3, quantidadeExecutada:null}], historico:[{...currentAutor(), usuarioNome:'Sistema', usuarioLogin:'', ts:Date.now(), tipo:'criacao', de:null, para:'Programado', motivo:'Programação criada (exemplo)'}] },
      { id:nextId(), equipeId:eq2.id, dataProgramada:todayISO(), status:'Programado', atividades:[{atividadeId:a2.id, quantidadePrevista:8, quantidadeExecutada:null},{atividadeId:a3.id, quantidadePrevista:120, quantidadeExecutada:null}], historico:[{...currentAutor(), usuarioNome:'Sistema', usuarioLogin:'', ts:Date.now(), tipo:'criacao', de:null, para:'Programado', motivo:'Programação criada (exemplo)'}] }
    ]};
  DB.programacoes.push(prog1);
  migrarGids();
  saveData();
}

/* =========================================================
   AUTENTICAÇÃO / LOGIN
========================================================= */
function garantirMaster(){
  DB.usuarios = DB.usuarios||[];
  if(!DB.usuarios.some(u=> String(u.login)==='1' && String(u.senha)==='1')){
    DB.usuarios.push({id:nextId(), nome:'Mestre', login:'1', senha:'1', role:'administrador', nivel:'total', ativo:true});
    saveData();
  }
}
function podeEditar(){ return !CURRENT_USER || CURRENT_USER.nivel!=='leitura'; }
function requerEscrita(){ if(podeEditar()) return true; toast('Seu usuário tem acesso somente leitura.', 'error'); return false; }
function ehMestre(){ return !!(CURRENT_USER && String(CURRENT_USER.login)==='1'); }
function usuarioRestrito(){ return !!(CURRENT_USER && CURRENT_USER.role==='supervisor' && CURRENT_USER.nivel==='programacao'); }
function projetoVisivel(p){ return !usuarioRestrito() || (p.setor===CURRENT_USER.setor && p.coordenacao===CURRENT_USER.coordenacao); }
function projetosVisiveis(){ return DB.projetos.filter(projetoVisivel); }
function programacoesVisiveis(){ const vis = projetosVisiveis().map(p=>p.id); return DB.programacoes.filter(pg=> vis.includes(pg.projetoId)); }
function equipesVisiveis(){ return usuarioRestrito()? DB.equipes.filter(e=> e.setor===CURRENT_USER.setor && e.coordenacao===CURRENT_USER.coordenacao) : DB.equipes; }
function equipesDoProjeto(pr){
  if(!pr || !pr.setor || !pr.coordenacao) return equipesVisiveis();
  return equipesVisiveis().filter(e=> !e.setor || !e.coordenacao || (e.setor===pr.setor && e.coordenacao===pr.coordenacao));
}
function novoGid(){ return 'G26-' + String(Math.floor(1000000 + Math.random()*9000000)); }
function progGid(pg){ return (pg && pg.gid) || (pg? 'G26-'+String(pg.id).padStart(7,'0') : ''); }

/* =========================================================
   MONITORAMENTO — auditoria (passado) + presença (presente)
========================================================= */
const MON_TIPOS = {
  login:{l:'Login',c:'var(--blue)'},
  logout:{l:'Logout',c:'var(--muted)'},
  criacao:{l:'Criação',c:'var(--green)'},
  edicao:{l:'Edição',c:'var(--accent)'},
  exclusao:{l:'Exclusão',c:'var(--red)'},
  status:{l:'Status',c:'var(--purple)'},
  reprogramacao:{l:'Reprogramação',c:'var(--red)'},
  rdo:{l:'RDO',c:'var(--teal)'},
  compartilhamento:{l:'Compartilhamento',c:'var(--green)'},
  config:{l:'Configuração',c:'var(--muted)'}
};
const MON_ITEMTIPOS = {
  programacao:'Programação', atribuicao:'Equipe/atividade', equipe:'Equipe', projeto:'Projeto', atividade:'Atividade', usuario:'Usuário', sistema:'Sistema'
};
let monPresenca = {};
let monPresList = [];
let monHeartbeat = null;
function registrarEvento(tipo, itemTipo, itemId, itemRotulo, detalhe){
  if(!CURRENT_USER || !tipo) return;
  DB.auditoria = DB.auditoria||[];
  DB.auditoria.push({
    id: nextId(), ts: Date.now(), user: CURRENT_USER.login, nome: CURRENT_USER.nome,
    tipo, itemTipo, itemId: itemId!=null? itemId : null,
    itemRotulo: String(itemRotulo||'').slice(0,120),
    detalhe: String(detalhe||'').slice(0,400),
    bytes: Math.round(JSON.stringify(DB).length/1024)
  });
  if(DB.auditoria.length > 4000) DB.auditoria = DB.auditoria.slice(-4000);
}
function fmtRelTempo(ts){
  if(!ts) return '—';
  const s = Math.max(0, Math.round((Date.now()-ts)/1000));
  if(s<60) return s+'s';
  if(s<3600) return Math.floor(s/60)+'min';
  if(s<86400) return Math.floor(s/3600)+'h';
  return Math.floor(s/86400)+'d';
}
function monViewLabel(v){ return (NAV_ITEMS.find(i=>i.id===v)?.label)||v||'—'; }
function monKey(login){ return String(login||'anon').replace(/[.#$\[\]]/g,'_'); }
function fmtTs(ts){ const d=new Date(ts); return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); }
function fmtBytes(b){ if(b==null) return '—'; if(b<1024) return b+' B'; if(b<1048576) return (b/1024).toFixed(1)+' KB'; return (b/1048576).toFixed(2)+' MB'; }
function monOnline(p){ return p && p.ts && (Date.now()-p.ts) < 45000; }
function monEventBadge(tipo){ const t=MON_TIPOS[tipo]||{l:tipo,c:'var(--muted)'}; return `<span class="mon-badge" style="color:${t.c};border-color:${t.c};">${t.l}</span>`; }
function monItemLabel(tipo,id){
  id = Number(id);
  if(tipo==='programacao'){ const p=DB.programacoes.find(x=>x.id===id); return p? progGid(p):'Programação #'+id; }
  if(tipo==='equipe'){ const e=findEquipe(id); return e? (e.eqtl||e.prtn||'Equipe'):'Equipe #'+id; }
  if(tipo==='atividade'){ const a=findAtividade(id); return a? a.codigo+' · '+a.descricao:'Atividade #'+id; }
  if(tipo==='projeto'){ const p=findProjeto(id); return p? p.codigo+' · '+p.nome:'Projeto #'+id; }
  if(tipo==='usuario'){ const u=(DB.usuarios||[]).find(x=>x.id===id); return u? u.nome+' ('+u.login+')':'Usuário #'+id; }
  if(tipo==='atribuicao'){
    const pg=progDaAtribuicao(id); const at=findAtribuicaoGlobal(id);
    return (pg? progGid(pg)+' · ':'')+(at? equipeLabel(findEquipe(at.equipeId)):'Atribuição #'+id);
  }
  return String(id);
}
let adminMonTab = 'aovivo';
function monCards(){
  const onlineUsers = monPresList.filter(p=> !String(p.login||'').startsWith('equipe-') && monOnline(p));
  const onlineTeams = monPresList.filter(p=> String(p.login||'').startsWith('equipe-') && monOnline(p));
  const hoje = todayISO();
  const acoesHoje = (DB.auditoria||[]).filter(e=> e.ts && new Date(e.ts).toISOString().slice(0,10)===hoje).length;
  const bytes = JSON.stringify(DB).length;
  return `
    <div class="mon-cards">
      <div class="mon-card"><div class="mon-card-v">${onlineUsers.length}</div><div class="mon-card-l">usuários online</div></div>
      <div class="mon-card"><div class="mon-card-v">${onlineTeams.length}</div><div class="mon-card-l">equipes online (página da equipe)</div></div>
      <div class="mon-card"><div class="mon-card-v">${acoesHoje}</div><div class="mon-card-l">ações registradas hoje</div></div>
      <div class="mon-card"><div class="mon-card-v">${(DB.auditoria||[]).length}</div><div class="mon-card-l">total de registros de auditoria</div></div>
      <div class="mon-card"><div class="mon-card-v">${fmtBytes(bytes)}</div><div class="mon-card-l">tamanho atual do banco</div></div>
    </div>`;
}
function monPanelHtml(){
  return `
  <div class="panel mon-panel">
    <div class="panel-head">
      <div><h3>${icon('pulse',15)} Central de Monitoramento</h3><div class="admin-field-meta">Comunicação em tempo real: ações, tráfego, consumo e quem está online agora. O feed atualiza automaticamente a cada alteração no banco.</div></div>
      <span class="mon-live"><span class="mon-live-dot"></span> AO VIVO</span>
    </div>
    ${monCards()}
    <div class="mon-tabs">
      <button class="mon-tab ${adminMonTab==='aovivo'?'active':''}" data-montab="aovivo">${icon('clock',13)} Ao vivo</button>
      <button class="mon-tab ${adminMonTab==='usuarios'?'active':''}" data-montab="usuarios">${icon('users',13)} Usuários online</button>
      <button class="mon-tab ${adminMonTab==='consumo'?'active':''}" data-montab="consumo">${icon('database',13)} Consumo e tráfego</button>
      <button class="mon-tab ${adminMonTab==='rastrear'?'active':''}" data-montab="rastrear">${icon('search',13)} Rastrear item</button>
    </div>
    <div id="mon-body"></div>
  </div>`;
}
function monBodyHtml(){
  if(adminMonTab==='aovivo') return monAoVivoHtml();
  if(adminMonTab==='usuarios') return monUsuariosHtml();
  if(adminMonTab==='consumo') return monConsumoHtml();
  return monRastrearHtml();
}
function monAoVivoHtml(){
  const evs = [...(DB.auditoria||[])].sort((a,b)=>b.ts-a.ts).slice(0,40);
  if(!evs.length) return `<div class="mon-empty">Nenhum evento registrado ainda. As ações passam a aparecer aqui em tempo real.</div>`;
  return `<div class="mon-feed">${evs.map(e=>`
    <div class="mon-ev" data-rastrear-tipo="${e.itemTipo||''}" data-rastrear-id="${e.itemId??''}" ${e.itemId!=null?'style="cursor:pointer;"':''}>
      <span class="mon-ev-time">${fmtTs(e.ts)}</span>
      ${monEventBadge(e.tipo)}
      <span class="mon-ev-who">${esc(e.nome||e.user||'?')}</span>
      <span class="mon-ev-item">${esc(monItemLabel(e.itemTipo,e.itemId))}</span>
      <span class="mon-ev-det">${esc(e.detalhe||'')}</span>
    </div>`).join('')}</div>`;
}
function monUsuariosHtml(){
  const rows = monPresList.slice(0,30);
  if(!rows.length) return `<div class="mon-empty">Ninguém está conectado no momento.</div>`;
  return `<table class="mon-table"><thead><tr><th>Usuário</th><th>Papel</th><th>Onde está</th><th>Situação</th></tr></thead><tbody>${rows.map(p=>{
    const online = monOnline(p);
    const isTeam = String(p.login||'').startsWith('equipe-');
    const view = isTeam? 'Página da equipe' : monViewLabel(p.view);
    return `<tr>
      <td><span class="mon-online-dot ${online?'on':''}"></span> ${esc(p.nome||p.login||p.key)}${isTeam? ' <span class="mon-badge" style="color:var(--teal);border-color:var(--teal);">equipe</span>':''}</td>
      <td>${esc(p.role||'—')}</td>
      <td>${esc(isTeam? 'Página da equipe' : view)}</td>
      <td>${online? '<span class="mon-online-txt">Online agora</span>':'visto há '+fmtRelTempo(p.ts)}</td>
    </tr>`;
  }).join('')}</tbody></table>`;
}
function monConsumoHtml(){
  const evs = DB.auditoria||[];
  const porUsuario = {};
  evs.forEach(e=>{
    porUsuario[e.login||'?'] = porUsuario[e.login||'?']||{nome:e.nome||e.login||'?', n:0, bytes:0, ts:0};
    porUsuario[e.login||'?'].n++;
    porUsuario[e.login||'?'].bytes += e.bytes||0;
    if((e.ts||0)>porUsuario[e.login||'?'].ts) porUsuario[e.login||'?'].ts=e.ts;
  });
  const porTipo = {};
  evs.forEach(e=>{ porTipo[e.tipo]= (porTipo[e.tipo]||0)+1; });
  const usersSorted = Object.keys(porUsuario).sort((a,b)=>porUsuario[b].bytes-porUsuario[a].bytes);
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div>
        <h4 style="margin:0 0 10px;font-size:13px;">Tráfego estimado por usuário (últimas ações)</h4>
        <table class="mon-table"><thead><tr><th>Usuário</th><th>Ações</th><th>Dados gravados</th><th>Última ação</th></tr></thead><tbody>${usersSorted.slice(0,15).map(u=>`<tr><td>${esc(porUsuario[u].nome)}</td><td>${porUsuario[u].n}</td><td>${fmtBytes(porUsuario[u].bytes)}</td><td>${fmtRelTempo(porUsuario[u].ts)}</td></tr>`).join('')||'<tr><td colspan="4">Sem registros.</td></tr>'}</tbody></table>
      </div>
      <div>
        <h4 style="margin:0 0 10px;font-size:13px;">Atividades por tipo de ação</h4>
        <div class="mon-feed">${Object.keys(porTipo).map(t=>`<div class="mon-ev">${monEventBadge(t)}<span class="mon-ev-item">${porTipo[t]} evento(s)</span><span class="mon-ev-det">${esc(MON_TIPOS[t]?.l||t)}</span></div>`).join('')||'<div class="mon-empty">Sem registros.</div>'}</div>
      </div>
    </div>`;
}
function monRastrearHtml(){
  const opt = t=>`<option value="${t}">${MON_ITEMTIPOS[t]}</option>`;
  return `
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
      <div class="field" style="flex:1;min-width:220px;"><label>Buscar item</label><input type="text" id="mon-rastrear-q" placeholder="Código, nome, GID, equipe, projeto, usuário…"></div>
      <div class="field" style="min-width:170px;"><label>Tipo</label><select id="mon-rastrear-tipo"><option value="">Todos os tipos</option>${opt('programacao')}${opt('atribuicao')}${opt('equipe')}${opt('projeto')}${opt('atividade')}${opt('usuario')}</select></div>
    </div>
    <div id="mon-rastrear-res" style="margin-top:14px;"></div>`;
}
function monRastrearBusca(q, tipo){
  q = (q||'').toLowerCase().trim();
  const res = [];
  if((!tipo||tipo==='programacao')) (DB.programacoes||[]).forEach(p=>{ const pr=findProjeto(p.projetoId); const hay=(progGid(p)+' '+(pr?.nome||'')+' '+(pr?.codigo||'')).toLowerCase(); if(!q||hay.includes(q)) res.push({tipo:'programacao',id:p.id,lbl:progGid(p)+' · '+(pr?.codigo||'')+' '+(pr?.nome||'')}); });
  if(!tipo||tipo==='atribuicao') flatAtribuicoes().forEach(x=>{ const at=x.atribuicao; const pg=progDaAtribuicao(at.id); const eq=findEquipe(at.equipeId); const hay=(progGid(pg)+' '+equipeLabel(eq)+' '+at.status).toLowerCase(); if(!q||hay.includes(q)) res.push({tipo:'atribuicao',id:at.id,lbl:progGid(pg)+' · '+equipeLabel(eq)+' · '+at.status}); });
  if(!tipo||tipo==='equipe') (DB.equipes||[]).forEach(e=>{ const hay=(e.eqtl+' '+e.prtn+' '+e.supervisor+' '+e.encarregado).toLowerCase(); if(!q||hay.includes(q)) res.push({tipo:'equipe',id:e.id,lbl:(e.eqtl||e.prtn||'Equipe')+(e.setor? ' · '+e.setor:'')}); });
  if(!tipo||tipo==='projeto') (DB.projetos||[]).forEach(p=>{ const hay=(p.codigo+' '+p.nome+' '+p.ciclo).toLowerCase(); if(!q||hay.includes(q)) res.push({tipo:'projeto',id:p.id,lbl:p.codigo+' · '+p.nome+' · '+p.ciclo}); });
  if(!tipo||tipo==='atividade') (DB.atividades||[]).forEach(a=>{ const hay=(a.codigo+' '+a.descricao).toLowerCase(); if(!q||hay.includes(q)) res.push({tipo:'atividade',id:a.id,lbl:a.codigo+' · '+a.descricao}); });
  if(!tipo||tipo==='usuario') (DB.usuarios||[]).forEach(u=>{ const hay=(u.nome+' '+u.login).toLowerCase(); if(!q||hay.includes(q)) res.push({tipo:'usuario',id:u.id,lbl:u.nome+' ('+u.login+')'}); });
  res.sort((a,b)=>a.id-b.id);
  return res.slice(0,50);
}
function monRastrearRender(){
  const q = document.getElementById('mon-rastrear-q')?.value||'';
  const tipo = document.getElementById('mon-rastrear-tipo')?.value||'';
  const res = monRastrearBusca(q, tipo);
  const wrap = document.getElementById('mon-rastrear-res');
  if(!wrap) return;
  wrap.innerHTML = res.length? `<div class="mon-feed">${res.map(r=>`<div class="mon-ev" data-rastrear-tipo="${r.tipo}" data-rastrear-id="${r.id}" style="cursor:pointer;"><span class="mon-badge" style="color:var(--accent);border-color:var(--accent);">${MON_ITEMTIPOS[r.tipo]||r.tipo}</span><span class="mon-ev-item">${esc(r.lbl)}</span><span class="mon-ev-det">Clique para ver passado e presente</span></div>`).join('')}</div>` : `<div class="mon-empty">${q? 'Nenhum item encontrado com "'+esc(q)+'".':'Digite algo para buscar um item.'}</div>`;
  wrap.querySelectorAll('[data-rastrear-tipo]').forEach(el=>el.addEventListener('click', ()=>rastrearItem(el.dataset.rastrearTipo, el.dataset.rastrearId)));
}
function bindMonPanel(){
  document.querySelectorAll('.mon-tab').forEach(b=>b.addEventListener('click', ()=>{ adminMonTab=b.dataset.montab; renderAdmin(); }));
  const body = document.getElementById('mon-body');
  if(body) body.innerHTML = monBodyHtml();
  body && body.querySelectorAll('[data-rastrear-tipo]').forEach(el=>el.addEventListener('click', ()=>rastrearItem(el.dataset.rastrearTipo, el.dataset.rastrearId)));
  const bq = document.getElementById('mon-rastrear-q');
  const bt = document.getElementById('mon-rastrear-tipo');
  if(bq) bq.addEventListener('input', monRastrearRender);
  if(bt) bt.addEventListener('change', monRastrearRender);
  if(bq) monRastrearRender();
}
function rastrearItem(itemTipo, itemId){
  itemId = Number(itemId);
  const rows = [];
  const push = (tipo, ts, quem, det, tag)=>{
    rows.push({ts:Number(ts)||Date.now(), tipo, quem, det, tag});
  };
  const histTipo = t=> t==='status'?'status' : t==='reprogramacao'?'reprogramacao' : t==='rdo_edicao'?'rdo' : t==='criacao'?'criacao' : 'edicao';
  const histDet = h=>{
    if(h.tipo==='status') return (h.de||'?')+' → '+(h.para||'?')+(h.motivo? ' · '+h.motivo:'');
    if(h.tipo==='reprogramacao') return fmtDate(h.de)+' → '+fmtDate(h.para)+(h.motivo? ' · '+h.motivo:'');
    if(h.tipo==='rdo_edicao') return 'Registro RDO editado'+(h.motivo? ' · '+h.motivo:'');
    return h.para||h.motivo||'';
  };
  const eqLbl = e=> equipeLabel(e)||'Equipe';
  let present = '';
  if(itemTipo==='programacao'){
    const p = DB.programacoes.find(x=>x.id===itemId);
    if(p){
      const pr = findProjeto(p.projetoId);
      present = `GID ${progGid(p)} · ${esc(pr?.nome||'Projeto removido')} · Ciclo ${esc(p.ciclo||'—')} · ${(p.atribuicoes||[]).length} equipe(s) · ${(p.atribuicoes||[]).map(a=>esc(a.status)).join(' / ')||'—'}`;
      (p.atribuicoes||[]).forEach(a=>{ (a.historico||[]).forEach(h=>push(histTipo(h.tipo), h.ts, h.nome||h.login||'?', eqLbl(findEquipe(a.equipeId))+' · '+histDet(h), 'atribuicao')); });
    }
  } else if(itemTipo==='atribuicao'){
    const at = findAtribuicaoGlobal(itemId);
    const pg = progDaAtribuicao(itemId);
    if(at){
      const qty = (at.atividades||[]).reduce((s,a)=>s+(Number(a.quantidadeExecutada)||0),0);
      present = `Equipe ${esc(eqLbl(findEquipe(at.equipeId)))} · Status ${esc(at.status)} · Programada ${fmtDate(at.dataProgramada)} · Executado ${qty} un · ${(at.atividades||[]).length} atividade(s)`;
      (at.historico||[]).forEach(h=>push(histTipo(h.tipo), h.ts, h.nome||h.login||'?', (pg? progGid(pg)+' · ':'')+histDet(h), ''));
    }
  } else if(itemTipo==='equipe'){
    const e = findEquipe(itemId);
    if(e){
      present = `${esc(e.eqtl||'')} ${esc(e.prtn||'')} · ${e.ativo?'Ativa':'Inativa'} · ${esc([e.setor,e.coordenacao].filter(Boolean).join(' / ')||'—')} · Supervisor: ${esc(e.supervisor||'—')} · Encarregado: ${esc(e.encarregado||'—')} · WhatsApp: ${esc(e.whatsapp||'—')}`;
      flatAtribuicoes().filter(x=>x.atribuicao.equipeId===itemId).forEach(x=>{ const pg=progDaAtribuicao(x.atribuicao.id); (x.atribuicao.historico||[]).forEach(h=>push(histTipo(h.tipo), h.ts, h.nome||h.login||'?', (pg? progGid(pg)+' · ':'')+histDet(h), 'atribuicao')); });
    }
  } else if(itemTipo==='atividade'){
    const a = findAtividade(itemId);
    if(a) present = `${esc(a.codigo)} · ${esc(a.descricao)} · Unidade ${esc(a.unidade||'—')} · Valor unitário ${fmtMoney(a.valorUnitario)}${a.fav? ' · Favorita':''}`;
  } else if(itemTipo==='projeto'){
    const p = findProjeto(itemId);
    if(p) present = `${esc(p.codigo)} · ${esc(p.nome)} · ${esc(p.status)} · ${esc([p.setor,p.coordenacao].filter(Boolean).join(' / ')||'—')} · ${esc(p.cidade||'—')} · Ciclo ${esc(p.ciclo||'—')} · Orçado ${fmtMoney(p.valorOrcado)} · Início ${fmtDate(p.dataInicio)} · Fim ${fmtDate(p.dataFim)}`;
  } else if(itemTipo==='usuario'){
    const u = (DB.usuarios||[]).find(x=>x.id===itemId);
    if(u) present = `${esc(u.nome)} · ${esc(u.login)} · ${esc(roleLabel(u.role))} · ${esc(nivelLabel(u.nivel))}${u.setor||u.coordenacao? ' · '+esc([u.setor,u.coordenacao].filter(Boolean).join(' / ')):''} · ${u.ativo?'Ativo':'Inativo'}`;
  }
  (DB.auditoria||[]).forEach(e=>{
    if(String(e.itemTipo)===itemTipo && String(e.itemId)===String(itemId)){
      push(e.tipo, e.ts, e.nome||e.user||'?', monItemLabel(e.itemTipo,e.itemId)+(e.detalhe? ' · '+e.detalhe:''), '');
    }
  });
  rows.sort((a,b)=>a.ts-b.ts);
  const body = `
    <div style="margin-bottom:14px;padding:12px;border-radius:10px;background:var(--bg-soft);font-size:13px;line-height:1.55;">
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;"><span class="mon-badge" style="color:var(--accent);border-color:var(--accent);">${MON_ITEMTIPOS[itemTipo]||itemTipo}</span><strong style="font-size:14px;color:var(--dark);">${esc(monItemLabel(itemTipo,itemId))}</strong></div>
      <div class="admin-field-meta">${present||'Item não encontrado ou removido do banco.'}</div>
    </div>
    <h4 style="margin:0 0 10px;font-size:13px;">Linha do tempo — passado e presente (${rows.length} registro(s))</h4>
    <div class="mon-feed">${rows.length? rows.map(r=>`<div class="mon-ev">
      <span class="mon-ev-time">${fmtTs(r.ts)}</span>
      ${monEventBadge(r.tipo)}
      <span class="mon-ev-who">${esc(r.quem)}</span>
      ${r.tag? `<span class="mon-badge" style="color:var(--muted);border-color:var(--border);">${esc(r.tag)}</span>`:''}
      <span class="mon-ev-det">${esc(r.det)}</span>
    </div>`).join('') : '<div class="mon-empty">Nenhum registro de auditoria ou histórico encontrado para este item.</div>'}</div>`;
  openModal({ title:'Rastrear item — '+MON_ITEMTIPOS[itemTipo], bodyHtml:body, submitLabel:'Fechar', onSubmit:()=>true, wide:true });
}
function registrarPresenca(){
  if(!CURRENT_USER) return;
  try{
    const key = monKey(CURRENT_USER.login);
    const info = { login: String(CURRENT_USER.login), nome: CURRENT_USER.nome, role: CURRENT_USER.role, view: currentView, ts: Date.now() };
    PRES_REF.child(key).set(info);
    PRES_REF.child(key).onDisconnect().remove();
  }catch(e){}
}
function iniciarPresenca(){
  registrarPresenca();
  clearInterval(monHeartbeat);
  monHeartbeat = setInterval(registrarPresenca, 15000);
}
function pararPresenca(){
  clearInterval(monHeartbeat); monHeartbeat=null;
  if(CURRENT_USER){
    try{ PRES_REF.child(monKey(CURRENT_USER.login)).remove(); }catch(e){}
  }
}
function atualizarPresencaView(){
  if(!CURRENT_USER) return;
  try{ PRES_REF.child(monKey(CURRENT_USER.login)).update({ view: currentView, ts: Date.now() }); }catch(e){}
}
let monLastSig = '';
(function watchPresenca(){
  PRES_REF.on('value', snap=>{
    const raw = snap.val()||{};
    const arr = Object.keys(raw).map(k=>({ key:k, ...raw[k] }));
    arr.sort((a,b)=> (b.ts||0)-(a.ts||0));
    monPresenca = raw;
    monPresList = arr;
    const sig = arr.map(p=> p.login+'|'+p.view+'|'+(monOnline(p)?'on':'off')).join(',');
    if(sig!==monLastSig){ monLastSig=sig; if(CURRENT_USER && currentView==='admin') renderContent(); }
  });
})();
function showLoginScreen(){
  document.getElementById('login-screen').classList.remove('hidden');
  const u = document.getElementById('login-user');
  const p = document.getElementById('login-pass');
  const st = document.getElementById('login-status');
  st.style.color = 'var(--muted)';
  st.textContent = '';
  try{
    const saved = JSON.parse(localStorage.getItem('g26_login_saved')||'null');
    if(saved && saved.login){
      u.value = saved.login;
      p.value = saved.senha||'';
      document.getElementById('login-remember').checked = true;
    }
  }catch(e){ localStorage.removeItem('g26_login_saved'); }
  if(u.value==='') u.focus(); else p.focus();
  document.getElementById('nav-user').textContent = CURRENT_USER? 'Conectado: '+CURRENT_USER.nome : 'Dados sincronizados na nuvem (Firebase)';
}
function tryLogin(){
  const login = document.getElementById('login-user').value.trim();
  const senha = document.getElementById('login-pass').value;
  const remember = document.getElementById('login-remember').checked;
  const u = (DB.usuarios||[]).find(x=> x.ativo!==false && String(x.login)===login && String(x.senha)===senha);
  const st = document.getElementById('login-status');
  if(!u){ st.textContent = 'Usuário ou senha inválidos.'; st.style.color='var(--red)'; return; }
  if(remember){
    try{ localStorage.setItem('g26_login_saved', JSON.stringify({login, senha})); }catch(e){}
  } else {
    try{ localStorage.removeItem('g26_login_saved'); }catch(e){}
  }
  CURRENT_USER = u;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('login-pass').value='';
  document.getElementById('nav-user').textContent = 'Conectado: '+u.nome+' · '+roleLabel(u.role);
  registrarEvento('login','usuario',u.id,u.nome,'Entrou no sistema');
  iniciarPresenca();
  progFilters.ciclo = cicloPadrao();
  setView('dashboard');
  checkPendingConfirmations();
  toast('Bem-vindo, '+u.nome+'!');
}
function logout(){
  registrarEvento('logout','usuario',CURRENT_USER? CURRENT_USER.id:null, CURRENT_USER? CURRENT_USER.nome:'', 'Saiu do sistema');
  pararPresenca();
  CURRENT_USER = null;
  document.getElementById('nav-user').textContent = 'Dados sincronizados na nuvem (Firebase)';
  showLoginScreen();
}
document.getElementById('login-btn').addEventListener('click', tryLogin);
document.getElementById('login-user').addEventListener('keydown', e=>{ if(e.key==='Enter') document.getElementById('login-pass').focus(); });
document.getElementById('login-pass').addEventListener('keydown', e=>{ if(e.key==='Enter') tryLogin(); });
const EYE_OPEN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
const EYE_CLOSED = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"></path><path d="M1 1l22 22"></path></svg>';
document.getElementById('pwd-eye').addEventListener('click', ()=>{
  const input = document.getElementById('login-pass');
  const show = input.type==='password';
  input.type = show? 'text' : 'password';
  const btn = document.getElementById('pwd-eye');
  btn.innerHTML = show? EYE_CLOSED : EYE_OPEN;
  btn.title = show? 'Ocultar senha' : 'Mostrar senha';
});
document.getElementById('btn-logout').addEventListener('click', logout);

/* =========================================================
   INIT — carrega dados do Firebase Realtime Database
========================================================= */
let booted = false;
DB_REF.on('value', snap=>{
  if(saveTimer) return;
  const exists = snap.exists();
  if(exists && typeof snap.val()==='string' && snap.val()===lastWrittenJson) return;
  try{
    if(exists){
      DB = mergeData(JSON.parse(snap.val()));
    }
  }catch(err){ console.error('Falha ao ler dados do Firebase', err); }
  if(!booted){
    booted = true;
    if(!exists) seedIfEmpty();
    garantirMaster();
    progFilters.ciclo = cicloPadrao();
    showLoginScreen();
  }else if(CURRENT_USER){
    renderBanner();
    renderContent();
    checkPendingConfirmations();
  }
});
setTimeout(()=>{
  if(!booted){
    booted = true;
    seedIfEmpty();
    garantirMaster();
    progFilters.ciclo = cicloPadrao();
    showLoginScreen();
    toast('Sem conexão com o Firebase. Os dados ficarão apenas nesta sessão.', 'error');
  }
}, 8000);

/* =========================================================
   RDO - Relatório de Execução das Equipes
   ========================================================= */
function rdoTemExecucao(x){
  const at = x.atribuicao;
  const rdo = at.rdoRespostas||{};
  const temRespostas = Object.values(rdo).some(v=> v && String(v).trim()!=='');
  const temHorarios = RDO_HORARIOS.some(h=> at[h.k]);
  const temExec = (at.atividades||[]).some(a=> a.quantidadeExecutada!=null && String(a.quantidadeExecutada).trim()!=='');
  const temCond = ['rdoCondicoes','rdoImpedimento','rdoFaltaMaterial','rdoProjetoIncoerente','rdoEquipeIncompleta','rdoFaltaVeiculo','rdoImpedimentoAcesso','rdoLicencaAmbiental','rdoAutorizacaoEmbargo','rdoDesligamento'].some(k=> at[k]);
  return temRespostas || temHorarios || temExec || temCond || at.status==='Concluído';
}
function rdoResumo(x){
  const at = x.atribuicao;
  let prev=0, exec=0;
  (at.atividades||[]).forEach(a=>{
    const p = parseFloat(a.quantidadePrevista)||0;
    const e = a.quantidadeExecutada==null? null : parseFloat(a.quantidadeExecutada);
    prev+=p;
    if(e!=null && !isNaN(e)) exec+=e;
  });
  const pct = prev>0? Math.round(exec/prev*100) : (at.status==='Concluído'? 100 : 0);
  return { prev, exec, pct };
}
function rdoImpedimentos(at){
  const itens=[];
  const map = [
    ['rdoImpedimento','Impedimento de execução'],
    ['rdoFaltaMaterial','Falta de material'],
    ['rdoProjetoIncoerente','Projeto incoerente'],
    ['rdoEquipeIncompleta','Equipe incompleta'],
    ['rdoFaltaVeiculo','Falta de veículo'],
    ['rdoImpedimentoAcesso','Impedimento de acesso'],
    ['rdoLicencaAmbiental','Licença ambiental'],
    ['rdoAutorizacaoEmbargo','Autorização/embargo']
  ];
  map.forEach(([k,l])=>{ if(at[k]==='Sim') itens.push(l); });
  if(at.rdoDesligamento==='Não') itens.push('Desligamento não programado');
  return itens;
}
function rdoConfData(x){
  const hist = (x.atribuicao.historico||[]).filter(h=>h.tipo==='equipe');
  const h = hist[hist.length-1];
  return h ? fmtDateTime(h.ts) : '—';
}
function rdoStatusBadge(status){
  const s = status||'Programado';
  const cor = { 'Programado':'var(--blue)','Em Execução':'var(--accent)','Concluído':'var(--green)','Reprogramado':'var(--purple)','Cancelado':'var(--red)' }[s]||'var(--muted)';
  const bg = { 'Programado':'rgba(78,140,235,.14)','Em Execução':'rgba(224,164,88,.14)','Concluído':'rgba(34,139,34,.14)','Reprogramado':'rgba(142,110,235,.14)','Cancelado':'rgba(224,97,91,.14)' }[s]||'rgba(128,128,128,.14)';
  return `<span class="badge" style="color:${cor};background:${bg};">${esc(s)}</span>`;
}

function renderProgramacoesConcluidas(){
  const el = document.getElementById('content');
  let registros = flatAtribuicoes().filter(rdoTemExecucao);

  // Ordena: mais recentes primeiro pela data programada
  registros.sort((a,b)=> String(b.atribuicao.dataProgramada||'').localeCompare(String(a.atribuicao.dataProgramada||'')));

  const stats = (()=>{
    const total = registros.length;
    const concluidos = registros.filter(x=>x.atribuicao.status==='Concluído').length;
    const totalExec = registros.reduce((s,x)=> s+rdoResumo(x).exec, 0);
    const mediaPct = total? Math.round(registros.reduce((s,x)=> s+rdoResumo(x).pct,0)/total) : 0;
    const imped = registros.filter(x=> rdoImpedimentos(x.atribuicao).length>0).length;
    return `
      <div class="grid-stats">
        <div class="stat-card"><div class="lbl">Registros de execução</div><div class="val">${total}</div></div>
        <div class="stat-card" style="--accent-c:var(--green);"><div class="lbl">Concluídas</div><div class="val">${concluidos}</div></div>
        <div class="stat-card" style="--accent-c:var(--blue);"><div class="lbl">Qtd. executada</div><div class="val">${fmtNum(totalExec)}</div></div>
        <div class="stat-card" style="--accent-c:var(--accent);"><div class="lbl">Conclusão média</div><div class="val">${mediaPct}<small>%</small></div></div>
        <div class="stat-card" style="--accent-c:var(--red);"><div class="lbl">Com impedimentos</div><div class="val">${imped}</div></div>
      </div>`;
  })();

  const projetos = [...new Set(registros.map(x=>x.programacao.projetoId))].map(id=> findProjeto(id)).filter(Boolean);
  const equipes = [...new Set(registros.map(x=>x.atribuicao.equipeId))].map(id=> findEquipe(id)).filter(Boolean);

  const filters = `
    <div class="panel" style="padding:14px 16px;margin-bottom:16px;">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">
        <input type="search" id="rdo-f-busca" placeholder="Buscar por projeto, equipe, supervisor, data, status, GID ou ID da programação..." style="flex:1;">
        <button class="btn btn-sm" id="rdo-f-busca-aplicar">${icon('search',13)} Buscar</button>
      </div>
      <div class="filters">
        <label style="font-weight:600;">Projeto</label>
        <select id="rdo-f-projeto"><option value="">Todos</option>${projetos.map(p=>`<option value="${p.id}">${esc(p.nome)}</option>`).join('')}</select>
        <label style="font-weight:600;">Equipe</label>
        <select id="rdo-f-equipe"><option value="">Todas</option>${equipes.map(e=>`<option value="${e.id}">${esc(equipeLabel(e))}</option>`).join('')}</select>
        <label style="font-weight:600;">Status</label>
        <select id="rdo-f-status"><option value="">Todos</option>${STATUS_PROG.map(s=>`<option>${s}</option>`).join('')}</select>
        <label style="font-weight:600;">De</label>
        <input type="date" id="rdo-f-de">
        <label style="font-weight:600;">Até</label>
        <input type="date" id="rdo-f-ate">
        <button class="btn btn-sm" id="rdo-f-aplicar">${icon('grid',13)} Filtrar</button>
        <button class="btn btn-sm btn-ghost" id="rdo-f-limpar">Limpar</button>
      </div>
    </div>`;

  const tabela = `
    <div class="panel" style="padding:0;overflow:hidden;">
      <div class="panel-head" style="padding:14px 16px;">
        <div><h3>Execuções das equipes</h3><div class="admin-field-meta">Todos os dados de execução e projetos executados em campo.</div></div>
        <div class="filters" style="gap:6px;">
          <button class="btn btn-sm" id="rdo-export">${icon('download',13)} Excel</button>
          <button class="btn btn-sm btn-ghost" id="rdo-print">${icon('print',13)} Imprimir</button>
        </div>
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table" style="width:100%;border-collapse:collapse;font-size:12.5px;min-width:1200px;">
          <thead>
            <tr>
              <th style="width:30px;">#</th>
              <th>Projeto</th>
              <th>Equipe</th>
              <th style="text-align:center;">Data</th>
              <th style="text-align:center;">Status</th>
              <th style="text-align:center;">Horários</th>
              <th style="text-align:center;">Clima</th>
              <th style="text-align:center;">Impedimentos</th>
              <th style="text-align:center;">Prev.</th>
              <th style="text-align:center;">Exec.</th>
              <th style="text-align:center;width:110px;">Progresso</th>
              <th style="text-align:center;">Confirmação</th>
              <th style="width:40px;"></th>
            </tr>
          </thead>
          <tbody>
            ${registros.map((x,i)=>{
              const pr = findProjeto(x.programacao.projetoId);
              const eq = findEquipe(x.atribuicao.equipeId);
              const res = rdoResumo(x);
              const imped = rdoImpedimentos(x.atribuicao);
              const horarios = [x.atribuicao.rdoHorarioChegada, x.atribuicao.rdoHorarioSaidaObra].filter(Boolean).join(' → ')||'—';
              return `
                <tr data-prog="${x.programacao.id}" data-atrib="${x.atribuicao.id}" style="cursor:pointer;" title="Ver detalhes">
                  <td style="text-align:center;color:var(--muted-2);">${i+1}</td>
                  <td><strong>${esc(pr?.nome||'—')}</strong><div class="admin-field-meta">${esc(pr?.codigo||'')} · Ciclo ${esc(x.programacao.ciclo||'—')}</div></td>
                  <td>${esc(equipeLabel(eq))}<div class="admin-field-meta">${esc(eq?.supervisor||'')}</div></td>
                  <td style="text-align:center;" class="mono">${fmtDate(x.atribuicao.dataProgramada)}</td>
                  <td style="text-align:center;">${rdoStatusBadge(x.atribuicao.status)}</td>
                  <td style="text-align:center;" class="mono">${esc(horarios)}</td>
                  <td style="text-align:center;">${esc(x.atribuicao.rdoCondicoes||'—')}</td>
                  <td style="text-align:center;">${imped.length? `<span class="badge" style="color:var(--red);background:rgba(224,97,91,.12);">${imped.length}</span>` : '—'}</td>
                  <td style="text-align:center;" class="mono">${fmtNum(res.prev)}</td>
                  <td style="text-align:center;" class="mono"><strong>${fmtNum(res.exec)}</strong></td>
                  <td>
                    <div style="display:flex;align-items:center;gap:6px;">
                      <div style="flex:1;height:6px;background:var(--panel-2);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${Math.min(100,res.pct)}%;background:${res.pct>=100?'var(--green)':res.pct>=50?'var(--accent)':'var(--red)'};border-radius:3px;"></div></div>
                      <span class="mono" style="font-size:11px;min-width:34px;text-align:right;">${res.pct}%</span>
                    </div>
                  </td>
                  <td style="text-align:center;" class="mono"><span style="font-size:11px;">${rdoConfData(x)}</span></td>
                  <td style="text-align:center;">${icon('search',13)}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  const vazio = `
    <div class="panel"><div class="empty-state">${icon('check',36)}<h3 style="margin-bottom:6px;">Nenhuma execução registrada</h3><p>Quando as equipes responderem o RDO na página da programação, os dados de execução aparecerão aqui.</p><button class="btn btn-primary" id="rdo-back-dash" style="margin-top:16px;">Voltar ao Painel</button></div></div>`;

  if(!registros.length){
    el.innerHTML = `<div class="section-gap">${stats}${vazio}</div>`;
    const b = document.getElementById('rdo-back-dash');
    if(b) b.addEventListener('click', ()=> setView('dashboard'));
    return;
  }

  el.innerHTML = `<div class="section-gap">${stats}${filters}${tabela}</div>`;

  // Filtros
  const fProj = document.getElementById('rdo-f-projeto');
  const fEq = document.getElementById('rdo-f-equipe');
  const fSt = document.getElementById('rdo-f-status');
  const fDe = document.getElementById('rdo-f-de');
  const fAte = document.getElementById('rdo-f-ate');
  const fBusca = document.getElementById('rdo-f-busca');
  const norm = s=> String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const aplicar = ()=>{
    const q = norm(fBusca.value.trim());
    registros.forEach(x=>{
      const pr = findProjeto(x.programacao.projetoId);
      const eq = findEquipe(x.atribuicao.equipeId);
      const okProj = !fProj.value || String(x.programacao.projetoId)===String(fProj.value);
      const okEq = !fEq.value || String(x.atribuicao.equipeId)===String(fEq.value);
      const okSt = !fSt.value || x.atribuicao.status===fSt.value;
      const data = x.atribuicao.dataProgramada||'';
      const okDe = !fDe.value || data >= fDe.value;
      const okAte = !fAte.value || data <= fAte.value;
      const hay = norm([
        pr?.nome, pr?.codigo, pr?.setor, pr?.coordenacao,
        equipeLabel(eq), eq?.supervisor, eq?.encarregado, eq?.motorista, (eq?.eletricistas||[]).join(' '),
        data, x.atribuicao.status,
        x.atribuicao.rdoHorarioChegada, x.atribuicao.rdoHorarioSaidaObra, x.atribuicao.rdoCondicoes,
        rdoImpedimentos(x.atribuicao).join(' '),
        progGid(x.programacao), String(x.programacao.id), String(x.atribuicao.id)
      ].join(' '));
      const okBusca = !q || hay.indexOf(q)!==-1;
      const tr = document.querySelector(`tr[data-prog="${x.programacao.id}"][data-atrib="${x.atribuicao.id}"]`);
      if(tr) tr.style.display = (okProj&&okEq&&okSt&&okDe&&okAte&&okBusca)? '' : 'none';
    });
  };
  fBusca.addEventListener('input', aplicar);
  document.getElementById('rdo-f-busca-aplicar').addEventListener('click', aplicar);
  document.getElementById('rdo-f-aplicar').addEventListener('click', aplicar);
  document.getElementById('rdo-f-limpar').addEventListener('click', ()=>{
    fProj.value=''; fEq.value=''; fSt.value=''; fDe.value=''; fAte.value=''; fBusca.value='';
    aplicar();
  });

  // Linha abre detalhe
  document.querySelectorAll('tr[data-prog]').forEach(tr=>{
    tr.addEventListener('click', ()=> openRDOModal(Number(tr.dataset.prog), Number(tr.dataset.atrib)));
  });

  // Exportar Excel
  document.getElementById('rdo-export').addEventListener('click', ()=> exportRDOExcel(registros));
  // Imprimir
  document.getElementById('rdo-print').addEventListener('click', ()=> printRDOReport(registros));
}

function openRDOModal(progId, attribId){
  const x = flatAtribuicoes().find(y=> y.programacao.id===progId && y.atribuicao.id===attribId);
  if(!x) return;
  const pr = findProjeto(x.programacao.projetoId);
  const eq = findEquipe(x.atribuicao.equipeId);
  const rdo = x.atribuicao.rdoRespostas||{};
  const res = rdoResumo(x);
  const imped = rdoImpedimentos(x.atribuicao);
  const horarios = RDO_HORARIOS.map(h=> `
    <tr><td style="font-weight:600;padding:5px 12px 5px 0;white-space:nowrap;">${h.label}</td>
    <td style="padding:5px 10px;border:1px solid var(--border);border-radius:4px;">${x.atribuicao[h.k]||'—'}</td></tr>`).join('');

  const body = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
      <div>
        <h4 style="margin-bottom:8px;">Programação ${progGid(x.programacao)}</h4>
        <p class="admin-field-meta" style="margin:2px 0;">${esc(pr?.nome||'—')} <strong>(${esc(pr?.codigo||'—')})</strong></p>
        <p class="admin-field-meta" style="margin:2px 0;">Setor ${esc(pr?.setor||'—')} · Coordenação ${esc(pr?.coordenacao||'—')}</p>
        <p class="admin-field-meta" style="margin:2px 0;">Ciclo ${esc(x.programacao.ciclo||'—')} · Data ${fmtDate(x.atribuicao.dataProgramada)}</p>
        <div style="margin-top:8px;">${rdoStatusBadge(x.atribuicao.status)}</div>
      </div>
      <div>
        <h4 style="margin-bottom:8px;">Equipe</h4>
        <p class="admin-field-meta" style="margin:2px 0;"><strong>${esc(equipeLabel(eq))}</strong></p>
        <p class="admin-field-meta" style="margin:2px 0;">Supervisor: ${esc(eq?.supervisor||'—')}</p>
        <p class="admin-field-meta" style="margin:2px 0;">Encarregado: ${esc(eq?.encarregado||'—')}</p>
        <p class="admin-field-meta" style="margin:2px 0;">Motorista: ${esc(eq?.motorista||'—')}</p>
        <p class="admin-field-meta" style="margin:2px 0;">Eletricistas: ${esc((eq?.eletricistas||[]).filter(Boolean).join(', ')||'—')}</p>
      </div>
    </div>
    ${(x.programacao.anexos&&x.programacao.anexos.length)? `<div style="margin-bottom:20px;">
      <h4 style="margin-bottom:8px;">Anexos do programador</h4>
      ${anexosDisplayHtml(x.programacao.anexos)}
    </div>`:''}
    <div style="margin-bottom:20px;">
      <h4 style="margin-bottom:8px;">Horários do RDO</h4>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px;">${horarios}</table>
    </div>
    <div style="margin-bottom:20px;">
      <h4 style="margin-bottom:8px;">Condições do RDO</h4>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
        ${RDO_QUESTIONS.map(q=>`
          <tr><td style="font-weight:600;padding:3px 12px 3px 0;">${q.label}</td>
          <td style="padding:3px 10px;">${String(rdo[q.id]||'')||'—'}</td></tr>`).join('')}
      </table>
      ${imped.length? `<div style="margin-top:10px;">${imped.map(i=>`<span class="badge" style="color:var(--red);background:rgba(224,97,91,.12);margin-right:4px;">${esc(i)}</span>`).join('')}</div>`:''}
    </div>
    <div style="margin-bottom:20px;">
      <h4 style="margin-bottom:8px;">Atividades e quantidades executadas</h4>
      <div style="display:flex;gap:14px;margin-bottom:12px;">
        <span class="badge-prefix">Prev. ${fmtNum(res.prev)}</span>
        <span class="badge-prefix alt">Exec. ${fmtNum(res.exec)}</span>
        <span class="badge-prefix" style="color:${res.pct>=100?'var(--green)':res.pct>=50?'var(--accent)':'var(--red)'};">${res.pct}%</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr><th style="text-align:left;padding:4px 6px;">#</th><th style="text-align:left;">Código</th><th style="text-align:left;">Descrição</th><th style="text-align:center;">Un.</th><th style="text-align:center;">Prev.</th><th style="text-align:center;">Exec.</th><th style="text-align:center;">%</th><th style="text-align:center;">Fotos</th></tr></thead>
        <tbody>
          ${(x.atribuicao.atividades||[]).map((a,idx)=>{
            const at = findAtividade(a.atividadeId);
            const p = parseFloat(a.quantidadePrevista)||0;
            const e = a.quantidadeExecutada==null? null : parseFloat(a.quantidadeExecutada);
            const pct = p? Math.round((e||0)/p*100) : 0;
            const fotos = String(a.fotos||'').split(';;').filter(Boolean);
            return `<tr style="border-top:1px solid var(--border-soft);">
              <td style="padding:4px 6px;color:var(--muted-2);">${idx+1}</td>
              <td class="mono" style="padding:4px 6px;">${esc(at?.codigo||'?')}</td>
              <td style="padding:4px 6px;">${esc(at?.descricao||'')}</td>
              <td style="text-align:center;">${esc(at?.unidade||'')}</td>
              <td style="text-align:center;" class="mono">${p? fmtNum(p):'—'}</td>
              <td style="text-align:center;" class="mono"><strong>${e!=null? fmtNum(e):'—'}</strong></td>
              <td style="text-align:center;color:${pct>=100?'var(--green)':pct>=50?'var(--accent)':'var(--red)'};font-weight:700;">${p? pct+'%':'—'}</td>
              <td style="text-align:center;">${fotos.length? `<div class="rdo-fotos" style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">${fotos.map(u=>`<img class="rdo-foto" src="${esc(u)}" alt="foto" title="Ampliar" style="width:36px;height:36px;object-fit:cover;border-radius:6px;border:1px solid var(--border);cursor:zoom-in;">`).join('')}</div>`:'<span style="color:var(--muted-2);">—</span>'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div style="margin-bottom:20px;">
      <h4 style="margin-bottom:8px;">Observação da execução</h4>
      <p style="font-size:13px;">${esc(x.atribuicao.observacao)||'—'}</p>
    </div>
    <div class="admin-field-meta">Confirmado pela equipe em <strong>${rdoConfData(x)}</strong></div>`;

  openModal({ title:'RDO — Detalhes da execução', bodyHtml: body, submitLabel:'Fechar', wide:true, footerBtns:[
    { label: icon('edit',14)+' Editar registro', cls:'btn', onClick: ()=> editRdoModal(x) },
    { label: icon('print',14)+' Gerar PDF', cls:'btn', onClick: ()=> printRDOCompleto(x) }
  ] });
}

function rdoOptionsHtml(q, atual){
  const opts = q.id==='rdo_condicoes'? ['Bom','Nublado','Chuvoso','Impraticável'] : ['Não','Sim'];
  return `<option value="">—</option>${opts.map(o=>`<option ${String(atual||'').trim()===o? 'selected':''}>${o}</option>`).join('')}`;
}
function editRdoModal(x){
  if(!requerEscrita()) return;
  const at = x.atribuicao;
  const horarios = RDO_HORARIOS.map(h=>`<div class="field" style="flex:1;"><label>${h.label}</label><input type="time" name="${h.k}" value="${at[h.k]||''}"></div>`).join('');
  const condicoes = RDO_QUESTIONS.map(q=>`<div class="field"><label>${q.label}</label><select name="${q.id}">${rdoOptionsHtml(q, at.rdoRespostas?.[q.id])}</select></div>`).join('');
  const ativs = (at.atividades||[]).map((a,idx)=>{
    const atDef = findAtividade(a.atividadeId);
    return `<div class="field" style="display:flex;gap:8px;align-items:center;"><span style="flex:1;font-size:12px;"><strong>${esc(atDef?.codigo||'?')}</strong> · ${esc(atDef?.descricao||'')}</span><input type="number" step="0.01" min="0" name="exec_${idx}" value="${a.quantidadeExecutada!=null? a.quantidadeExecutada:''}" style="max-width:110px;" placeholder="Exec."></div>`;
  }).join('') || '<p class="admin-field-meta">Sem atividades neste registro.</p>';
  const body = `
    <div style="font-size:12.5px;color:var(--muted);margin-bottom:12px;">Editando o registro RDO de <strong>${esc(equipeLabel(findEquipe(at.equipeId)))}</strong> — ${progGid(x.programacao)}</div>
    <div class="field"><label>Motivo da edição <span class="req">*</span></label><input type="text" name="motivo" required maxlength="200" placeholder="Por que você está editando este registro RDO?"></div>
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border-soft);">
      <h4 style="font-size:12.5px;margin:0 0 10px;">Horários do RDO</h4>
      <div class="field-row" style="grid-template-columns:1fr 1fr;">${horarios}</div>
    </div>
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border-soft);">
      <h4 style="font-size:12.5px;margin:0 0 10px;">Condições do RDO</h4>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 14px;">${condicoes}</div>
    </div>
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border-soft);">
      <h4 style="font-size:12.5px;margin:0 0 10px;">Quantidades executadas</h4>
      ${ativs}
    </div>
    <div class="field" style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border-soft);"><label>Observação da execução</label><textarea name="obs" rows="3" placeholder="Observação registrada pela equipe">${esc(at.observacao||'')}</textarea></div>`;
  openModal({
    title:'Editar registro RDO', bodyHtml: body, wide:true, submitLabel:'Salvar alterações',
    onSubmit:(fd)=>{
      const motivo = String(fd.get('motivo')||'').trim();
      if(!motivo){ toast('Informe o motivo da edição do registro.', 'error'); return false; }
      const obs = String(fd.get('obs')||'').trim();
      at.rdoRespostas = at.rdoRespostas||{};
      RDO_HORARIOS.forEach(h=>{ at[h.k] = String(fd.get(h.k)||'').trim(); });
      RDO_QUESTIONS.forEach(q=>{ at.rdoRespostas[q.id] = String(fd.get(q.id)||'').trim(); });
      at.rdoCondicoes = at.rdoRespostas.rdo_condicoes||'';
      (at.atividades||[]).forEach((a,idx)=>{
        const v = fd.get('exec_'+idx);
        a.quantidadeExecutada = (v!==null && String(v).trim()!=='')? parseFloat(v) : null;
      });
      at.observacao = obs;
      at.historico = at.historico||[];
      at.historico.push({...currentAutor(), ts:Date.now(), tipo:'rdo_edicao', de:null, para:'RDO', motivo, obs});
      registrarEvento('rdo','atribuicao',at.id, progGid(x.programacao)+' · '+equipeLabel(findEquipe(at.equipeId)), 'Registro RDO editado · '+motivo+(obs? ' · '+obs:''));
      saveData(); renderContent(); toast('Registro RDO atualizado.');
    }
  });
}

function printRDOCompleto(x){
  const pr = findProjeto(x.programacao.projetoId);
  const eq = findEquipe(x.atribuicao.equipeId);
  const rdo = x.atribuicao.rdoRespostas||{};
  const res = rdoResumo(x);
  const imped = rdoImpedimentos(x.atribuicao);
  const av = pr? projetoAvanco(pr) : null;
  const geradoPor = CURRENT_USER ? ((CURRENT_USER.nome||'') + (CURRENT_USER.login? ' ('+CURRENT_USER.login+')':'') || 'Sistema') : 'Sistema';
  const horarios = RDO_HORARIOS.map(h=>`<tr><td style="border:1px solid #999;padding:4px 8px;font-weight:600;background:#f5f5f5;">${h.label}</td><td style="border:1px solid #999;padding:4px 8px;">${x.atribuicao[h.k]||'—'}</td></tr>`).join('');
  const condicoes = RDO_QUESTIONS.map(q=>`<tr><td style="border:1px solid #999;padding:4px 8px;font-weight:600;background:#f5f5f5;">${q.label}</td><td style="border:1px solid #999;padding:4px 8px;">${String(rdo[q.id]||'')||'—'}</td></tr>`).join('');
  const impedHtml = imped.length? imped.map(i=>`<span style="display:inline-block;border:1px solid #d95555;color:#b33;background:#fdecec;border-radius:4px;padding:2px 8px;margin:2px 3px 2px 0;">${esc(i)}</span>`).join('') : '—';
  const ativRows = (x.atribuicao.atividades||[]).map((a,idx)=>{
    const at = findAtividade(a.atividadeId);
    const p = parseFloat(a.quantidadePrevista)||0;
    const e = a.quantidadeExecutada==null? null : parseFloat(a.quantidadeExecutada);
    const pct = p? Math.round((e||0)/p*100) : 0;
    const vu = at?.valorUnitario||0;
    const execVal = e!=null? e*vu : 0;
    const fotos = String(a.fotos||'').split(';;').filter(Boolean);
    const fotosHtml = fotos.length? `<div class="fotos">${fotos.map(u=>`<figure><img src="${esc(u)}" alt="Foto da execução da atividade ${idx+1}"><figcaption>Atividade ${at?.codigo||idx+1} — foto ${idx+1}</figcaption></figure>`).join('')}</div>` : '<div style="color:#999;">Sem fotos registradas.</div>';
    return `<tr>
      <td style="border:1px solid #999;padding:4px 8px;text-align:center;">${idx+1}</td>
      <td style="border:1px solid #999;padding:4px 8px;" class="mono">${esc(at?.codigo||'?')}</td>
      <td style="border:1px solid #999;padding:4px 8px;">${esc(at?.descricao||'')}</td>
      <td style="border:1px solid #999;padding:4px 8px;text-align:center;">${esc(at?.unidade||'')}</td>
      <td style="border:1px solid #999;padding:4px 8px;text-align:center;">${p? fmtNum(p):'—'}</td>
      <td style="border:1px solid #999;padding:4px 8px;text-align:center;"><strong>${e!=null? fmtNum(e):'—'}</strong></td>
      <td style="border:1px solid #999;padding:4px 8px;text-align:center;font-weight:700;color:${pct>=100?'#1c7d1c':pct>=50?'#b8860b':'#b33'};">${p? pct+'%':'—'}</td>
      <td style="border:1px solid #999;padding:4px 8px;text-align:right;">${fmtMoney(execVal)}</td>
    </tr><tr><td colspan="8" style="border:1px solid #999;padding:8px;background:#fafafa;">${fotosHtml}</td></tr>`;
  }).join('') || '<tr><td colspan="8" style="border:1px solid #999;padding:4px 8px;">Sem atividades registradas.</td></tr>';
  const hist = x.atribuicao.historico||[];
  const histRows = hist.length? hist.slice().reverse().map(h=>`<tr>
      <td style="border:1px solid #999;padding:4px 8px;">${fmtDateTime(h.ts)}</td>
      <td style="border:1px solid #999;padding:4px 8px;">${esc(h.tipo||'—')}</td>
      <td style="border:1px solid #999;padding:4px 8px;">${esc(h.de||'—')}</td>
      <td style="border:1px solid #999;padding:4px 8px;">${esc(h.para||'—')}</td>
      <td style="border:1px solid #999;padding:4px 8px;">${esc(h.motivo||'—')}</td>
      <td style="border:1px solid #999;padding:4px 8px;">${esc(h.usuarioNome||'—')}${h.usuarioLogin? ' ('+esc(h.usuarioLogin)+')':''}</td>
    </tr>`).join('') : '<tr><td colspan="6" style="border:1px solid #999;padding:4px 8px;color:#999;">Sem registros de histórico.</td></tr>';

  const w = window.open('', '_blank', 'width=1100,height=800');
  if(!w) return;
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>RDO ${progGid(x.programacao)} — ${esc(pr?.codigo||'')}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#222;margin:24px 30px;}
    h1{font-size:18px;margin:0 0 2px;}
    h2{font-size:14px;margin:18px 0 6px;border-bottom:2px solid #444;padding-bottom:3px;}
    h3{font-size:12.5px;margin:12px 0 4px;}
    .meta{color:#555;font-size:11.5px;margin:2px 0;}
    .grid{display:flex;gap:40px;flex-wrap:wrap;}
    table{border-collapse:collapse;width:100%;}
    th{background:#eee;text-align:left;padding:4px 8px;border:1px solid #999;}
    td{padding:4px 8px;border:1px solid #999;}
    .mono{font-family:Consolas,monospace;font-size:11px;}
    .fotos{display:flex;flex-wrap:wrap;gap:12px;}
    .fotos figure{margin:0;width:210px;border:1px solid #ccc;border-radius:4px;padding:6px;background:#fff;}
    .fotos img{width:100%;height:auto;border-radius:3px;}
    .fotos figcaption{font-size:10px;color:#666;margin-top:4px;}
    .assin{display:flex;gap:60px;margin-top:46px;}
    .assin div{flex:1;text-align:center;font-size:11px;color:#555;}
    .assin .linha{border-top:1px solid #333;padding-top:6px;margin-top:34px;}
    .badge-print{display:inline-block;border:1px solid #999;border-radius:4px;padding:2px 8px;font-size:11px;}
  </style></head><body>
    <h1>Relatório de RDO — Detalhes da Execução</h1>
    <p class="meta">Programação ${progGid(x.programacao)} · Ciclo ${esc(x.programacao.ciclo||'—')} · Data programada ${fmtDate(x.atribuicao.dataProgramada)}</p>
    <p class="meta">Gerado por: <strong>${esc(geradoPor)}</strong> em ${fmtDateTime(Date.now())} · Status: ${esc(x.atribuicao.status||'Programado')}</p>

    <h2>Dados gerais do projeto</h2>
    <div class="grid">
      <div>
        <p class="meta"><strong>${esc(pr?.nome||'—')}</strong> (${esc(pr?.codigo||'—')})</p>
        <p class="meta">Setor: ${esc(pr?.setor||'—')} · Coordenação: ${esc(pr?.coordenacao||'—')}</p>
        <p class="meta">Cidade: ${esc(pr?.cidade||'—')}</p>
        <p class="meta">Período: ${fmtDate(pr?.dataInicio)} → ${fmtDate(pr?.dataFim)}</p>
      </div>
      <div>
        <p class="meta">Valor orçado: <strong>${fmtMoney(pr?.valorOrcado||0)}</strong></p>
        <p class="meta">Valor executado: <strong>${fmtMoney(av?.valorExecutado||0)}</strong></p>
        <p class="meta">Avanço físico: <strong>${av? av.fisicoPct.toFixed(1)+'%' : '—'}</strong></p>
        <p class="meta">Avanço financeiro: <strong>${av? av.financeiroPct.toFixed(1)+'%' : '—'}</strong></p>
      </div>
    </div>

    <h2>Localização</h2>
    <p class="meta">Referência: <strong>${esc(pr?.cidade||'—')}</strong> · Setor ${esc(pr?.setor||'—')} · Coordenação ${esc(pr?.coordenacao||'—')}</p>

    <h2>Equipe executora</h2>
    <div class="grid">
      <div>
        <p class="meta"><strong>${esc(equipeLabel(eq))}</strong></p>
        <p class="meta">Supervisor: ${esc(eq?.supervisor||'—')}</p>
        <p class="meta">Encarregado: ${esc(eq?.encarregado||'—')}</p>
      </div>
      <div>
        <p class="meta">Motorista: ${esc(eq?.motorista||'—')}</p>
        <p class="meta">Eletricistas: ${esc((eq?.eletricistas||[]).filter(Boolean).join(', ')||'—')}</p>
        <p class="meta">WhatsApp: ${esc(eq?.whatsapp||'—')}</p>
      </div>
    </div>

    <h2>Horários do RDO</h2>
    <table>${horarios}</table>

    <h2>Condições do RDO</h2>
    <table>${condicoes}</table>
    <p class="meta" style="margin-top:8px;">Impedimentos: ${impedHtml}</p>

    <h2>Atividades executadas</h2>
    <p class="meta">Previsto: ${fmtNum(res.prev)} · Executado: <strong>${fmtNum(res.exec)}</strong> · Percentual: <strong>${res.pct}%</strong></p>
    <table>
      <thead><tr><th style="text-align:center;">#</th><th>Código</th><th>Descrição</th><th style="text-align:center;">Un.</th><th style="text-align:center;">Prev.</th><th style="text-align:center;">Exec.</th><th style="text-align:center;">%</th><th style="text-align:right;">Valor exec.</th></tr></thead>
      <tbody>${ativRows}</tbody>
    </table>

    <h2>Observação da execução</h2>
    <p>${esc(x.atribuicao.observacao)||'—'}</p>
    <p class="meta">Confirmado pela equipe em <strong>${rdoConfData(x)}</strong></p>

    ${(x.programacao.anexos&&x.programacao.anexos.length)? `<h2>Anexos do programador</h2>${anexosDisplayHtml(x.programacao.anexos, true)}`:''}

    <h2>Histórico do registro</h2>
    <table>
      <thead><tr><th>Data/Hora</th><th>Tipo</th><th>De</th><th>Para</th><th>Motivo</th><th>Autor</th></tr></thead>
      <tbody>${histRows}</tbody>
    </table>

    <div class="assin">
      <div>Supervisor<br><div class="linha">Assinatura e carimbo</div></div>
      <div>Encarregado<br><div class="linha">Assinatura e carimbo</div></div>
      <div>Responsável pelo projeto<br><div class="linha">Assinatura e carimbo</div></div>
    </div>
    <script>window.addEventListener('load',function(){setTimeout(function(){window.print();},800);});<\/script>
  </body></html>`);
  w.document.close();
}

function exportRDOExcel(registros){
  const linhas=[];
  registros.forEach(x=>{
    const pr = findProjeto(x.programacao.projetoId);
    const eq = findEquipe(x.atribuicao.equipeId);
    const rdo = x.atribuicao.rdoRespostas||{};
    const res = rdoResumo(x);
    const imped = rdoImpedimentos(x.atribuicao).join(', ');
    const base = {
        'Programação': progGid(x.programacao),
      'Projeto': pr?.nome||'—',
      'Código Projeto': pr?.codigo||'',
      'Ciclo': x.programacao.ciclo||'—',
      'Data Programada': fmtDate(x.atribuicao.dataProgramada),
      'Equipe': equipeLabel(eq),
      'Supervisor': eq?.supervisor||'',
      'Status': x.atribuicao.status||'Programado',
      'Quantidade Prevista': res.prev,
      'Quantidade Executada': res.exec,
      'Percentual': res.pct+'%',
      'Condições Climáticas': x.atribuicao.rdoCondicoes||'',
      'Impedimentos': imped,
      'Observação': x.atribuicao.observacao||'',
      'Confirmação': rdoConfData(x)
    };
    RDO_HORARIOS.forEach(h=> base[h.label]= x.atribuicao[h.k]||'');
    const detalhe = (x.atribuicao.atividades||[]).map((a,idx)=>{
      const at = findAtividade(a.atividadeId);
      const p = parseFloat(a.quantidadePrevista)||0;
      const e = a.quantidadeExecutada==null? null : parseFloat(a.quantidadeExecutada);
      return {
      'Programação': progGid(x.programacao),
        'Projeto': pr?.nome||'—',
        'Código Projeto': pr?.codigo||'',
        'Ciclo': x.programacao.ciclo||'—',
        'Data Programada': fmtDate(x.atribuicao.dataProgramada),
        'Equipe': equipeLabel(eq),
        'Supervisor': eq?.supervisor||'',
        'Status': x.atribuicao.status||'Programado',
        '# Atividade': idx+1,
        'Código Atividade': at?.codigo||'—',
        'Descrição Atividade': at?.descricao||'',
        'Unidade': at?.unidade||'',
        'Qtd Prevista Atividade': a.quantidadePrevista||'',
        'Qtd Executada Atividade': e!=null? e:'',
        'Percentual Atividade': p? Math.round((e||0)/p*100)+'%':'',
        'Fotos Atividade': a.fotos||''
      };
    });
    if(detalhe.length){
      linhas.push(...detalhe);
    }else{
      linhas.push(base);
    }
  });
  const cols = linhas.length? Object.keys(linhas[0]) : ['Programação','Projeto'];
  const escape = v=> String(v??'').replace(/"/g,'""');
  let csv = '\ufeff' + cols.join(';') + '\n';
  linhas.forEach(l=>{ csv += cols.map(c=> `"${escape(l[c])}"`).join(';') + '\n'; });
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rdo_execucoes_${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Exportação gerada.');
}

function printRDOReport(registros){
  const w = window.open('', '_blank', 'width=1100,height=800');
  if(!w) return;
  const rows = registros.map((x,i)=>{
    const pr = findProjeto(x.programacao.projetoId);
    const eq = findEquipe(x.atribuicao.equipeId);
    const res = rdoResumo(x);
    const imped = rdoImpedimentos(x.atribuicao).join(', ');
    return `<tr>
      <td style="border:1px solid #999;padding:4px 6px;">${i+1}</td>
      <td style="border:1px solid #999;padding:4px 6px;">${esc(pr?.nome||'—')}</td>
      <td style="border:1px solid #999;padding:4px 6px;">${esc(equipeLabel(eq))}</td>
      <td style="border:1px solid #999;padding:4px 6px;">${fmtDate(x.atribuicao.dataProgramada)}</td>
      <td style="border:1px solid #999;padding:4px 6px;">${x.atribuicao.status||'Programado'}</td>
      <td style="border:1px solid #999;padding:4px 6px;">${x.atribuicao.rdoHorarioChegada||'—'} → ${x.atribuicao.rdoHorarioSaidaObra||'—'}</td>
      <td style="border:1px solid #999;padding:4px 6px;">${x.atribuicao.rdoCondicoes||'—'}</td>
      <td style="border:1px solid #999;padding:4px 6px;">${imped||'—'}</td>
      <td style="border:1px solid #999;padding:4px 6px;text-align:right;">${fmtNum(res.exec)}</td>
      <td style="border:1px solid #999;padding:4px 6px;text-align:right;">${res.pct}%</td>
    </tr>`;
  }).join('');
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>RDO — Execução das equipes</title></head><body style="font-family:Arial,sans-serif;font-size:12px;">
    <h2 style="margin:0 0 4px;">RDO — Relatório de Execução das Equipes</h2>
    <p style="margin:0 0 16px;color:#555;">Gerado em ${fmtDateTime(Date.now())} · ${registros.length} registro(s)</p>
    <table style="border-collapse:collapse;width:100%;">
      <thead><tr style="background:#eee;">
        <th style="border:1px solid #999;padding:4px 6px;text-align:left;">#</th>
        <th style="border:1px solid #999;padding:4px 6px;text-align:left;">Projeto</th>
        <th style="border:1px solid #999;padding:4px 6px;text-align:left;">Equipe</th>
        <th style="border:1px solid #999;padding:4px 6px;text-align:left;">Data</th>
        <th style="border:1px solid #999;padding:4px 6px;text-align:left;">Status</th>
        <th style="border:1px solid #999;padding:4px 6px;text-align:left;">Horários</th>
        <th style="border:1px solid #999;padding:4px 6px;text-align:left;">Clima</th>
        <th style="border:1px solid #999;padding:4px 6px;text-align:left;">Impedimentos</th>
        <th style="border:1px solid #999;padding:4px 6px;text-align:right;">Exec.</th>
        <th style="border:1px solid #999;padding:4px 6px;text-align:right;">%</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <script>window.onload=function(){setTimeout(function(){window.print();},200);};<\/script>
  </body></html>`);
  w.document.close();
}