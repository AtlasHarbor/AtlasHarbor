import {signUp,signIn,user,authenticatedFetch} from '/supabase-client.js';

const verseCatalog=[
 ['Hebrews 10:24','Encourage one another toward love and useful action.','hebrews-10-24'],
 ['Galatians 6:2',"Bear one another's burdens.",'galatians-6-2'],
 ['Galatians 6:10','Do good toward all people.','galatians-6-10'],
 ['James 2:16','Practical needs matter, not just kind words.','james-2-16'],
 ['1 John 3:18','Love in deed and truth.','1-john-3-18'],
 ['Luke 10:37','Go and do likewise.','luke-10-37'],
 ['Matthew 25:40','Help the people overlooked.','matthew-25-40'],
 ['Acts 3:6','Give what you have, even if it is not money.','acts-3-6'],
 ['Acts 4:35','Share according to actual need.','acts-4-35'],
 ['Ecclesiastes 4:10','Help another person get back up.','ecclesiastes-4-10'],
 ['Ecclesiastes 11:6','Try good work without pretending to know all outcomes.','ecclesiastes-11-6'],
 ['Proverbs 3:27','Do not withhold help when you can act.','proverbs-3-27']
];
const $=sel=>document.querySelector(sel);
const escapeHtml=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short=(x,n=240)=>String(x||'').length>n?String(x).slice(0,n-1)+'…':String(x||'');
const tell=(selector,message,error=false)=>{const n=$(selector);if(!n)return;n.textContent=message;n.classList.toggle('error',error)};
const amount=n=>Number(n||0).toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0});
const minPeople=n=>Number(n)>0?Math.max(3,Math.ceil(3*Number(n)/100)):1;
const dialogs=['authDialog','postDialog','threadDialog'];
let afterSignIn=null,requests=[],currentFilter='all';
function openModal(id){const d=$('#'+id);if(d&&!d.open)d.showModal()}
function closeModal(id){const d=$('#'+id);if(d?.open)d.close()}
function accountBadge(){
 const loggedIn=user();$('#accountState').textContent=loggedIn?'Signed in':'Anyone can join';
 $('#accountButton').textContent=loggedIn?'My account ↗':'Join / sign in';
}
function signedAction(cb){
 if(user()){cb();return}
 afterSignIn=cb;openModal('authDialog');
}
function visitorId(){
 try{let x=localStorage.getItem('movement-visitor-v1');if(!x){x=crypto.randomUUID();localStorage.setItem('movement-visitor-v1',x)}return x}catch{return null}
}
async function api(path,{method='GET',body=null,auth=false}={}){
 const options={method,headers:{Accept:'application/json'}};
 if(body!==null){options.headers['Content-Type']='application/json';options.body=JSON.stringify(body)}
 const res=auth?await authenticatedFetch('/api/movement'+path,options):await fetch('/api/movement'+path,{...options,credentials:'same-origin'});
 let data={};try{data=await res.json()}catch{}
 if(!res.ok)throw new Error(typeof data.error==='string'?data.error:'Community service unavailable ('+res.status+')');
 return data;
}
function labelStatus(s){return({'discussion':'Open discussion','vetting':'Being reviewed','approved':'Ready to act','active':'In progress','completed':'Completed','declined':'Not approved'})[s]||'Discussion'}
function requestCard(r){
 const money=Number(r.requested_amount)>0?' · Possible cost '+amount(r.requested_amount):' · Exploring solutions';
 return '<article class="request"><span class="badge">'+escapeHtml(labelStatus(r.status))+'</span><h3>'+escapeHtml(r.title)+'</h3><p>'+escapeHtml(short(r.description,210))+'</p>'+
 '<div class="meta">'+escapeHtml(r.location_label||'Anywhere')+' · '+escapeHtml(r.verse_ref)+money+'</div><div class="request-bottom">'+
 '<button class="pray" data-id="'+escapeHtml(r.id)+'" type="button">♡ I prayed · '+escapeHtml(r.prayer_count)+'</button>'+
 '<button class="open-thread" data-id="'+escapeHtml(r.id)+'" type="button">Talk it through ↗</button></div></article>';
}
function render(){
 let displayed=requests;
 if(currentFilter==='no-money')displayed=displayed.filter(x=>Number(x.requested_amount)===0);
 if(currentFilter==='funding')displayed=displayed.filter(x=>Number(x.requested_amount)>0);
 $('#total').textContent=displayed.length+' conversation'+(displayed.length===1?'':'s');
 $('#requests').innerHTML=displayed.length?displayed.map(requestCard).join(''):'<div class="empty"><h3>Nothing here yet.</h3><p>Start with a real problem, however small. Someone may already have a useful idea.</p><button class="button dark" id="emptyPost" type="button">Start a conversation ↗</button></div>';
 $('#emptyPost')?.addEventListener('click',()=>signedAction(()=>openModal('postDialog')));
}
async function load(){
 try{
  const health=await api('/health');
  if(!health.ok)throw Error('The discussion service is not ready.');
  const data=await api('/requests');requests=data.requests||[];
  tell('#connection','Open for discussion. There are no automatic payouts or fundraising links.');render();
  const deepLink=new URLSearchParams(location.search).get('request');if(/^[a-f0-9-]{36}$/i.test(deepLink||''))openThread(deepLink);
 }catch(e){tell('#connection','The community database is not ready: '+e.message,true);
  $('#requests').innerHTML='<div class="empty"><h3>Community service is unavailable.</h3><p>We cannot save conversations yet. Please return when Atlas Harbor storage has been configured.</p></div>';
 }
}
for(const [ref,meaning] of verseCatalog){
 const option=document.createElement('option');option.value=ref;option.textContent=ref+' — '+meaning;$('#versePicker').append(option);
}
$('#versePicker').addEventListener('change',()=>{
 const item=verseCatalog.find(([ref])=>ref===$('#versePicker').value);
 $('#verseHint').innerHTML=item?'A thought to begin with: '+escapeHtml(item[1])+' <a href="https://thewayversion.com/app/share/'+item[2]+'" target="_blank" rel="noopener">Read in TWV ↗</a>':'A reference is an invitation to reflect, not a test of belief.';
});
for(const b of document.querySelectorAll('[data-close]'))b.addEventListener('click',()=>closeModal(b.dataset.close));
for(const id of dialogs)$('#'+id).addEventListener('click',e=>{if(e.target===$('#'+id))closeModal(id)});
for(const id of ['heroPost','communityPost'])$('#'+id).addEventListener('click',()=>signedAction(()=>openModal('postDialog')));
$('#accountButton').addEventListener('click',()=>{
 if(user())location.href='/account';else openModal('authDialog');
});
$('#authForm').addEventListener('submit',async e=>{
 e.preventDefault();const form=e.currentTarget,mode=e.submitter?.value||'signup';
 const email=$('#authEmail').value.trim(),pass=$('#authPassword').value;
 const buttons=form.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);
 tell('#authFeedback',mode==='signup'?'Creating account and signing you in…':'Signing in…');
 try{
  const data=mode==='signup'?await signUp(email,pass):await signIn(email,pass);
  if(!data.access_token)throw Error('Atlas did not establish an account session. Try signing in.');
  accountBadge();closeModal('authDialog');form.reset();tell('#authFeedback','');
  const next=afterSignIn;afterSignIn=null;if(next)next();
 }catch(error){tell('#authFeedback',error.message,true)}
 finally{buttons.forEach(b=>b.disabled=false)}
});
$('#postForm').addEventListener('input',e=>{
 if(e.target.name!=='requested_amount')return;
 const min=minPeople(Number(e.target.value||0)),people=$('#postForm').elements.beneficiaries_target;
 people.min=String(min);if(Number(people.value)<min)people.value=String(min);
});
$('#postForm').addEventListener('submit',async e=>{
 e.preventDefault();const form=e.currentTarget,button=form.querySelector('[type=submit]');
 const data=Object.fromEntries(new FormData(form));
 data.requested_amount=Number(data.requested_amount||0);data.beneficiaries_target=Number(data.beneficiaries_target||1);
 if(data.beneficiaries_target<minPeople(data.requested_amount)){tell('#postFeedback','Adjust the number of people to match your proposed budget.',true);return}
 button.disabled=true;tell('#postFeedback','Sharing your request…');
 try{await api('/requests',{method:'POST',body:data,auth:true});
  form.reset();$('#versePicker').dispatchEvent(new Event('change'));closeModal('postDialog');
  await load();$('#community').scrollIntoView({behavior:'smooth'});}
 catch(error){if(/sign in/i.test(error.message))signedAction(()=>openModal('postDialog'));tell('#postFeedback',error.message,true)}
 finally{button.disabled=false}
});
$('#requests').addEventListener('click',async e=>{
 const prayer=e.target.closest('.pray'),thread=e.target.closest('.open-thread');
 if(prayer){
  const visitor_id=visitorId();if(!visitor_id){alert('Enable browser storage to count only one prayer-button click.');return}
  prayer.disabled=true;
  try{const r=await api('/requests/'+prayer.dataset.id+'/prayers',{method:'POST',body:{visitor_id}});
    prayer.textContent='♡ '+(r.added?'Counted':'Already counted')+' · '+r.count;
    const item=requests.find(x=>x.id===prayer.dataset.id);if(item)item.prayer_count=r.count;
  }catch(err){alert(err.message)}finally{prayer.disabled=false}
 }else if(thread)openThread(thread.dataset.id);
});
for(const b of document.querySelectorAll('[data-filter]'))b.addEventListener('click',()=>{
 currentFilter=b.dataset.filter;
 document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('on',x===b));render();
});
async function openThread(id){
 try{
 const {request:r,ideas}=await api('/requests/'+id);
 $('#threadTitle').textContent=r.title;
 const verse=verseCatalog.find(([ref])=>ref===r.verse_ref);
 const url=verse?'https://thewayversion.com/app/share/'+verse[2]:r.verse_url;
 $('#thread').innerHTML='<p class="meta">'+escapeHtml(r.display_name)+' · '+escapeHtml(r.location_label||'Anywhere')+' · '+escapeHtml(labelStatus(r.status))+'</p>'+
 '<p>'+escapeHtml(r.description)+'</p><div class="thread-section"><h3>How this could help others</h3><p>'+escapeHtml(r.how_help_others)+'</p><h3>What could continue</h3><p>'+escapeHtml(r.repeatable_step)+'</p><p><a href="'+escapeHtml(url)+'" target="_blank" rel="noopener">Read '+escapeHtml(r.verse_ref)+' in The Way Version ↗</a></p></div>'+
 '<p class="meta">'+escapeHtml(r.prayer_count)+' prayer button clicks · '+escapeHtml(r.beneficiaries_target)+' people proposed to be equipped'+(Number(r.requested_amount)>0?' · '+amount(r.requested_amount)+' estimated cost':'')+'</p>'+
 '<div class="vote-box"><strong>Could this be solved without money?</strong><p class="meta">One answer per browser. A starting point for ideas, not a funding decision.</p><div id="voteButtons"><button data-vote="yes">Yes · '+Number(r.no_money_yes||0)+'</button><button data-vote="no">Not entirely · '+Number(r.no_money_no||0)+'</button><button data-vote="unsure">Not sure · '+Number(r.no_money_unsure||0)+'</button></div><p id="voteStatus" class="meta" role="status"></p></div>'+
 '<div class="thread-section"><h3>Ideas and offers of help</h3>'+
 (ideas.length?ideas.map(i=>'<div class="idea"><b>'+escapeHtml(i.kind)+' · '+escapeHtml(i.display_name)+'</b><div>'+escapeHtml(i.body)+'</div></div>').join(''):'<p>No ideas posted yet. Can you think of a way to help without spending money?</p>')+'</div>'+
 '<form id="ideaForm" class="form"><h3>Add a useful idea</h3><label>What could help?<textarea name="body" rows="3" minlength="12" maxlength="1500" required placeholder="Try a practical step, an introduction, or something people can do together."></textarea></label><label>What sort of idea?<select name="kind"><option value="no-money">No money needed</option><option value="community-action">Someone could help directly</option><option value="possible-funding">An unavoidable cost remains</option></select></label><label>Display name<input name="display_name" maxlength="80" placeholder="Your name or nickname"></label><button class="button dark" type="submit">Share your idea ↗</button><p id="ideaFeedback" class="meta" role="status"></p></form>';
 openModal('threadDialog');
 $('#voteButtons').addEventListener('click',async e=>{
  const button=e.target.closest('[data-vote]');if(!button)return;
  const visitor_id=visitorId();if(!visitor_id){tell('#voteStatus','Enable browser storage to take part.',true);return}
  button.disabled=true;try{
   const data=await api('/requests/'+id+'/votes',{method:'POST',body:{visitor_id,answer:button.dataset.vote}});
   $('#voteButtons').querySelector('[data-vote=yes]').textContent='Yes · '+data.counts.yes;
   $('#voteButtons').querySelector('[data-vote=no]').textContent='Not entirely · '+data.counts.no;
   $('#voteButtons').querySelector('[data-vote=unsure]').textContent='Not sure · '+data.counts.unsure;
   tell('#voteStatus',data.added?'Your answer was recorded.':'This browser has already answered.');
  }catch(err){tell('#voteStatus',err.message,true)}finally{button.disabled=false}
 });
 $('#ideaForm').addEventListener('submit',e=>{
  e.preventDefault();
  signedAction(async()=>{
    const form=$('#ideaForm');if(!form)return;
    const data=Object.fromEntries(new FormData(form));const button=form.querySelector('button');button.disabled=true;
    try{await api('/requests/'+id+'/ideas',{method:'POST',body:data,auth:true});await openThread(id);}
    catch(error){tell('#ideaFeedback',error.message,true)}finally{button.disabled=false}
  });
 });
 }catch(error){alert(error.message)}
}
accountBadge();
load();