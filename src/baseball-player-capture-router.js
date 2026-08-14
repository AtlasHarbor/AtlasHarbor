import express from 'express';

export function createBaseballPlayerCaptureRouter({playerStore}={}){
 const router=express.Router();
 let warned=false;
 router.use('/api/baseball/prospect-players/:id',(req,res,next)=>{
  const send=res.json.bind(res);
  res.json=(payload)=>{
   if(payload?.player?.id&&playerStore?.configured){
    playerStore.upsertPlayer(payload.player,{source:'player-page'}).catch(error=>{
     if(!warned){warned=true;console.warn('Baseball player snapshot persistence unavailable:',error.message)}
    });
   }
   return send(payload);
  };
  next();
 });
 return router;
}
