export type ResultMode='duel'|'ffa'|'survival'|'online';
export type ResultDifficulty='easy'|'normal'|'hard'|'auto';
export type MatchResult={id:string;endedAt:number;mode:ResultMode;difficulty:ResultDifficulty|null;outcome:'win'|'loss';kills:number;deaths:number;seconds:number;wave:number|null;totalWaves:number|null;peakStage:number|null};
export type ResultSnapshot={mode:ResultMode|'practice';difficulty:ResultDifficulty|null;active:boolean;winner:''|'win'|'loss';kills:number;deaths:number;wave:number|null;totalWaves:number|null;stage:number|null};
type Best={wave:number;totalWaves:number;cleared:boolean};
type Journal={version:1;recent:MatchResult[];played:number;wins:number;bestSurvival:Partial<Record<ResultDifficulty,Best>>;peakStage:number};
type StorageLike={getItem(key:string):string|null;setItem(key:string,value:string):void};
export const RESULTS_KEY='harbor-match-results-v1';
const difficulties=['easy','normal','hard','auto'];
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
function validResult(r:MatchResult){
 if(!r||typeof r.id!=='string'||r.id.length<1||r.id.length>100||!integer(r.endedAt,0,8640000000000000)||!['duel','ffa','survival','online'].includes(r.mode)||!['win','loss'].includes(r.outcome)||!integer(r.kills)||!integer(r.deaths)||!Number.isFinite(r.seconds)||r.seconds<0)return false;
 if(r.mode==='online'?r.difficulty!==null:!difficulties.includes(r.difficulty??''))return false;
 if(r.mode!=='survival'&&(r.difficulty==='auto'||r.wave!==null||r.totalWaves!==null||r.peakStage!==null))return false;
 if(r.mode==='survival'&&(!integer(r.totalWaves,1,30)||!integer(r.wave,1,r.totalWaves)|| (r.difficulty==='auto'?!integer(r.peakStage,1,9):r.peakStage!==null)))return false;
 return true;
}
const empty=():Journal=>({version:1,recent:[],played:0,wins:0,bestSurvival:{},peakStage:0});
function decode(raw:string|null):Journal{
 if(raw===null)return empty();const value=JSON.parse(raw) as Journal;
 if(!value||value.version!==1||!Array.isArray(value.recent)||value.recent.length>20||!value.recent.every(validResult)||new Set(value.recent.map(r=>r.id)).size!==value.recent.length||!integer(value.played,value.recent.length)||!integer(value.wins,0,value.played)||!integer(value.peakStage,0,9)||!value.bestSurvival||typeof value.bestSurvival!=='object'||Array.isArray(value.bestSurvival))throw new Error('Invalid local results');
 for(const [key,best] of Object.entries(value.bestSurvival)){if(!difficulties.includes(key)||!best||!integer(best.totalWaves,1,30)||!integer(best.wave,1,best.totalWaves)||typeof best.cleared!=='boolean')throw new Error('Invalid survival best');}
 // Keep only known fields; storage is untrusted data, not display markup.
 return {version:1,recent:value.recent.map(cleanResult),played:value.played,wins:value.wins,peakStage:value.peakStage,bestSurvival:Object.fromEntries(Object.entries(value.bestSurvival).map(([key,b])=>[key,{wave:b!.wave,totalWaves:b!.totalWaves,cleared:b!.cleared}]))};
}
function cleanResult(r:MatchResult):MatchResult{return {id:r.id,endedAt:r.endedAt,mode:r.mode,difficulty:r.difficulty,outcome:r.outcome,kills:r.kills,deaths:r.deaths,seconds:r.seconds,wave:r.wave,totalWaves:r.totalWaves,peakStage:r.peakStage};}
export function createResultJournal(storage:StorageLike){
 let data=empty(),persisted=true;try{data=decode(storage.getItem(RESULTS_KEY));}catch{persisted=false;}
 const seen=new Set(data.recent.map(r=>r.id));
 return {
  get persisted(){return persisted;},
  read:()=>structuredClone(data),
  add(result:MatchResult){
   if(!validResult(result))throw new Error('Invalid match result');if(seen.has(result.id))return false;
   seen.add(result.id);const r=cleanResult(result);data.recent=[r,...data.recent].slice(0,20);data.played++;if(r.outcome==='win')data.wins++;
   if(r.mode==='survival'){
    const key=r.difficulty!,previous=data.bestSurvival[key],best={wave:r.wave!,totalWaves:r.totalWaves!,cleared:r.outcome==='win'};
    if(!previous||best.wave>previous.wave||(best.wave===previous.wave&&best.cleared&&!previous.cleared))data.bestSurvival[key]=best;
    data.peakStage=Math.max(data.peakStage,r.peakStage??0);
   }
   try{storage.setItem(RESULTS_KEY,JSON.stringify(data));persisted=true;}catch{persisted=false;}return true;
  },
 };
}
export function createResultTracker(now=Date.now,id=()=>crypto.randomUUID()){
 let running=false,seconds=0,peak=0,matchId='',complete:MatchResult|null=null;
 return {
  start(){running=true;seconds=0;peak=0;complete=null;matchId=id();},
  cancel(){running=false;complete=null;},
  observe(s:ResultSnapshot,dt:number,countTime=true){
   if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid result time');
   if(!running||complete||!s.active||s.mode==='practice')return;
   if(countTime)seconds+=dt;
   if(s.mode==='survival'&&s.difficulty==='auto'&&integer(s.stage,1,9))peak=Math.max(peak,s.stage);
   if(!s.winner)return;
   const r:MatchResult={id:matchId,endedAt:now(),mode:s.mode,difficulty:s.difficulty,outcome:s.winner,kills:s.kills,deaths:s.deaths,seconds,wave:s.wave,totalWaves:s.totalWaves,peakStage:s.mode==='survival'&&s.difficulty==='auto'?peak:null};
   if(!validResult(r))throw new Error('Invalid finished match');complete=r;
  },
  finish:()=>complete?structuredClone(complete):null,
 };
}
