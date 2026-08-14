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
  return merged;
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
let progFilters = { projeto:'', equipe:'', status:'', ciclo:'', dataDe:'', dataAte:'', modo:'lista', calView:'mes', calDay:todayISO() };
let ativFilters = { q:'', fav:'' };
let equipeFilters = { q:'', status:'' };
let projFilters = { q:'', status:'' };
let avancoFilters = { q:'', status:'' };
let histFilters = { tipo:'', projeto:'' };
let calRef = new Date();
let CURRENT_USER = null;

/* =========================================================
   CONSTANTES DE DOMÍNIO
========================================================= */
const STATUS_PROG = ['Programado','Em Execução','Concluído','Reprogramado','Cancelado'];
const STATUS_COLOR = { 'Programado':'var(--blue)','Em Execução':'var(--accent)','Concluído':'var(--green)','Reprogramado':'var(--purple)','Cancelado':'var(--red)' };
const STATUS_PROJETO = ['Planejado','Em Andamento','Concluído','Cancelado'];
const MOTIVOS_REPROG = [
  'Condições climáticas','Falta de material','Falta de equipamento','Indisponibilidade de equipe',
  'Prioridade emergencial (urgência)','Solicitação da concessionária / cliente','Pendência de liberação / desligamento',
  'Falha de acesso ao local','Outro'
];
const CUSTOM_FIELD_TYPES = [{v:'texto',l:'Texto'},{v:'numero',l:'Número'},{v:'data',l:'Data'},{v:'select',l:'Lista (opções)'}];
const MODULOS_ADMIN = [{k:'equipes',l:'Equipes'},{k:'atividades',l:'Atividades'},{k:'projetos',l:'Projetos'},{k:'programacoes',l:'Programações'}];
const ROLES = [
  { v:'administrador', l:'Administrador', d:'Acesso total ao sistema' },
  { v:'supervisor', l:'Supervisor', d:'Programa, edita e acompanha execução' },
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
  { id:'equipes',     label:'Equipes',       sub:'Cadastro de equipes de campo', icon:'users' },
  { id:'atividades',  label:'Atividades',    sub:'Cadastro de códigos e valores unitários', icon:'list' },
  { id:'projetos',    label:'Projetos',      sub:'Cadastro de projetos', icon:'folder' },
  { id:'avanco',      label:'Avanço',        sub:'Progresso físico e financeiro', icon:'trend' },
  { id:'programacoes',label:'Programações',  sub:'Agenda, fluxo e reprogramação', icon:'calendar' },
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
};
function icon(name,size=16){ return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]||''}</svg>`; }

    function renderNav(){
      const nav = document.getElementById('nav');
      const items = NAV_ITEMS.filter(it=> it.id!=='admin' || (CURRENT_USER && CURRENT_USER.role==='administrador'));
      nav.innerHTML = items.map((it,i) => `${i===items.length-1?'<div class="nav-sep"></div>':''}<button class="nav-item ${currentView===it.id?'active':''}" data-view="${it.id}">${icon(it.icon)}<span>${it.label}</span></button>`).join('');
      nav.querySelectorAll('.nav-item').forEach(btn=> btn.addEventListener('click', ()=> setView(btn.dataset.view)));
    }
function setView(view){
  currentView = view;
  document.getElementById('sidebar').classList.remove('open');
  const meta = NAV_ITEMS.find(i=>i.id===view);
  document.getElementById('page-title').textContent = meta.label;
  document.getElementById('page-sub').textContent = meta.sub;
  renderNav(); renderTopbarActions(); renderContent(); renderBanner();
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
function todayISO(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function isLate(atrib){ return atrib.dataProgramada < todayISO() && !['Concluído','Cancelado'].includes(atrib.status); }
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
  return atividadesArr.map(a=>{ const at=findAtividade(a.atividadeId); return `${esc(at?.codigo||'?')} ×${a.quantidadePrevista??'—'}`; }).join(', ');
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
    ['Nome da equipe','Nome complementar','Supervisor','Encarregado','Motorista','Meta diária','Eletricistas','Situação'],
    DB.equipes.map(e=>[e.eqtl, e.prtn, e.supervisor, e.encarregado, e.motorista, e.metaDiaria||'', (e.eletricistas||[]).join(', '), e.ativo? 'Ativa':'Inativa']));
}
function exportAtividadesCSV(){
  exportCSV('atividades.csv',
    ['Código','Descrição','Unidade','Valor unitário','Favorita'],
    DB.atividades.map(a=>[a.codigo, a.descricao, a.unidade||'', fmtMoney(a.valorUnitario), a.fav? 'Sim':'Não']));
}
function exportProjetosCSV(){
  exportCSV('projetos.csv',
    ['Código','Nome','Início','Fim','Setor','Coordenação','Ciclo','Status','Orçado (R$)','Executado (R$)','Restante (R$)','% Físico','% Financeiro','Atividades concluídas','Atividades totais'],
    DB.projetos.map(p=>{
      const av = projetoAvanco(p);
      return [p.codigo, p.nome, fmtDate(p.dataInicio), fmtDate(p.dataFim), p.setor||'', p.coordenacao||'', p.ciclo||'', p.status, fmtMoney(av.valorOrcado), fmtMoney(av.valorExecutado), fmtMoney(av.restante), av.fisicoPct.toFixed(1)+'%', av.financeiroPct.toFixed(1)+'%', av.concluidoLinhas, av.totalLinhas];
    }));
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
    DB.projetos.map(p=>{
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
  DB.programacoes.forEach(pg=> (pg.atribuicoes||[]).forEach(at=> out.push({ programacao: pg, atribuicao: at })));
  return out;
}
function pendingList(){
  return flatAtribuicoes().filter(x=> isLate(x.atribuicao));
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
function openModal({title, bodyHtml, onMount, onSubmit, submitLabel='Salvar', wide=false}){
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal" style="${wide?'max-width:660px':''}">
        <div class="modal-head"><h3>${title}</h3><button class="icon-btn" id="modal-close">${icon('close')}</button></div>
        <form id="modal-form">
          <div class="modal-body">${bodyHtml}</div>
          <div class="modal-foot"><button type="button" class="btn btn-ghost" id="modal-cancel">Cancelar</button><button type="submit" class="btn btn-primary">${submitLabel}</button></div>
        </form>
      </div>
    </div>`;
  const close = ()=>{ root.innerHTML=''; };
  document.getElementById('modal-close').addEventListener('click', close);
  document.getElementById('modal-cancel').addEventListener('click', close);
  document.getElementById('modal-overlay').addEventListener('click', (e)=>{ if(e.target.id==='modal-overlay') close(); });
  document.getElementById('modal-form').addEventListener('submit', (e)=>{ e.preventDefault(); const ok = onSubmit(new FormData(e.target), e.target); if(ok!==false) close(); });
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
        document.querySelectorAll('.exec-qty').forEach(inp=>{ atrib.atividades[Number(inp.dataset.idx)].quantidadeExecutada = parseFloat(inp.value)||0; });
        const de = atrib.status;
        atrib.status='Concluído';
        atrib.historico = atrib.historico||[];
        atrib.historico.push({ts:Date.now(), tipo:'confirmacao', de, para:'Concluído', motivo:'Execução confirmada pelo usuário (SIM)'});
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
        atrib.historico.push({ts:Date.now(), tipo:'reprogramacao', de:dataAntiga, para:novaData, motivo, obs});
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
  const equipesAtivas = DB.equipes.filter(e=>e.ativo).length;
  const projetosAndamento = DB.projetos.filter(p=>p.status==='Em Andamento').length;
  const progHoje = flat.filter(x=> x.atribuicao.dataProgramada===hoje && x.atribuicao.status!=='Cancelado').length;
  const atrasadas = flat.filter(x=> isLate(x.atribuicao)).length;
  const concluidas = flat.filter(x=> x.atribuicao.status==='Concluído').length;
  const valorOrcadoTotal = DB.projetos.reduce((s,p)=> s + (p.valorOrcado||0), 0);
  const valorExecutadoTotal = DB.projetos.reduce((s,p)=> s + projetoAvanco(p).valorExecutado, 0);

  const proximas = flat.filter(x=>!['Concluído','Cancelado'].includes(x.atribuicao.status))
    .sort((a,b)=> a.atribuicao.dataProgramada.localeCompare(b.atribuicao.dataProgramada)).slice(0,7);

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
      <span style="font-size:12px;color:var(--muted);">Filtro padrão:</span>
      <span class="badge" style="color:var(--teal);background:rgba(87,199,199,.12);font-size:11px;">${cicloAtivo? 'Ciclo '+cicloAtivo : 'Todos os ciclos'}</span>
      ${cicloAtivo? `<span style="font-size:11.5px;color:var(--muted-2);">maior ciclo cadastrado com programações concluídas — vale para todas as telas com filtro</span>`:''}
    </div>
    <div class="grid-stats">
      <div class="stat-card clickable" data-go="equipes" style="--accent-c:var(--blue)"><div class="lbl">Equipes ativas</div><div class="val">${equipesAtivas}<small> / ${DB.equipes.length}</small></div></div>
      <div class="stat-card clickable" data-go="projetos" style="--accent-c:var(--teal)"><div class="lbl">Projetos em andamento</div><div class="val">${projetosAndamento}<small> / ${DB.projetos.length}</small></div></div>
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
              <td>${statusBadge(p.status, late)}</td>
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
   VIEW: EQUIPES
