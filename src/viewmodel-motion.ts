const smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function viewmodelPose(remaining:number,duration:number,equipAge:number,reduced=false){
 const p=remaining>0&&duration>0?Math.max(0,Math.min(1,1-remaining/duration)):1;
 const reload=p<.2?smooth(p/.2):p<.72?1:1-smooth((p-.72)/.28),equip=1-smooth(equipAge/.3),strength=reduced?.25:1;
 return {lower:(reload*.17+equip*.22)*strength,roll:(reload*.32+equip*.12)*strength,yaw:reload*.18*strength,magazine:remaining>0?smooth((p-.12)/.18)*(1-smooth((p-.58)/.22)):0};
}
