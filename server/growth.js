export function validRun(body){return body&&['duel','ffa','survival'].includes(body.mode)&&['easy','normal','hard','auto'].includes(body.difficulty)&&(body.mode==='survival'||body.difficulty!=='auto');}
export function validFinish(r,run){
 if(!r||!run||!['win','loss'].includes(r.outcome)||!Number.isSafeInteger(r.kills)||r.kills<0||!Number.isSafeInteger(r.deaths)||r.deaths<0)return false;
 if(run.mode!=='survival')return r.kills<=10&&r.deaths<=30&&(r.outcome==='win'?r.kills===10:r.kills<10)&&r.wave==null&&r.totalWaves==null;
 const total=run.difficulty==='easy'?10:run.difficulty==='hard'?30:20;
 return r.totalWaves===total&&Number.isInteger(r.wave)&&r.wave>=1&&r.wave<=total&&r.kills<=360&&r.deaths<=3&&(r.outcome==='win'?r.wave===total&&r.deaths<3:r.deaths===3);
}