========================================================= */
function renderEquipes(){
  const el = document.getElementById('content');
  if(!DB.equipes.length){ el.innerHTML = emptyState('Nenhuma equipe cadastrada', 'Cadastre equipes de campo informando o nome da equipe, supervisor, encarregado, motorista, meta diária e eletricistas.'); bindEmptyCta(el, ()=>openEquipeModal()); return; }
  const list = DB.equipes.filter(e=>{
    if(equipeFilters.status==='ativa' && !e.ativo) return false;
    if(equipeFilters.status==='inativa' && e.ativo) return false;
    if(equipeFilters.q){ const t=(e.eqtl+' '+(e.prtn||'')+' '+(e.supervisor||'')+' '+(e.encarregado||'')+' '+(e.motorista||'')+' '+(e.eletricistas||[]).join(' ')).toLowerCase(); if(!t.includes(equipeFilters.q.toLowerCase())) return false; }
    return true;
  });
  el.innerHTML = `
    <div class="panel-head" style="padding:0;margin-bottom:16px;border:none;">
      <div class="filters">
        <input id="f-eq-q" placeholder="Buscar equipe (nome, supervisor, encarregado…)…" value="${esc(equipeFilters.q)}">
        <select id="f-eq-status"><option value="">Todas as situações</option><option value="ativa" ${equipeFilters.status==='ativa'?'selected':''}>Ativas</option><option value="inativa" ${equipeFilters.status==='inativa'?'selected':''}>Inativas</option></select>
      </div>
      <span style="font-size:12px;color:var(--muted);">${list.length} de ${DB.equipes.length} equipes</span>
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
        <div style="margin-top:8px;font-size:12px;color:var(--muted);"><span class="crew-status-dot ${eq.ativo?'':'off'}"></span>${eq.ativo? 'Ativa':'Inativa'}</div>
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
    <div class="field"><label>Meta diária (R$)</label><input type="number" step="0.01" min="0" name="metaDiaria" value="${eq?.metaDiaria??''}" placeholder="0,00"><div class="field-hint">Se a programação do dia ficar abaixo deste valor, o sistema alerta na programação.</div></div>
    <div class="field"><label>Eletricistas</label><input type="text" name="eletricistas" value="${esc((eq?.eletricistas||[]).join(', '))}" placeholder="Separe por vírgula: Fulano, Ciclano"><div class="field-hint">Separe os nomes por vírgula.</div></div>
    ${renderCustomFieldsInputs('equipes', eq)}
    <div class="field" style="flex-direction:row;align-items:center;gap:8px;"><input type="checkbox" name="ativo" id="eq-ativo" style="width:auto;" ${eq? (eq.ativo?'checked':'') : 'checked'}><label for="eq-ativo" style="margin:0;">Equipe ativa</label></div>
  `;
  openModal({
    title: eq? `Editar equipe` : 'Nova equipe', bodyHtml: body, submitLabel: eq? 'Salvar alterações' : 'Cadastrar equipe',
    onSubmit:(fd)=>{
      const eqtl = fd.get('eqtl').trim(), prtn = fd.get('prtn').trim();
      if(!eqtl && !prtn){ toast('Preencha ao menos o nome da equipe.', 'error'); return false; }
      const data = { eqtl, prtn, supervisor: fd.get('supervisor').trim(), encarregado: fd.get('encarregado').trim(), motorista: fd.get('motorista').trim(), metaDiaria: parseFloat(fd.get('metaDiaria'))||0,
        eletricistas: fd.get('eletricistas').split(',').map(s=>s.trim()).filter(Boolean), ativo: fd.get('ativo')==='on', custom: parseCustomFieldsFromForm('equipes', fd) };
      if(eq){ Object.assign(eq, data); toast('Equipe atualizada.'); } else { data.id = nextId(); DB.equipes.push(data); toast('Equipe cadastrada.'); }
      saveData(); renderContent();
    }
  });
}
    function deleteEquipe(id){
      if(!requerEscrita()) return;
      id = Number(id);
  const inUse = flatAtribuicoes().some(x=>x.atribuicao.equipeId===id);
  if(inUse){ toast('Equipe possui programações vinculadas. Remova ou reatribua antes de excluir.', 'error'); return; }
  if(!confirm('Excluir esta equipe?')) return;
  DB.equipes = DB.equipes.filter(e=>e.id!==id); saveData(); renderContent(); toast('Equipe excluída.');
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
      if(at){ Object.assign(at, data); toast('Atividade atualizada.'); } else { data.id = nextId(); DB.atividades.push(data); toast('Atividade cadastrada.'); }
      saveData(); renderContent();
    }
  });
}
    function deleteAtividade(id){
      if(!requerEscrita()) return;
      id = Number(id);
  const inUse = flatAtribuicoes().some(x=>x.atribuicao.atividades.some(a=>a.atividadeId===id));
  if(inUse){ toast('Atividade possui programações vinculadas. Não é possível excluir.', 'error'); return; }
  if(!confirm('Excluir esta atividade?')) return;
  DB.atividades = DB.atividades.filter(a=>a.id!==id); saveData(); renderContent(); toast('Atividade excluída.');
}

