// Display names never come from an email address or authentication identifier.
export function normalizeNickname(value:unknown):string|null{if(typeof value!=='string'||/[\r\n\t\p{Cc}\p{Cf}]/u.test(value))return null;const name=value.normalize('NFKC').trim().replace(/ +/g,' ');return /^[\p{L}\p{M}\p{N}_ -]{2,16}$/u.test(name)&&Array.from(name).length<=16?name:null;}
export const playerName=(p:{nickname?:string},fallback='대원')=>normalizeNickname(p.nickname)??fallback;
