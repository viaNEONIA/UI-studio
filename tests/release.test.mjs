import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import JSZip from 'jszip';
import {packageRelease} from '../scripts/package-release.mjs';
import {releasePlan,publishRelease} from '../scripts/publish-release.mjs';

const sha='a'.repeat(40),repo='owner/kaigi-note';
const env={GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/main',GITHUB_REPOSITORY:repo,GITHUB_SHA:sha,GITHUB_RUN_ID:'123'};
const ok=value=>({status:0,stdout:typeof value==='string'?value:JSON.stringify(value),stderr:''});
const missing=()=>({status:1,stdout:'',stderr:'gh: Not Found (HTTP 404)'});
async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),'kaigi-release-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const input=join(root,'dist'),directory=join(root,'release');await mkdir(input);
  await writeFile(join(input,'index.html'),'<!doctype html><title>会議ノート test-sha</title>');
  await writeFile(join(input,'THIRD_PARTY_NOTICES.txt'),'SIL Open Font License and third-party notices');
  await packageRelease(input,directory);return {input,directory};
}
function runner({release=null,head=sha,tag=null,fail}={}){
  const calls=[];
  const run=args=>{
    calls.push(args);
    if(fail)return {status:1,stdout:'',stderr:fail};
    if(args[0]!=='api')return ok('');
    const path=args[1].replace(`repos/${repo}/`,'');
    if(path==='git/ref/heads/main')return ok({object:{sha:head}});
    if(path.startsWith('releases/tags/'))return release?ok(release):missing();
    if(path==='git/ref/tags/latest-dev')return tag?ok({object:{sha:tag}}):missing();
    if(path.startsWith('commits/'))return ok({sha:head});
    return ok({});
  };return {run,calls};
}
test('release package contains the exact tested HTML and license at the ZIP root',async t=>{
  const {input,directory}=await fixture(t),zip=await JSZip.loadAsync(await readFile(join(directory,'kaigi-note.zip')));
  assert.deepEqual(Object.keys(zip.files).sort(),['THIRD_PARTY_NOTICES.txt','index.html']);
  for(const name of Object.keys(zip.files))assert.deepEqual(await zip.file(name).async('nodebuffer'),await readFile(join(input,name)));
  const first=await readFile(join(directory,'kaigi-note.zip'));await packageRelease(input,directory);assert.deepEqual(await readFile(join(directory,'kaigi-note.zip')),first);
});
test('only main and version-tag push events can publish',async()=>{
  assert.equal(releasePlan({...env,GITHUB_EVENT_NAME:'pull_request'}),null);
  assert.equal(releasePlan({...env,GITHUB_REF:'refs/heads/feature'}),null);
  assert.equal(releasePlan({...env,GITHUB_REF:'refs/tags/latest-dev'}),null);
  assert.equal(releasePlan({...env,GITHUB_REF:'refs/tags/v0.7.0'}).prerelease,false);
  assert.equal(releasePlan({...env,GITHUB_REF:'refs/tags/v0.7.0-rc.1'}).prerelease,true);
  assert.equal(releasePlan({...env,GITHUB_REF:'refs/tags/v065'}).tag,'v065');
  const {run,calls}=runner();await publishRelease({env:{...env,GITHUB_EVENT_NAME:'pull_request'},run});assert.equal(calls.length,0);
});
test('main publishes a prerelease with all three tested files after creating its exact tag',async t=>{
  const {directory}=await fixture(t),{run,calls}=runner(),result=await publishRelease({env,run,directory,log(){}});
  assert.equal(result.tag,'latest-dev');
  const create=calls.find(a=>a[0]==='release'&&a[1]==='create');assert.ok(create.includes('--prerelease'));assert.ok(create.includes('--latest=false'));assert.ok(create.includes('--verify-tag'));
  for(const name of ['index.html','kaigi-note.zip','THIRD_PARTY_NOTICES.txt'])assert.ok(create.includes(join(directory,name)));
  const tag=calls.findIndex(a=>a[0]==='api'&&a.includes('ref=refs/tags/latest-dev'));
  assert.ok(tag<calls.indexOf(create));assert.ok(calls[tag].includes(`sha=${sha}`));
  assert.match(await readFile(join(directory,'release-notes.md'),'utf8'),new RegExp(sha));
});
test('latest-dev updates in place while an older main build cannot overwrite it',async t=>{
  const {directory}=await fixture(t),{run,calls}=runner({release:{draft:false,immutable:false},tag:'b'.repeat(40)});
  await publishRelease({env,run,directory,log(){}});assert.ok(calls.some(a=>a.includes('force=true')&&a.includes(`sha=${sha}`)));
  assert.ok(calls.some(a=>a[1]==='upload'&&a.includes('--clobber')));assert.ok(calls.some(a=>a[1]==='edit'&&a.includes('--prerelease=true')));
  const stale=runner({head:'c'.repeat(40)});assert.equal((await publishRelease({env,run:stale.run,directory,log(){}})).skipped,'superseded main build');assert.equal(stale.calls.length,1);
});
test('formal tags create a stable release without moving the tag',async t=>{
  const {directory}=await fixture(t),{run,calls}=runner();await publishRelease({env:{...env,GITHUB_REF:'refs/tags/v0.7.0'},run,directory,log(){}});
  const create=calls.find(a=>a[1]==='create');assert.ok(create.includes('v0.7.0'));assert.ok(create.includes('--latest'));assert.ok(!create.includes('--prerelease'));
  assert.ok(!calls.some(a=>a[0]==='api'&&(a.includes('PATCH')||a.includes('POST'))));
});
test('published version assets are preserved; draft versions can finish publication',async t=>{
  const {directory}=await fixture(t),formal={...env,GITHUB_REF:'refs/tags/v0.7.0'},published=runner({release:{draft:false,immutable:true}});
  assert.equal((await publishRelease({env:formal,run:published.run,directory,log(){}})).skipped,'version already published');assert.equal(published.calls.length,1);
  const draft=runner({release:{draft:true,immutable:false}});await publishRelease({env:formal,run:draft.run,directory,log(){}});
  assert.ok(draft.calls.some(a=>a[1]==='upload'));assert.ok(draft.calls.some(a=>a[1]==='edit'&&a.includes('--draft=false')));
});
test('missing files, moved version tags and permission errors fail before publication',async t=>{
  const {directory}=await fixture(t),moved=runner({head:'b'.repeat(40)});
  await assert.rejects(publishRelease({env:{...env,GITHUB_REF:'refs/tags/v0.7.0'},run:moved.run,directory}),/変更/);assert.ok(!moved.calls.some(a=>a[0]==='release'));
  const forbidden=runner({fail:'gh: Forbidden (HTTP 403)'});await assert.rejects(publishRelease({env,run:forbidden.run,directory}),/403/);assert.equal(forbidden.calls.length,1);
  await rm(join(directory,'kaigi-note.zip'));const missingFile=runner();await assert.rejects(publishRelease({env,run:missingFile.run,directory}));assert.ok(!missingFile.calls.some(a=>a.includes('POST')||a[0]==='release'));
});