/* =========================================================
   VIEW: PROJETOS
========================================================= */
function renderProjetos(){
  const el = document.getElementById('content');
  if(!DB.projetos.length){ el.innerHTML = emptyState('Nenhum projeto cadastrado', 'Cadastre projetos de construção ou manutenção para agrupar as programações.'); bindEmptyCta(el, ()=>openProjetoModal()); return; }
  const customFields = DB.customFields.projetos||[];
  const list = DB.projetos.filter(p=>{
    if(projFilters.status && p.status!==projFilters.status) return false;
    if(projFilters.q){ const t=(p.codigo+' '+(p.nome||'')+' '+(p.descricao||'')+' '+(p.ciclo||'')+' '+(p.setor||'')+' '+(p.coordenacao||'')).toLowerCase(); if(!t.includes(projFilters.q.toLowerCase())) return false; }
    return true;
  });
  el.innerHTML = `
    <div class="panel-head" style="padding:0;margin-bottom:16px;border:none;">
      <div class="filters">
        <input id="f-pj-q" placeholder="Buscar projeto…" value="${esc(projFilters.q)}">
        <select id="f-pj-status"><option value="">Todos os status</option>${STATUS_PROJETO.map(s=>`<option ${projFilters.status===s?'selected':''}>${s}</option>`).join('')}</select>
      </div>
      <span style="font-size:12px;color:var(--muted);">${list.length} de ${DB.projetos.length} projetos</span>
    </div>
    <div class="panel"><div class="table-scroll"><table>
      <thead><tr><th>Código</th><th>Projeto</th><th>Período</th><th>Setor · Coordenação</th><th>Ciclo</th><th>Orçado</th><th>Avanço</th><th>Status</th><th>Programações</th>${customFields.map(f=>`<th>${esc(f.label)}</th>`).join('')}<th></th></tr></thead>
      <tbody>${list.map(p=>{
      const count = DB.programacoes.filter(x=>x.projetoId===p.id).reduce((s,pg)=>s+(pg.atribuicoes?.length||0),0);
      const av = projetoAvanco(p);
      return `<tr>
        <td class="mono">${esc(p.codigo)}</td>
        <td><strong>${esc(p.nome)}</strong><div style="color:var(--muted-2);font-size:11.5px;margin-top:2px;">${esc(p.descricao||'')}</div></td>
        <td class="mono" style="font-size:12px;">${fmtDate(p.dataInicio)} → ${fmtDate(p.dataFim)}</td>
        <td style="font-size:12px;">${esc(p.setor||'—')}<div style="color:var(--muted-2);font-size:11px;">${esc(p.coordenacao||'—')}</div></td>
        <td><span class="badge" style="color:var(--teal);background:rgba(87,199,199,.12);">${esc(p.ciclo||'—')}</span></td>
        <td class="mono">${fmtMoney(p.valorOrcado||0)}</td>
        <td style="min-width:130px;">${progBarHtml(av.fisicoPct,{thin:true})}<div style="font-size:10.5px;color:var(--muted);margin-top:3px;">${av.fisicoPct.toFixed(1)}% · ${av.concluidoLinhas}/${av.totalLinhas}</div></td>
        <td>${projStatusBadge(p.status)}</td><td>${count}</td>
        ${customFields.map(f=>`<td>${esc(p.custom?.[f.id]||'—')}</td>`).join('')}
        <td><div class="row-actions"><button class="icon-btn" title="Ver avanço" data-avanco-detalhe="${p.id}">${icon('trend',14)}</button><button class="icon-btn" data-edit-pj="${p.id}">${icon('edit',14)}</button><button class="icon-btn" data-del-pj="${p.id}">${icon('trash',14)}</button></div></td>
      </tr>`;
    }).join('') || `<tr class="empty-row"><td colspan="${10+customFields.length}">Nenhum projeto encontrado com os filtros.</td></tr>`}</tbody></table></div></div>`;
  document.getElementById('f-pj-q').addEventListener('input', e=>{ projFilters.q=e.target.value; renderContent(); });
  document.getElementById('f-pj-status').addEventListener('change', e=>{ projFilters.status=e.target.value; renderContent(); });
  el.querySelectorAll('[data-avanco-detalhe]').forEach(b=>b.addEventListener('click', ()=>openAvancoDetalhe(b.dataset.avancoDetalhe)));
  el.querySelectorAll('[data-edit-pj]').forEach(b=>b.addEventListener('click', ()=>openProjetoModal(b.dataset.editPj)));
  el.querySelectorAll('[data-del-pj]').forEach(b=>b.addEventListener('click', ()=>deleteProjeto(b.dataset.delPj)));
}
function projStatusBadge(status){
  const colors = {'Planejado':'var(--blue)','Em Andamento':'var(--accent)','Concluído':'var(--green)','Cancelado':'var(--red)'};
  const c = colors[status]||'var(--muted)';
  return `<span class="badge" style="color:${c};background:${bgFromVar(c)}"><span class="badge-dot"></span>${status}</span>`;
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
      <div class="field"><label>Setor <span class="req">*</span></label><select name="setor" required><option value="">Selecione…</option><option ${pj?.setor==='MANUTENÇÃO'?'selected':''}>MANUTENÇÃO</option><option ${pj?.setor==='OBRAS'?'selected':''}>OBRAS</option></select></div>
      <div class="field"><label>Coordenação <span class="req">*</span></label><select name="coordenacao" required><option value="">Selecione…</option><option ${pj?.coordenacao==='RIO VERDE'?'selected':''}>RIO VERDE</option><option ${pj?.coordenacao==='QUIRINOPOLIS'?'selected':''}>QUIRINOPOLIS</option></select></div>
    </div>
    <div class="field"><label>Valor orçado (R$)</label><input type="number" step="0.01" min="0" name="valorOrcado" value="${pj?.valorOrcado??''}" placeholder="0,00"><div class="field-hint">O avanço financeiro é calculado conforme as atividades concluídas pelas equipes.</div></div>
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
      const data = { codigo: fd.get('codigo').trim(), nome: fd.get('nome').trim(), descricao: fd.get('descricao').trim(), dataInicio: fd.get('dataInicio'), dataFim: fd.get('dataFim'), setor: fd.get('setor'), coordenacao: fd.get('coordenacao'), status: fd.get('status'), valorOrcado: parseFloat(fd.get('valorOrcado'))||0, ciclo, planoFisico: (planoEditor? planoEditor.getData() : []).map(x=>({atividadeId:x.atividadeId, quantidade:x.quantidadePrevista})), custom: parseCustomFieldsFromForm('projetos', fd) };
      if(pj){ Object.assign(pj, data); toast('Projeto atualizado.'); } else { data.id = nextId(); DB.projetos.push(data); toast('Projeto cadastrado.'); }
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
  const inUse = DB.programacoes.some(p=>p.projetoId===id);
  if(inUse){ toast('Projeto possui programações vinculadas. Não é possível excluir.', 'error'); return; }
  if(!confirm('Excluir este projeto?')) return;
  DB.projetos = DB.projetos.filter(p=>p.id!==id); saveData(); renderContent(); toast('Projeto excluído.');
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
  if(!DB.projetos.length) return '';
  return `<div class="panel section-gap">
    <div class="panel-head"><h3>Avanço dos projetos</h3><button class="btn btn-sm btn-ghost" id="go-avanco">Ver módulo →</button></div>
    <div class="table-scroll"><table>
      <thead><tr><th>Projeto</th><th>Orçado</th><th>Executado</th><th>Avanço físico</th><th>%</th></tr></thead>
      <tbody>${DB.projetos.map(p=>{
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
  if(!DB.projetos.length){ el.innerHTML = emptyState('Nenhum projeto cadastrado', 'Cadastre projetos para acompanhar o avanço físico e financeiro conforme as atividades concluídas pelas equipes.'); bindEmptyCta(el, ()=>setView('projetos')); return; }
  const list = DB.projetos.filter(p=>{
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
      <span style="font-size:12px;color:var(--muted);">${list.length} de ${DB.projetos.length} projetos</span>
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
  if(!DB.projetos.length || !DB.atividades.length || !DB.equipes.length){
    el.innerHTML = emptyState('Cadastre projetos, atividades e equipes primeiro', 'Uma programação vincula um projeto, uma ou mais equipes (cada uma com suas atividades e quantidades) a uma data.');
    return;
  }
  const list = programacoesFiltradas();
  el.innerHTML = `
    <div class="panel-head" style="padding:0;margin-bottom:16px;border:none;">
      <div class="filters">
        <select id="f-projeto"><option value="">Todos os projetos</option>${DB.projetos.map(p=>`<option value="${p.id}" ${progFilters.projeto==String(p.id)?'selected':''}>${esc(p.codigo)} · ${esc(p.nome)}</option>`).join('')}</select>
        <select id="f-equipe"><option value="">Todas as equipes</option>${DB.equipes.map(e=>`<option value="${e.id}" ${progFilters.equipe==String(e.id)?'selected':''}>${equipeLabel(e)}${e.encarregado? ' — '+esc(e.encarregado):''}</option>`).join('')}</select>
        <select id="f-status"><option value="">Todos os status</option>${STATUS_PROG.map(s=>`<option ${progFilters.status===s?'selected':''}>${s}</option>`).join('')}</select>
        <select id="f-ciclo"><option value="">Todos os ciclos</option>${ciclosUnicos().map(c=>`<option ${progFilters.ciclo===c?'selected':''}>${c}</option>`).join('')}</select>
        <input type="date" id="f-data-de" value="${progFilters.dataDe}" title="Data inicial">
        <span style="color:var(--muted);font-size:12px;">até</span>
        <input type="date" id="f-data-ate" value="${progFilters.dataAte}" title="Data final">
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
  el.querySelectorAll('.tab').forEach(t=>t.addEventListener('click', ()=>{progFilters.modo=t.dataset.modo; renderContent();}));

  const area = document.getElementById('prog-area');
  if(progFilters.modo==='calendario'){ renderProgCalendarioInto(area, list); return; }
  if(!list.length){
    if(progFilters.ciclo){ progFilters.ciclo=''; renderProgramacoes(); return; }
    area.innerHTML = DB.programacoes.length
      ? emptyState('Nenhuma programação encontrada', 'Ajuste os filtros para ver as programações.')
      : emptyState('Nenhuma programação cadastrada', 'Clique em "Nova programação" para criar a primeira.');
    return;
  }
  if(progFilters.modo==='lista') renderProgListaInto(area, list); else renderProgFluxoInto(area, list);
}

