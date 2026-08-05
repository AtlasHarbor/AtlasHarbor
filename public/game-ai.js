import{user,ai}from'./supabase-client.js';

const host=document.querySelector('#advisor-host');
if(host){
 const section=document.createElement('div');
 section.className='ai-advisor-block';
 section.innerHTML=user()?`<hr><p class="eyebrow">AI OPERATIONS ADVISOR</p><p>Ask your selected model to challenge a route, recovery, production, or customer decision using the current saved simulation state.</p><textarea id="game-ai-question" rows="4" placeholder="Which promise should I protect first, and what tradeoff am I overlooking?"></textarea><button id="game-ai-submit" type="button">Ask advisor</button><div id="game-ai-answer" class="plan-card" hidden></div>`:`<hr><p class="eyebrow">AI OPERATIONS ADVISOR</p><p><a href="/account">Sign in and add an OpenRouter key</a> to ask an AI to challenge your operating plan.</p>`;
 host.appendChild(section);
 document.querySelector('#game-ai-submit')?.addEventListener('click',async()=>{
  const answer=document.querySelector('#game-ai-answer'),question=document.querySelector('#game-ai-question').value.trim();
  if(!question)return;
  const state=window.__atlasGameState||{};
  answer.hidden=false;answer.textContent='Thinking…';
  try{
   const compact={time:{day:state.day,hour:state.hour,totalHours:state.totalHours},cash:state.cash,trust:state.trust,onTime:state.onTime,orders:(state.orders||[]).map(item=>({id:item.id,product:item.product,status:item.status,inventory:item.inventory,qty:item.qty,dueAt:item.dueAt,value:item.value})),shipments:(state.shipments||[]).map(item=>({id:item.id,orderId:item.orderId,mode:item.mode,route:item.route,segment:item.segment,progress:item.progress,exception:item.exception})),exceptions:state.exceptions,staffMorale:state.morale,delegation:state.delegation,upgrades:state.upgradeLevels};
   const result=await ai([{role:'system',content:'You are an operations coach inside a logistics control-tower simulation. Use only the supplied state. Identify the highest-value decision, explain the cost/service/trust tradeoff, and name evidence that would change the recommendation. Do not claim that an action was executed.'},{role:'user',content:`Current simulation state:\n${JSON.stringify(compact)}\n\nPlayer question: ${question}`}],{surface:'logistics_game',state:compact});
   answer.textContent=result.content||'The advisor returned no text.';
  }catch(error){answer.textContent=error.message}
 });
}
