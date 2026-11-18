import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {PDFDocument,PDFName,decodePDFRawStream} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {alignedFontkit} from '../src/pdf-fontkit.mjs';
import {composeVectorPDF} from '../src/pdf-vector-core.mjs';
const fontBytes=gunzipSync(readFileSync(new URL('../assets/KaigiNoteSansJP.ttf.gz',import.meta.url)));
function validateFont(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),count=view.getUint16(4);
 assert.equal(view.getUint32(0),0x10000);
 const sum=(start,length,head=false)=>{let value=0;for(let i=0;i<length;i+=4){let word=0;for(let j=0;j<4;j++)word=(word*256+(i+j<length&&!(head&&i+j>=8&&i+j<12)?bytes[start+i+j]:0))>>>0;value=(value+word)>>>0}return value};
 let last=0,previousEnd=12+16*count;
 for(let i=0;i<count;i++){
  const entry=12+16*i,tag=view.getUint32(entry),offset=view.getUint32(entry+8),length=view.getUint32(entry+12);
  assert.ok(tag>last,'table directory must be sorted');last=tag;
  assert.equal(offset%4,0,'table must start at four-byte boundary');assert.ok(offset>=previousEnd);assert.ok(offset+length<=bytes.length);previousEnd=offset+length;
  assert.equal(sum(offset,length,tag===0x68656164),view.getUint32(entry+4),'table checksum '+tag.toString(16));
 }
 assert.equal(sum(0,bytes.length),0xB1B0AFBA,'whole-font checksum');
}
test('fontkit subsets have valid sfnt alignment and checksums across glyph counts',async()=>{
 for(const text of ['A','会議','会議の確認事項照明位置を変更がéABC']){
  const source=alignedFontkit.create(fontBytes),subset=source.createSubset(),map=[...text].map(ch=>{const glyph=source.glyphForCodePoint(ch.codePointAt(0));return [glyph.id,subset.includeGlyph(glyph)]});
  const bytes=await new Promise((resolve,reject)=>{const chunks=[];subset.encodeStream().on('data',b=>chunks.push(b)).on('error',reject).on('end',()=>resolve(new Uint8Array(Buffer.concat(chunks))))});validateFont(bytes);
  const parsed=fontkit.create(bytes);for(const [original,id]of map)assert.deepEqual(parsed.getGlyph(id).path.commands,source.getGlyph(original).path.commands);
 }
});
for(const mode of ['normal','editable'])test(mode+' PDF embeds structurally valid Japanese TrueType subsets',async()=>{
 const element={id:'t',type:'text',x:10,y:10,w:300,h:40,text:'会議の確認事項 ABC',style:{fontSize:18,color:'#000000'}},project={version:1,width:794,height:1123,screens:[{id:'s',name:'s',elements:[element]}]},prepared=[{elements:[{...element,textRuns:[{text:element.text,x:10,baseline:30,size:18,color:[0,0,0,1]}]}]}];
 const {bytes}=await composeVectorPDF(project,prepared,{fontBytes,mode});assert.ok(bytes.length<50000);
 const doc=await PDFDocument.load(bytes);let fonts=0;
 for(const [,object]of doc.context.enumerateIndirectObjects())if(object.get?.(PDFName.of('FontFile2'))){const stream=doc.context.lookup(object.get(PDFName.of('FontFile2')));validateFont(decodePDFRawStream(stream).decode());fonts++}
 assert.ok(fonts>0);
});