function renderProgListaInto(area, list){
  area.innerHTML = `<div class="panel"><div class="table-scroll"><table>
    <thead><tr><th>Data</th><th>Projeto</th><th>Ciclo</th><th>Equipe</th><th>Equipe comp.</th><th>Atividades</th><th>Valor prev.</th><th>Status</th><th></th></tr></thead>
    <tbody>${list.map(x=>{
      const p=x.atribuicao, pr=findProjeto(x.programacao.projetoId), eq=findEquipe(p.equipeId), late=isLate(p);
      const valPrev = p.atividades.reduce((s,a)=> s + (a.quantidadePrevista||0)*(findAtividade(a.atividadeId)?.valorUnitario||0), 0);
      const metaWarn = metaWarningHtml(p);
      return `<tr>
        <td class="mono">${fmtDate(p.dataProgramada)} ${late?`<div class="blink-red" style="font-size:10.5px;">VENCIDA</div>`:''}</td>
        <td>${esc(pr?.nome||'—')}<div style="color:var(--muted-2);font-size:11px;">${esc(pr?.setor||'')} · ${esc(pr?.coordenacao||'')}</div></td>
        <td><span class="badge" style="color:var(--teal);background:rgba(87,199,199,.12);font-size:10.5px;">${esc(x.programacao.ciclo||'—')}</span></td>
        <td><span class="badge-prefix">${eqtlLabel(eq)}</span></td>
        <td><span class="badge-prefix">${prtnLabel(eq)}</span>${metaWarn? `<div style="margin-top:4px;">${metaWarn}</div>`:''}</td>
        <td style="font-size:12px;color:var(--muted);">${atividadesResumo(p.atividades)}</td>
        <td class="mono">${fmtMoney(valPrev)}</td>
        <td>${statusBadge(p.status, late)}</td>
        <td><div class="row-actions">
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
          <div class="kc-meta"><span>${fmtDate(p.dataProgramada)}</span><span class="mono" style="color:var(--muted);">${p.atividades.length} ativ. · ${fmtMoney(valPrev)}</span></div>
          ${metaWarn? `<div class="kc-meta" style="justify-content:flex-start;">${metaWarn}</div>`:''}
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
    function setAtribStatusGlobal(atribId, status){
      if(!requerEscrita()) return;
      const atrib = findAtribuicaoGlobal(atribId);
  if(!atrib || atrib.status===status) return;
  const de = atrib.status;
  atrib.status = status;
  atrib.historico = atrib.historico||[];
  atrib.historico.push({ts:Date.now(), tipo:'status', de, para:status, motivo:null});
  saveData(); renderContent(); renderBanner(); toast('Status alterado para '+status+'.');
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
        <div><h3>${esc(pr?.nome||'—')}</h3><div class="admin-field-meta">${esc(pr?.codigo||'')} · ${esc(x.programacao.ciclo||'')} · ${equipeLabel(eq)} · ${fmtDate(p.dataProgramada)}</div></div>
        <div style="display:flex;align-items:center;gap:8px;">${metaWarningHtml(p)}${statusBadge(p.status, late)}</div>
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
  const body = `
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <strong style="font-size:15px;">${esc(pr?.nome||'—')}</strong>
          ${projStatusBadge(pr?.status)}
        </div>
        <div class="admin-field-meta" style="margin-top:2px;">${esc(pr?.codigo||'')} · ${esc(pr?.setor||'')} · ${esc(pr?.coordenacao||'')} · Ciclo: ${esc(programacao.ciclo||'—')} · Orçado: ${fmtMoney(pr?.valorOrcado||0)} · Avanço físico: ${av.fisicoPct.toFixed(1)}%</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;background:var(--panel-2);border:1px solid var(--border);border-radius:8px;padding:12px;">
        <div><div style="font-size:10.5px;color:var(--muted);text-transform:uppercase;">Equipe</div><div class="badge-prefix" style="margin-top:4px;">${equipeLabel(eq)}</div>${metaWarningHtml(atrib)? `<div style="margin-top:6px;">${metaWarningHtml(atrib)}</div>`:''}</div>
        <div><div style="font-size:10.5px;color:var(--muted);text-transform:uppercase;">Data programada</div><div class="mono" style="margin-top:5px;">${fmtDate(atrib.dataProgramada)}</div></div>
        <div><div style="font-size:10.5px;color:var(--muted);text-transform:uppercase;">Encarregado</div><div style="margin-top:4px;font-size:12.5px;">${esc(eq?.encarregado||'—')}</div></div>
        <div><div style="font-size:10.5px;color:var(--muted);text-transform:uppercase;">Status</div><div style="margin-top:4px;">${statusBadge(atrib.status, late)}</div></div>
      </div>
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
        <tr style="font-weight:700;"><td colspan="6" style="text-align:right;">Totais</td><td class="mono">${fmtMoney(totPrev)}</td><td class="mono">${fmtMoney(totExec)}</td></tr>
        </tbody>
      </table></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <span style="font-size:12px;color:var(--muted);margin-right:4px;">Alterar status:</span>
        ${STATUS_PROG.filter(s=>s!==atrib.status).map(s=>`<button type="button" class="btn btn-sm" data-set-status="${s}">→ ${s}</button>`).join('')}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid var(--border-soft);padding-top:12px;">
        <button type="button" class="btn btn-sm" data-edit-detail="${programacao.id}">${icon('edit',13)} Editar programação</button>
        <button type="button" class="btn btn-sm" data-doc-detail="${programacao.id}">${icon('print',13)} Documento de campo</button>
        <button type="button" class="btn btn-sm" data-reprog-detail="${programacao.id}|${atrib.id}">${icon('reprog',13)} Reprogramar</button>
        <button type="button" class="btn btn-sm" data-hist-detail="${atrib.id}">${icon('history',13)} Histórico</button>
      </div>
    </div>`;
  openModal({ title:'Detalhe da programação', bodyHtml: body, submitLabel:'Fechar', wide:true,
    onMount:(root)=>{
      root.querySelectorAll('[data-set-status]').forEach(b=>b.addEventListener('click', ()=>{
        if(!requerEscrita()) return;
        const de = atrib.status; atrib.status = b.dataset.setStatus; atrib.historico = atrib.historico||[];
        atrib.historico.push({ts:Date.now(), tipo:'status', de, para:atrib.status, motivo:null}); saveData();
        document.getElementById('modal-overlay')?.remove(); document.getElementById('modal-root').innerHTML=''; renderContent(); renderBanner();
      }));
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

  function atribBlockHtml(a,i){
    return `<div class="atrib-block" data-idx="${i}">
      <div class="atrib-head">
        <select class="atrib-equipe" data-idx="${i}"><option value="">Selecione a equipe…</option>${DB.equipes.map(e=>`<option value="${e.id}" ${String(a.equipeId)===String(e.id)?'selected':''}>${equipeLabel(e)}${e.encarregado? ' · '+esc(e.encarregado):''}</option>`).join('')}</select>
        ${atribs.length>1? `<button type="button" class="icon-btn atrib-remove" data-idx="${i}">${icon('trash',14)}</button>`:''}
      </div>
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
    <div class="field"><label>Projeto <span class="req">*</span></label><select name="projetoId" id="pg-projeto" required>${DB.projetos.map(pr=>`<option value="${pr.id}" ${pg?.projetoId===pr.id?'selected':''}>${esc(pr.codigo)} · ${esc(pr.nome)}</option>`).join('')}</select></div>
    <div class="field-row">
      <div class="field"><label>Setor</label><input type="text" id="pg-setor" disabled value=""><div class="field-hint">Preenchido automaticamente do projeto.</div></div>
      <div class="field"><label>Coordenação</label><input type="text" id="pg-coord" disabled value=""><div class="field-hint">Preenchido automaticamente do projeto.</div></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Data programada (base) <span class="req">*</span></label><input type="date" name="dataProgramada" required value="${pg?.dataProgramada||''}"></div>
      <div class="field"><label>Ciclo recebido carteira <span class="req">*</span></label><input type="text" name="ciclo" class="ciclo-input" id="pg-ciclo" required maxlength="13" value="${esc(pg?.ciclo||'')}" placeholder="CICLO-XX/XXXX"><div class="field-hint">Preenchido automaticamente do projeto; pode ser ajustado.</div></div>
    </div>
    <div class="field"><label>Observações gerais</label><textarea name="observacoes">${esc(pg?.observacoes||'')}</textarea></div>
    ${renderCustomFieldsInputs('programacoes', pg)}
    <div class="field"><label>Equipes e atividades <span class="req">*</span></label>
      <div id="atribs-container">${renderAtribsHtml()}</div>
      <button type="button" class="btn btn-sm" id="add-atrib-btn" style="margin-top:6px;align-self:flex-start;">${icon('plus',13)} Adicionar equipe</button>
    </div>`;

  openModal({
    title: pg? 'Editar programação' : 'Nova programação', bodyHtml: baseFieldsHtml, wide:true, submitLabel: pg? 'Salvar alterações':'Programar',
    onMount:(root)=>{
      bindCicloMasks(root);
      const projSel = root.querySelector('#pg-projeto');
      function applyProjetoData(){
        const pr = findProjeto(Number(projSel.value));
        root.querySelector('#pg-setor').value = pr?.setor||'';
        root.querySelector('#pg-coord').value = pr?.coordenacao||'';
        root.querySelector('#pg-ciclo').value = pr?.ciclo? cicloMask(pr.ciclo) : '';
      }
      projSel.addEventListener('change', applyProjetoData);
      applyProjetoData();
      function refreshContainer(){ document.getElementById('atribs-container').innerHTML = renderAtribsHtml(); bindDynamic(); }
      function bindDynamic(){
        root.querySelectorAll('.atrib-equipe').forEach(s=>s.addEventListener('change', e=>{ atribs[e.target.dataset.idx].equipeId = e.target.value; }));
        root.querySelectorAll('.atrib-remove').forEach(b=>b.addEventListener('click', e=>{ atribs.splice(Number(e.currentTarget.dataset.idx),1); refreshContainer(); }));
        root.querySelectorAll('.atrib-add-activity').forEach(b=>b.addEventListener('click', e=>{ atribs[Number(e.currentTarget.dataset.idx)].atividades.push({atividadeId:'',quantidadePrevista:''}); refreshContainer(); }));
        root.querySelectorAll('.act-select').forEach(s=>s.addEventListener('change', e=>{ atribs[e.target.dataset.idx].atividades[e.target.dataset.jdx].atividadeId = e.target.value; }));
        root.querySelectorAll('.act-qty').forEach(s=>s.addEventListener('input', e=>{ atribs[e.target.dataset.idx].atividades[e.target.dataset.jdx].quantidadePrevista = e.target.value; }));
        root.querySelectorAll('.act-remove').forEach(b=>b.addEventListener('click', e=>{ const i=Number(e.currentTarget.dataset.idx), j=Number(e.currentTarget.dataset.jdx); atribs[i].atividades.splice(j,1); refreshContainer(); }));
      }
      bindDynamic();
      document.getElementById('add-atrib-btn').addEventListener('click', ()=>{ atribs.push({equipeId:'',atividades:[{atividadeId:'',quantidadePrevista:''}]}); refreshContainer(); });
    },
    onSubmit:(fd)=>{
      const ciclo = cicloMask(fd.get('ciclo'));
      if(!isCicloValido(ciclo)){ toast('Informe o ciclo recebido no formato CICLO-XX/XXXX (ex.: CICLO-01/2026).', 'error'); return false; }
      if(!atribs.length || atribs.some(a=>!a.equipeId)){ toast('Selecione a equipe em todos os blocos.', 'error'); return false; }
      for(const a of atribs){ if(!a.atividades.length || a.atividades.some(x=>!x.atividadeId)){ toast('Selecione a atividade em todas as linhas.', 'error'); return false; } }
      const dataBase = fd.get('dataProgramada'); const projetoId = Number(fd.get('projetoId')); const observacoes = fd.get('observacoes').trim();
      const custom = parseCustomFieldsFromForm('programacoes', fd);
      if(pg){
        const dataBaseAntiga = pg.dataProgramada;
        pg.projetoId = projetoId; pg.dataProgramada = dataBase; pg.ciclo = ciclo; pg.observacoes = observacoes; pg.custom = custom;
        const oldAtribs = pg.atribuicoes;
        pg.atribuicoes = atribs.map(a=>{
          const existing = oldAtribs.find(old => String(old.equipeId)===String(a.equipeId));
          const novasAtividades = a.atividades.map(x=>({atividadeId:Number(x.atividadeId), quantidadePrevista: x.quantidadePrevista?parseFloat(x.quantidadePrevista):null, quantidadeExecutada: existing? (existing.atividades.find(y=>y.atividadeId===Number(x.atividadeId))?.quantidadeExecutada ?? null) : null}));
          if(existing){ if(existing.dataProgramada===dataBaseAntiga) existing.dataProgramada = dataBase; existing.atividades = novasAtividades; return existing; }
          return { id: nextId(), equipeId:Number(a.equipeId), dataProgramada: dataBase, status:'Programado', atividades: novasAtividades, historico:[{ts:Date.now(),tipo:'criacao',de:null,para:'Programado',motivo:'Atribuição adicionada à programação'}] };
        });
        toast('Programação atualizada.');
      } else {
        const novaProg = { id: nextId(), projetoId, dataProgramada: dataBase, ciclo, observacoes, custom,
          atribuicoes: atribs.map(a=> ({ id: nextId(), equipeId:Number(a.equipeId), dataProgramada: dataBase, status:'Programado',
            atividades: a.atividades.map(x=>({atividadeId:Number(x.atividadeId), quantidadePrevista:x.quantidadePrevista?parseFloat(x.quantidadePrevista):null, quantidadeExecutada:null})),
            historico:[{ts:Date.now(),tipo:'criacao',de:null,para:'Programado',motivo:'Programação criada'}] })) };
        DB.programacoes.push(novaProg); toast('Programação criada.');
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
      atrib.historico.push({ts:Date.now(), tipo:'reprogramacao', de:dataAntiga, para:novaData, motivo, obs});
      saveData(); renderContent(); renderBanner(); toast('Programação reprogramada.');
    }
  });
}

/* =========================================================
   DOCUMENTO DE CAMPO (impressão / PDF)
========================================================= */
function printDocumento(html){
  document.getElementById('print-root').innerHTML = `<div class="print-sheet">${html}</div>`;
  window.print();
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
  return `
  <div class="ps-block">
    <div class="ps-block-head">${esc(pr?.nome||'Projeto')} (${esc(pr?.codigo||'')}) — ${equipeLabel(eq)} — ${fmtDate(atrib.dataProgramada)}</div>
    <table class="ps-info">
      <tr><th>Supervisor</th><td>${esc(eq?.supervisor||'—')}</td><th>Encarregado</th><td>${esc(eq?.encarregado||'—')}</td></tr>
      <tr><th>Motorista</th><td>${esc(eq?.motorista||'—')}</td><th>Eletricistas</th><td>${esc((eq?.eletricistas||[]).filter(Boolean).join(', ')||'—')}</td></tr>
      <tr><th>Status</th><td colspan="3">${atrib.status}</td></tr>
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
      <tr><th>Projeto</th><td colspan="3"><strong>${esc(pr?.nome||'—')}</strong> (${esc(pr?.codigo||'')})</td></tr>
      <tr><th>Setor</th><td>${esc(pr?.setor||'—')}</td><th>Coordenação</th><td>${esc(pr?.coordenacao||'—')}</td></tr>
      <tr><th>Ciclo</th><td>${esc(prog.ciclo||'—')}</td><th>Valor orçado</th><td>${fmtMoney(pr?.valorOrcado||0)}</td></tr>
      <tr><th>Período do projeto</th><td colspan="3">${fmtDate(pr?.dataInicio)} → ${fmtDate(pr?.dataFim)}</td></tr>
      ${prog.observacoes? `<tr><th>Observações gerais</th><td colspan="3">${esc(prog.observacoes)}</td></tr>`:''}
    </table>
    ${prog.atribuicoes.map(at=> docAtribuicaoHtml(prog, at)).join('')}
    <div style="margin-top:8px;font-size:10.5px;color:#000;border-top:1px solid #444;padding-top:6px;">Assinatura do fiscal / responsável: <span class="ps-line"></span> &nbsp;&nbsp; Data: ____/____/____</div>
  `;
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
const HIST_TIPOS = [{v:'',l:'Todos os eventos'},{v:'criacao',l:'Criação'},{v:'status',l:'Mudança de status'},{v:'reprogramacao',l:'Reprogramação'},{v:'confirmacao',l:'Confirmação de execução'}];
function renderHistorico(){
  const el = document.getElementById('content');
  const events = globalHistorico().filter(h=>{
    if(histFilters.tipo && h.tipo!==histFilters.tipo) return false;
    if(histFilters.projeto && String(h.projetoId)!==histFilters.projeto) return false;
    return true;
  });
  el.innerHTML = `
    <div class="panel-head" style="padding:0;margin-bottom:16px;border:none;">
      <div class="filters">
        <select id="f-h-tipo">${HIST_TIPOS.map(t=>`<option value="${t.v}" ${histFilters.tipo===t.v?'selected':''}>${t.l}</option>`).join('')}</select>
        <select id="f-h-projeto"><option value="">Todos os projetos</option>${DB.projetos.map(p=>`<option value="${p.id}" ${histFilters.projeto==String(p.id)?'selected':''}>${esc(p.nome)}</option>`).join('')}</select>
      </div>
      <span style="font-size:12px;color:var(--muted);">${events.length} eventos</span>
    </div>
    ${events.length? `<div class="panel">${renderHistoricoTimeline(events, true)}</div>` : `<div class="panel"><div class="empty-state">${icon('empty',34)}<p>Nenhum evento encontrado com os filtros.</p></div></div>`}`;
  document.getElementById('f-h-tipo').addEventListener('change', e=>{ histFilters.tipo=e.target.value; renderContent(); });
  document.getElementById('f-h-projeto').addEventListener('change', e=>{ histFilters.projeto=e.target.value; renderContent(); });
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
    const ctx = withContext && pg ? `<div class="tl-meta">${esc(findProjeto(pg.projetoId)?.nome||'')} · Equipe ${equipeLabel(eq)}</div>` : '';
    return `<div class="tl-item ${withContext?'clickable':''}" ${withContext?`data-open-atrib="${h.atribId}"`:''} style="--dot-c:${dotColor}"><div class="tl-title">${title}</div><div class="tl-meta">${fmtDateTime(h.ts)}</div>${ctx}${h.motivo? `<div class="tl-motivo"><strong>Motivo:</strong> ${esc(h.motivo)}${h.obs? ' — '+esc(h.obs):''}</div>`:''}</div>`;
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
    </div>`;
  el.querySelectorAll('[data-mod]').forEach(b=>b.addEventListener('click', ()=>{ adminModulo=b.dataset.mod; renderAdmin(); }));
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
    saveData(); toast('Campo adicionado.'); renderAdmin();
  });
}
function paintAdminUsersList(){
  const wrap = document.getElementById('admin-users-list');
  const users = DB.usuarios||[];
  wrap.innerHTML = users.length? users.map(u=>`
    <div class="admin-field-row">
      <div>
        <strong>${esc(u.nome)}</strong>
        <div class="admin-field-meta">${esc(u.login)} · ${roleLabel(u.role)} · ${nivelLabel(u.nivel)}${u.ativo?'':' · Inativo'}</div>
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
      const data = { nome, login, role, nivel, ativo: fd.get('ativo')==='on' };
      if(senha) data.senha = senha;
      if(u){ Object.assign(u, data); toast('Usuário atualizado.'); }
      else { data.id = nextId(); data.senha = senha; DB.usuarios.push(data); toast('Usuário criado.'); }
      saveData(); renderContent();
    }
  });
}
function deleteUsuario(id){
  const u = (DB.usuarios||[]).find(x=>x.id===Number(id));
  if(!u) return;
  if(u.role==='administrador' && (DB.usuarios||[]).filter(x=>x.role==='administrador' && x.ativo).length<=1){ toast('Deve existir ao menos um administrador ativo.', 'error'); return; }
  if(!confirm('Excluir o usuário "'+u.nome+'"?')) return;
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
    DB.customFields[adminModulo] = DB.customFields[adminModulo].filter(f=>f.id!==Number(b.dataset.delField));
    saveData(); renderAdmin();
  }));
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
      saveData(); setView(currentView); toast('Dados importados com sucesso.');
    }catch(err){ toast('Arquivo inválido.', 'error'); }
  };
  reader.readAsText(file); e.target.value='';
});

