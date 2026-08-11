const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":"&#39;"})[char]);
let lastModalMessage='';

function showModal({title,message,example='',account=false}){
 document.querySelector('.workspace-modal')?.remove();
 const modal=document.createElement('div');
 modal.className='workspace-modal';
 modal.setAttribute('role','dialog');
 modal.setAttribute('aria-modal','true');
 modal.innerHTML=`<div class="workspace-modal-card"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p>${example?`<div class="ai-example"><b>Example instruction</b><br>${escapeHtml(example)}</div>`:''}<div class="workspace-modal-actions">${account?'<a href="/account">Open AI settings</a>':''}<button type="button" data-modal-close>Close</button></div></div>`;
 document.body.append(modal);
 const close=()=>{modal.remove();document.removeEventListener('keydown',key)};
 const key=event=>{if(event.key==='Escape')close()};
 modal.querySelector('[data-modal-close]').onclick=close;
 modal.addEventListener('click',event=>{if(event.target===modal)close()});
 document.addEventListener('keydown',key);
 modal.querySelector(account?'a':'button')?.focus();
}

function applyStatusState(status){
 if(!status)return;
 const text=status.textContent.trim();
 status.classList.toggle('error',/unavailable|failed|error|required|expired|add an api key|enter instructions/i.test(text));
 status.classList.toggle('success',/saved|published|draft added|copied/i.test(text));
 if(/^AI unavailable:/i.test(text)&&text!==lastModalMessage){
  lastModalMessage=text;
  const missing=/api key|account first/i.test(text);
  showModal({title:missing?'AI is not configured':'The AI request did not work',message:text.replace(/^AI unavailable:\s*/i,''),account:missing,example:missing?'Open Account, add your API key, endpoint, and model, then use Test connection.':''});
 }
}

function observeStatus(workspace){
 const status=workspace.querySelector('#ws-status');
 if(!status||status.dataset.workspaceStatusObserved)return;
 status.dataset.workspaceStatusObserved='true';
 applyStatusState(status);
 const observer=new MutationObserver(()=>applyStatusState(status));
 observer.observe(status,{subtree:true,childList:true,characterData:true});
}

function decorate(workspace){
 if(!workspace||workspace.dataset.enhanced)return;
 workspace.dataset.enhanced='true';
 const add=workspace.querySelector('#ws-add-projection');
 if(add)add.classList.add('secondary');
 const prompt=workspace.querySelector('#ws-prompt');
 const promptLabel=prompt?.closest('label');
 if(promptLabel){
  const block=document.createElement('div');
  block.className='ai-prompt-block';
  promptLabel.before(block);
  block.append(promptLabel);
  promptLabel.insertAdjacentHTML('afterbegin','<h3>Instructions for AI</h3><p>Tell the model what question to answer, what evidence to weigh, and what uncertainty to explain.</p><span class="ai-example">Example: Project this player’s rest-of-season role and performance. Use the current stats and recent games, explain the strongest risk to the projection, and list what new evidence would change your view.</span>');
 }
 const actions=workspace.querySelector('.workspace-actions'),sharing=actions?.nextElementSibling;
 if(sharing?.tagName==='LABEL'){
  const wrap=document.createElement('div');
  wrap.className='sharing-options';
  sharing.before(wrap);
  wrap.append(sharing);
  const next=wrap.nextElementSibling;
  if(next?.tagName==='LABEL')wrap.append(next);
 }
 prompt?.addEventListener('input',()=>{
  if(prompt.value.trim().length>=10){prompt.classList.remove('field-invalid');prompt.classList.add('field-valid')}
  else prompt.classList.remove('field-valid');
 });
 observeStatus(workspace);
}

function decorateAll(root=document){
 if(root?.matches?.('.workspace'))decorate(root);
 root?.querySelectorAll?.('.workspace').forEach(decorate);
}

decorateAll();
window.addEventListener('atlas-workspace-loaded',()=>queueMicrotask(()=>decorateAll()));
window.addEventListener('atlas-publication-updated',()=>queueMicrotask(()=>decorateAll()));

document.addEventListener('click',event=>{
 const button=event.target.closest('#ws-ai');
 if(!button)return;
 const workspace=button.closest('.workspace'),prompt=workspace?.querySelector('#ws-prompt'),text=prompt?.value.trim()||'';
 if(text.length<10){
  event.preventDefault();
  event.stopImmediatePropagation();
  prompt?.classList.add('field-invalid');
  prompt?.focus();
  showModal({title:'Tell the AI what to analyze',message:'Add a clear instruction before generating a draft. Include the question you want answered and the factors the model should consider.',example:'Project this player’s rest-of-season role and performance. Use current stats and recent games, explain the biggest uncertainty, and say what would change the projection.'});
  return;
 }
 const key=localStorage.getItem('atlas-ai-key')||localStorage.getItem('atlas-openrouter-key');
 if(!key){
  event.preventDefault();
  event.stopImmediatePropagation();
  showModal({title:'Add an AI API key first',message:'AI drafting is optional, but it needs an API key, endpoint, and model in your Account settings. Your written analysis can still be saved without AI.',account:true});
 }
},true);
