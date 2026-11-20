// Only export copies are changed. Segment by grapheme so an emoji/combining sequence
// never leaves half a character behind. JSON and the live note remain untouched.
const segments=text=>new Intl.Segmenter('ja',{granularity:'grapheme'}).segment(text);
export function substituteText(text,available,onReplace=()=>{}){
 let output='';for(const {segment,index} of segments(text||'')){
  if(/^[\r\n\t]+$/.test(segment)||[...segment].every(ch=>available.has(ch.codePointAt(0))))output+=segment;
  else{if(!available.has(0x3013))throw Error('PDFの代替記号「〓」をフォントに収録してください');output+='〓';onReplace({original:segment,index,replacement:'〓',unicode:[...segment].map(ch=>'U+'+ch.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')).join(' '),context:text.slice(Math.max(0,index-12),index+segment.length+12)})}
 }return output;
}
export function substituteProject(project,available){
 const copy=structuredClone(project),replacements=[];
 const walk=(elements,sc,page)=>{for(const e of elements){if(e.children)walk(e.children,sc,page);if(['text','box','circle','triangle'].includes(e.type)&&e.text)e.text=substituteText(e.text,available,item=>replacements.push({...item,page:page+1,pageName:sc.name||String(page+1),objectId:e.id||'',objectName:e.name||e.type}))}};
 copy.screens.forEach((sc,i)=>walk(sc.elements,sc,i));return {project:copy,replacements};
}
export function replacementReport(replacements,pdfName){
 const count=new Set(replacements.map(r=>r.original)).size;
 return '\ufeff'+['会議ノート PDF文字置換一覧','対象PDF：'+pdfName,'未収録文字：'+count+'種類・'+replacements.length+'箇所','元のノート・JSON・ZIPの文字は変更していません。','',...replacements.map((r,i)=>[`${i+1}. ${r.page}ページ「${r.pageName}」 / ${r.objectName} (${r.objectId})`,`元文字：${r.original} → ${r.replacement} / ${r.unicode}`,`同じ文字の出現数：${replacements.filter(v=>v.original===r.original).length}`,`文字位置：${r.index+1} / 前後：${JSON.stringify(r.context)}`,''].join('\r\n'))].join('\r\n');
}