/* =========================================================
   ROUTER
========================================================= */
function renderContent(){
  const map = { dashboard: renderDashboard, equipes: renderEquipes, atividades: renderAtividades, projetos: renderProjetos, avanco: renderAvanco, programacoes: renderProgramacoes, historico: renderHistorico, admin: renderAdmin };
  (map[currentView]||renderDashboard)();
}

/* =========================================================
   SEED
========================================================= */
function seedIfEmpty(){
  if(DB.equipes.length || DB.atividades.length || DB.projetos.length) return;
  DB.usuarios = DB.usuarios||[];
  DB.usuarios.push({id:nextId(), nome:'Mestre', login:'1', senha:'1', role:'administrador', nivel:'total', ativo:true});
  const eq1 = {id:nextId(), eqtl:'Equipe Alfa', prtn:'', supervisor:'Marcos Lima', encarregado:'José Ferreira', motorista:'Paulo Souza', metaDiaria:5000, eletricistas:['Carlos Alves','Renato Dias'], ativo:true, custom:{}};
  const eq2 = {id:nextId(), eqtl:'', prtn:'Equipe Bravo', supervisor:'Ana Ribeiro', encarregado:'Bruno Castro', motorista:'Diego Nunes', metaDiaria:3000, eletricistas:['Felipe Rocha'], ativo:true, custom:{}};
  DB.equipes.push(eq1, eq2);
  const a1 = {id:nextId(), codigo:'MAN-014', descricao:'Substituição de poste de concreto', unidade:'un', valorUnitario:850, fav:true, custom:{}};
  const a2 = {id:nextId(), codigo:'MAN-022', descricao:'Poda de árvore próxima à rede', unidade:'un', valorUnitario:180, custom:{}};
  const a3 = {id:nextId(), codigo:'CON-005', descricao:'Instalação de rede de baixa tensão', unidade:'m', valorUnitario:42.5, custom:{}};
  DB.atividades.push(a1,a2,a3);
  const p1 = {id:nextId(), codigo:'PRJ-2026-01', nome:'Manutenção preventiva - Setor Leste', descricao:'Ronda de manutenção preventiva na rede do setor leste.', dataInicio:todayISO(), dataFim:'', setor:'MANUTENÇÃO', coordenacao:'RIO VERDE', status:'Em Andamento', valorOrcado:60000, ciclo:'CICLO-01/2026', planoFisico:[{atividadeId:a1.id, quantidade:6},{atividadeId:a2.id, quantidade:12},{atividadeId:a3.id, quantidade:150}], custom:{}};
  DB.projetos.push(p1);
  const prog1 = { id:nextId(), projetoId:p1.id, dataProgramada:todayISO(), ciclo:'CICLO-01/2026', observacoes:'', custom:{},
    atribuicoes:[
      { id:nextId(), equipeId:eq1.id, dataProgramada:todayISO(), status:'Programado', atividades:[{atividadeId:a1.id, quantidadePrevista:3, quantidadeExecutada:null}], historico:[{ts:Date.now(), tipo:'criacao', de:null, para:'Programado', motivo:'Programação criada (exemplo)'}] },
      { id:nextId(), equipeId:eq2.id, dataProgramada:todayISO(), status:'Programado', atividades:[{atividadeId:a2.id, quantidadePrevista:8, quantidadeExecutada:null},{atividadeId:a3.id, quantidadePrevista:120, quantidadeExecutada:null}], historico:[{ts:Date.now(), tipo:'criacao', de:null, para:'Programado', motivo:'Programação criada (exemplo)'}] }
    ]};
  DB.programacoes.push(prog1);
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
function showLoginScreen(){
  document.getElementById('login-screen').classList.remove('hidden');
  const u = document.getElementById('login-user');
  const st = document.getElementById('login-status');
  st.style.color = 'var(--muted)';
  st.textContent = 'Faça login para acessar o G26 Planner.';
  if(u.value==='') u.focus();
  document.getElementById('nav-user').textContent = CURRENT_USER? 'Conectado: '+CURRENT_USER.nome : 'Dados sincronizados na nuvem (Firebase)';
}
function tryLogin(){
  const login = document.getElementById('login-user').value.trim();
  const senha = document.getElementById('login-pass').value;
  const u = (DB.usuarios||[]).find(x=> x.ativo!==false && String(x.login)===login && String(x.senha)===senha);
  const st = document.getElementById('login-status');
  if(!u){ st.textContent = 'Usuário ou senha inválidos.'; st.style.color='var(--red)'; return; }
  CURRENT_USER = u;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('login-pass').value='';
  document.getElementById('nav-user').textContent = 'Conectado: '+u.nome+' · '+roleLabel(u.role);
  progFilters.ciclo = cicloPadrao();
  setView('dashboard');
  checkPendingConfirmations();
  toast('Bem-vindo, '+u.nome+'!');
}
function logout(){
  CURRENT_USER = null;
  document.getElementById('nav-user').textContent = 'Dados sincronizados na nuvem (Firebase)';
  showLoginScreen();
}
document.getElementById('login-btn').addEventListener('click', tryLogin);
document.getElementById('login-user').addEventListener('keydown', e=>{ if(e.key==='Enter') document.getElementById('login-pass').focus(); });
document.getElementById('login-pass').addEventListener('keydown', e=>{ if(e.key==='Enter') tryLogin(); });
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