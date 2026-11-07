import test from 'node:test';import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT,createLocalJWKSet} from '../server/node_modules/jose/dist/webapi/index.js';
import {createIdentityVerifier} from '../server/account-auth.js';
test('guests stay guests, supplied invalid credentials cannot silently become guests',async()=>{
 const v=createIdentityVerifier({});assert.equal(await v(new Request('https://game/session')),null);
 await assert.rejects(v(new Request('https://game/session',{headers:{Authorization:'Bearer invalid'}})));
});
test('actual signatures, issuer, audience, expiry and authenticated role are required',async()=>{
 const {privateKey,publicKey}=await generateKeyPair('EdDSA');const jwk=await exportJWK(publicKey);jwk.kid='test';
 const env={NEON_AUTH_URL:'https://example.neonauth.test/neondb/auth'};
 const verify=createIdentityVerifier(env,createLocalJWKSet({keys:[jwk]}));
 const signed=async patch=>new SignJWT({role:'authenticated',...patch}).setProtectedHeader({alg:'EdDSA',kid:'test'}).setIssuer('https://example.neonauth.test').setAudience('https://example.neonauth.test').setSubject('user-1').setIssuedAt().setExpirationTime('2m').sign(privateKey);
 const req=token=>new Request('https://game/session',{headers:{Authorization:'Bearer '+token}});
 assert.equal(await verify(req(await signed({}))), 'user-1');
 await assert.rejects(verify(req(await signed({role:'anonymous'}))));
 await assert.rejects(verify(req(await signed({banned:true}))));
 const wrong=await new SignJWT({role:'authenticated'}).setProtectedHeader({alg:'EdDSA',kid:'test'}).setIssuer('https://evil.test').setAudience('https://example.neonauth.test').setSubject('user-1').setIssuedAt().setExpirationTime('2m').sign(privateKey);await assert.rejects(verify(req(wrong)));
 const expired=await new SignJWT({role:'authenticated'}).setProtectedHeader({alg:'EdDSA',kid:'test'}).setIssuer('https://example.neonauth.test').setAudience('wrong').setSubject('user-1').setIssuedAt().setExpirationTime(1).sign(privateKey);await assert.rejects(verify(req(expired)));
 const valid=await signed({});await assert.rejects(verify(req(valid.slice(0,-8)+'tampered')));
});
