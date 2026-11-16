import {spawnSync} from 'node:child_process';
import {stat,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export function releasePlan(env){
  if(env.GITHUB_EVENT_NAME!=='push')return null;
  const ref=env.GITHUB_REF||'';
  if(ref==='refs/heads/main')return {tag:'latest-dev',title:'会議ノート 最新開発版',prerelease:true,development:true};
  if(!ref.startsWith('refs/tags/v'))return null;
  const tag=ref.slice('refs/tags/'.length);
  if(!/^v\d[\dA-Za-z.+-]*$/.test(tag))throw Error('リリースタグの形式が正しくありません');
  return {tag,title:'会議ノート '+tag,prerelease:tag.includes('-'),development:false};
}

function execute(args){
  const result=spawnSync('gh',args,{encoding:'utf8',env:process.env});
  if(result.error)throw result.error;
  return result;
}

export async function publishRelease({env=process.env,run=execute,directory='release',log=console.log}={}){
  const plan=releasePlan(env);
  if(!plan)return {skipped:'not a release push'};
  const repo=env.GITHUB_REPOSITORY,sha=env.GITHUB_SHA;
  if(!/^[\w.-]+\/[\w.-]+$/.test(repo||'')||!/^[a-f\d]{40,64}$/i.test(sha||''))throw Error('リポジトリまたはコミットSHAが正しくありません');
  const command=(args,optional=false)=>{
    const result=run(args);
    if(result.status!==0){
      if(optional&&/HTTP 404/.test(result.stderr||''))return null;
      throw Error('GitHub Releaseの操作に失敗しました: '+(result.stderr||result.stdout||result.status));
    }
    return result.stdout||'';
  };
  const api=(path,extra=[],optional=false)=>{
    const value=command(['api',`repos/${repo}/${path}`,...extra],optional);
    return value===null?null:value.trim()?JSON.parse(value):{};
  };
  // Main builds may finish out of order. Only the current head can replace latest-dev.
  if(plan.development&&api('git/ref/heads/main').object.sha!==sha){
    log('Skipped an older main build; a newer commit is already on main.');
    return {skipped:'superseded main build'};
  }
  const existing=api(`releases/tags/${plan.tag}`,[],true);
  if(existing&&!plan.development&&!existing.draft){
    log(`Release ${plan.tag} is already published; its assets are preserved.`);
    return {skipped:'version already published'};
  }
  if(existing?.immutable)throw Error('最新開発版のReleaseが固定されているため自動更新できません');
  const names=['index.html','kaigi-note.zip','THIRD_PARTY_NOTICES.txt'];
  const assets=names.map(name=>resolve(directory,name));
  for(const asset of assets)if(!(await stat(asset)).size)throw Error('空のリリースファイル: '+asset);
  const notes=resolve(directory,'release-notes.md');
  const revision=`コミット: https://github.com/${repo}/commit/${sha}\n検証: https://github.com/${repo}/actions/runs/${env.GITHUB_RUN_ID||''}`;
  await writeFile(notes,`${plan.development?'mainのテストを通過した最新開発版です。':'タグ '+plan.tag+' のテストを通過した配布版です。'}\n\n${revision}\n\n配布ZIPを展開して index.html を開いてください。単独HTMLとライセンス表記も添付しています。\n`);
  // Validate the files before changing the development tag or creating a release.
  if(plan.development){
    const tag=api('git/ref/tags/latest-dev',[],true);
    if(tag){
      if(tag.object.sha!==sha)api('git/refs/tags/latest-dev',['--method','PATCH','-f',`sha=${sha}`,'-F','force=true']);
    }else api('git/refs',['--method','POST','-f','ref=refs/tags/latest-dev','-f',`sha=${sha}`]);
  }else if(api(`commits/${plan.tag}`).sha!==sha)throw Error('タグの参照先が検証したコミットから変更されています');
  const options=['--repo',repo,'--title',plan.title,'--notes-file',notes];
  if(!existing){
    command(['release','create',plan.tag,...assets,...options,'--verify-tag',...(plan.prerelease?['--prerelease','--latest=false']:['--latest'])]);
  }else{
    command(['release','upload',plan.tag,...assets,'--repo',repo,'--clobber']);
    command(['release','edit',plan.tag,...options,'--draft=false',`--prerelease=${plan.prerelease}`,...(plan.prerelease?['--latest=false']:['--latest'])]);
  }
  const url=`https://github.com/${repo}/releases/tag/${plan.tag}`;
  log('Published '+url);
  return {url,tag:plan.tag,assets:names};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await publishRelease();
