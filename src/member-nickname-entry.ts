import {normalizeNickname} from './nickname.ts';
type Identity={member:boolean;nickname:string};
type Prompt=(member:boolean,save:((name:string)=>Promise<void>)|undefined,initial:string)=>Promise<string|null>;
export async function chooseOnlineNickname(identity:Identity,prompt:Prompt,save:(name:string)=>Promise<void>){
 const initial=normalizeNickname(identity.nickname)??'';
 return prompt(identity.member,identity.member?async name=>{if(name!==initial)await save(name);}:undefined,initial);
}
