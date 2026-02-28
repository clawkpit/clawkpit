const URGENCIES=["DoNow","DoToday","DoThisWeek","DoLater","Unclear"];
const TAGS=["ToRead","ToThinkAbout","ToUse","ToDo"];
const IMPORTANCES=["High","Medium","Low"];

let state={items:[],selected:null,notes:[]};
const $=id=>document.getElementById(id);

function fillSelect(id, values){$(id).innerHTML=values.map(v=>`<option>${v}</option>`).join("");}
fillSelect("urgency",URGENCIES);fillSelect("tag",TAGS);fillSelect("importance",IMPORTANCES);

async function api(path, opts={}){const r=await fetch(`/api${path}`,{headers:{"Content-Type":"application/json"},...opts});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||"Request failed");return b;}

async function bootstrap(){
  try{const me=await api('/me');$('auth').classList.add('hidden');$('board').classList.remove('hidden');$('user').textContent=me.user.email;await loadItems();}
  catch{ $('auth').classList.remove('hidden'); }
}

async function loadItems(){
  const status=$('statusFilter').value;const res=await api(`/v1/items?status=${encodeURIComponent(status)}&page=1&pageSize=100`);state.items=res.items;render();
}

function groups(mode){return mode==='tag'?TAGS:URGENCIES;}
function getGroup(item,mode){return mode==='tag'?item.tag:item.urgency;}

function render(){
  const mode=$('viewMode').value;
  $('columns').innerHTML=groups(mode).map(g=>`<div class="col"><h4>${g}</h4><div id="col-${g}"></div></div>`).join('');
  state.items.forEach(item=>{
    const el=document.createElement('div'); el.className='card';
    el.innerHTML=`<strong>#${item.humanId} ${item.title}</strong><div>${mode==='tag'?item.urgency:item.tag} | ${item.importance}</div><div>${item.deadline||'No deadline'}</div>`;
    el.onclick=()=>openItem(item.id);
    const col=document.getElementById(`col-${getGroup(item,mode)}`); if(col) col.appendChild(el);
  });
}

async function openItem(id){
  state.selected=await api(`/v1/items/${id}`);
  $('title').value=state.selected.title; $('description').value=state.selected.description;
  $('urgency').value=state.selected.urgency; $('tag').value=state.selected.tag; $('importance').value=state.selected.importance;
  $('deadline').value=state.selected.deadline?state.selected.deadline.slice(0,16):'';
  await loadNotes(); $('itemDialog').showModal();
}

async function loadNotes(){
  if(!state.selected)return; state.notes=await api(`/v1/items/${state.selected.id}/notes`);
  $('notes').innerHTML=state.notes.map(n=>`<li data-id="${n.noteId}"><small>${n.author} ${new Date(n.updatedAt).toLocaleString()}</small><br/><textarea>${n.content}</textarea><button onclick="saveNote('${n.noteId}', this.previousElementSibling.value)">Save</button></li>`).join('');
}
window.saveNote=async(id,content)=>{try{await api(`/v1/notes/${id}`,{method:'PATCH',body:JSON.stringify({actor:'User',content})});await loadNotes();await loadItems();}catch(e){alert(e.message);}};

$('sendLink').onclick=async()=>{try{const r=await api('/auth/request-link',{method:'POST',body:JSON.stringify({email:$('email').value})});$('authMsg').textContent=`Dev token: ${r.token}`;}catch(e){$('authMsg').textContent=e.message;}};
$('consumeLink').onclick=async()=>{try{await api('/auth/consume-link',{method:'POST',body:JSON.stringify({token:$('token').value})});await bootstrap();}catch(e){$('authMsg').textContent=e.message;}};
$('viewMode').onchange=render;$('statusFilter').onchange=loadItems;
$('newItem').onclick=()=>{state.selected=null;$('itemForm').reset();$('itemDialog').showModal();$('notes').innerHTML='';};
$('saveItem').onclick=async(e)=>{e.preventDefault();const payload={title:$('title').value,description:$('description').value,urgency:$('urgency').value,tag:$('tag').value,importance:$('importance').value,deadline:$('deadline').value?new Date($('deadline').value).toISOString():null,modifiedBy:'User'};
  try{ if(state.selected) await api(`/v1/items/${state.selected.id}`,{method:'PATCH',body:JSON.stringify(payload)}); else await api('/v1/items',{method:'POST',body:JSON.stringify({...payload,createdBy:'User',status:'Active'})});$('itemDialog').close();await loadItems();}
  catch(err){alert(err.message);} };
$('addNote').onclick=async()=>{if(!state.selected)return;try{await api(`/v1/items/${state.selected.id}/notes`,{method:'POST',body:JSON.stringify({author:'User',content:$('newNote').value})});$('newNote').value='';await loadNotes();await loadItems();}catch(e){alert(e.message);}};
$('doneItem').onclick=async()=>{if(!state.selected)return;try{await api(`/v1/items/${state.selected.id}/done`,{method:'POST',body:JSON.stringify({actor:'User'})});$('itemDialog').close();await loadItems();}catch(e){alert(e.message);}};
$('dropItem').onclick=async()=>{if(!state.selected)return;const note=prompt('Reason for dropping (required if no notes exist):')||undefined;try{await api(`/v1/items/${state.selected.id}/drop`,{method:'POST',body:JSON.stringify({actor:'User',note})});$('itemDialog').close();await loadItems();}catch(e){alert(e.message);}};

bootstrap();
