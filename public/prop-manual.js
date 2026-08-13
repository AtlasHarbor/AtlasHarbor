import{user,accessToken,refreshSession}from'./supabase-client.js';

const root=document.querySelector('#prop-root');
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

async function api(url,options={}){
 let token=accessToken();
 const run=()=>fetch(url,{...options,headers:{Accept:'application/json',...(options.headers||{}),...(token?{Authorization:`Bearer ${token}`}:{})}});
 let response=await run();
 if(response.status===401&&token){await refreshSession();token=accessToken();response=await run()}
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||`Request failed (${response.status}).`);
 return data;
}

function toolbar(){return`<div class="manual-editor-toolbar"><button type="button" data-cmd="bold" title="Bold"><b>B</b></button><button type="button" data-cmd="italic" title="Italic"><i>I</i></button><button type="button" data-cmd="underline" title="Underline"><u>U</u></button><button type="button" data-block="h2" title="Heading">H2</button><button type="button" data-block="h3" title="Subheading">H3</button><button type="button" data-cmd="insertUnorderedList" title="Bullets">• List</button><button type="button" data-link title="Add link">Link</button></div>`}
function bindEditor(host){
 const editor=host.querySelector('.manual-editor');
 host.querySelectorAll('[data-cmd]').forEach(button=>button.onclick=()=>{editor.focus();document.execCommand(button.dataset.cmd,false,null)});
 host.querySelectorAll('[data-block]').forEach(button=>button.onclick=()=>{editor.focus();document.execCommand('formatBlock',false,button.dataset.block)});
 host.querySelector('[data-link]')?.addEventListener('click',()=>{const url=prompt('Paste an http(s) URL');if(!url||!/^https?:\/\//i.test(url))return;editor.focus();document.execCommand('createLink',false,url)});
 return editor;
}
function manualForm(){
 const signed=Boolean(user());
 return`<section class="manual-space-block" id="manual-space-block"><p class="eyebrow">MANUAL SPACE BLOCK · NO AI REQUIRED</p><h1>Create a Space Block</h1><p class="manual-lede">Paste or write an Upwork RFP, problem statement, partnership idea, sales case, or other proposition yourself. Save the underlying page first; then use its normal Atlas Harbor workspace to write and publish separate analysis.</p>${signed?`<form id="manual-block-form"><div class="manual-grid"><label>Title<input name="title" maxlength="240" required placeholder="Upwork RFP — Warehouse optimization analysis"></label><label>Block type<select name="proposition_type"><option>RFP / client problem</option><option>Internal work project</option><option>Partnership proposal</option><option>Sales proposition</option><option>General proposition</option></select></label><label class="wide">Source or reference URL<input name="source_url" type="url" maxlength="800" placeholder="https://www.upwork.com/..."></label><label class="wide">Decision or requested outcome<input name="decision_requested" maxlength="1800" placeholder="What should someone decide, approve, buy, hire, or do?"></label><div class="wide"><b>Problem statement / proposition body</b>${toolbar()}<div class="manual-editor" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="Paste the problem statement here, then format and edit it."></div></div></div><div class="manual-actions"><button type="submit">Create Space Block</button><a class="button secondary" href="/prop">Cancel</a><span class="manual-status"></span></div></form>`:'<div class="manual-signin"><p>You need an Atlas Harbor account to create and own a Space Block.</p><a class="button" href="/account">Sign in or create an account</a><a class="button secondary" href="/prop">Back to Propositions</a></div>'}</section>`;
}
function bindCreateForm(){
 const form=document.querySelector('#manual-block-form');if(!form)return;
 const editor=bindEditor(form);
 form.addEventListener('submit',async event=>{event.preventDefault();const status=form.querySelector('.manual-status'),button=event.submitter,fd=new FormData(form);button.disabled=true;status.textContent='Creating Space Block…';try{const out=await api('/api/prop/manual',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:fd.get('title'),proposition_type:fd.get('proposition_type'),source_url:fd.get('source_url'),decision_requested:fd.get('decision_requested'),body_html:editor.innerHTML})});location.assign(`/prop/${encodeURIComponent(out.block.id)}`)}catch(error){status.textContent=error.message;button.disabled=false}});
}
function renderNew(){
 document.title='Create Space Block · Propositions · Atlas Harbor';
 root.innerHTML=`<p class="gtm-back"><a href="/prop">← All propositions</a></p>${manualForm()}`;
 bindCreateForm();
}
async function installDetail(){
 const match=location.pathname.match(/^\/prop\/([^/]+)/);if(!match||match[1]==='new'||document.querySelector('.manual-public-body'))return false;
 const report=root.querySelector('.gtm-report');if(!report)return false;
 let data;try{data=await api(`/api/prop/reports/${encodeURIComponent(decodeURIComponent(match[1]))}`)}catch{return true}
 const r=data.report;if(r.creation_mode!=='manual')return true;
 report.classList.add('manual-report');
 const hero=report.querySelector('.gtm-report-hero'),body=document.createElement('section');body.className='manual-public-body';body.innerHTML=`${r.body_html||`<p>${esc(r.proposition||'')}</p>`}${r.source_url?`<p class="manual-source"><b>Source / reference:</b> <a href="${esc(r.source_url)}" target="_blank" rel="noopener noreferrer">${esc(r.source_url)}</a></p>`:''}`;hero?.insertAdjacentElement('afterend',body);
 root.querySelectorAll('.credential-gate,.gtm-owner-tools').forEach(el=>el.hidden=true);
 if(!r.is_owner)return true;
 const editorSection=document.createElement('section');editorSection.className='manual-space-block';editorSection.id='edit-space-block';editorSection.innerHTML=`<p class="eyebrow">EDIT SPACE BLOCK</p><h2>Edit the underlying proposition page</h2><form><div class="manual-grid"><label>Title<input name="title" maxlength="240" value="${esc(r.title)}"></label><label>Block type<input name="proposition_type" maxlength="120" value="${esc(r.proposition_type||'Manual proposition')}"></label><label class="wide">Source or reference URL<input name="source_url" type="url" maxlength="800" value="${esc(r.source_url||'')}"></label><label class="wide">Decision or requested outcome<input name="decision_requested" maxlength="1800" value="${esc(r.decision_requested||'')}"></label><div class="wide"><b>Problem statement / proposition body</b>${toolbar()}<div class="manual-editor" contenteditable="true" role="textbox" aria-multiline="true"></div></div></div><div class="manual-actions"><button type="submit">Save Space Block</button><span class="manual-status"></span></div></form>`;
 report.insertAdjacentElement('afterend',editorSection);
 const form=editorSection.querySelector('form'),editor=bindEditor(form);editor.innerHTML=r.body_html||'';
 form.addEventListener('submit',async event=>{event.preventDefault();const status=form.querySelector('.manual-status'),button=event.submitter,fd=new FormData(form);button.disabled=true;status.textContent='Saving…';try{await api(`/api/prop/manual/${encodeURIComponent(r.id)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:fd.get('title'),proposition_type:fd.get('proposition_type'),source_url:fd.get('source_url'),decision_requested:fd.get('decision_requested'),body_html:editor.innerHTML})});location.reload()}catch(error){status.textContent=error.message;button.disabled=false}});
 if(location.hash==='#edit-space-block')setTimeout(()=>editorSection.scrollIntoView({behavior:'smooth',block:'start'}),80);
 return true;
}

const path=location.pathname.replace(/\/$/,'');
if(path==='/prop/new')renderNew();
else if(path.startsWith('/prop/')){let attempts=0;const boot=async()=>{attempts++;const done=await installDetail();if(!done&&attempts<60)setTimeout(boot,100)};boot()}
