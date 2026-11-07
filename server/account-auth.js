import {createRemoteJWKSet,jwtVerify} from 'jose';
const verifiers=new Map();
export function createIdentityVerifier(env,keySet){
 const base=env.NEON_AUTH_URL;
 const origin=base?new URL(base).origin:'';
 return async request=>{
  const authorization=request.headers.get('Authorization');if(!authorization)return null;
  if(!base||!/^Bearer [^\s]{1,8192}$/i.test(authorization))throw Error('Unauthorized');
  const url=new URL(base);if(url.protocol!=='https:')throw Error('Auth configuration');
  const jwksURL=base.replace(/\/$/,'')+'/.well-known/jwks.json';
  let keys=keySet??verifiers.get(jwksURL);
  if(!keys){keys=createRemoteJWKSet(new URL(jwksURL),{timeoutDuration:5000});verifiers.set(jwksURL,keys);}
  const {payload}=await jwtVerify(authorization.slice(7),keys,{issuer:origin,audience:origin,algorithms:['EdDSA'],requiredClaims:['sub','exp','iat']});
  if(typeof payload.sub!=='string'||!payload.sub||payload.sub.length>256||payload.role!=='authenticated'||payload.banned===true)throw Error('Unauthorized');
  return payload.sub;
 };
}
