import fontkit from '@pdf-lib/fontkit';

// fontkit's PDF-only subset writer leaves checksums at zero and does not align
// sfnt tables. Rebuild the directory without changing glyph IDs or table data.
export function normalizeTrueTypeSubset(input){
 const source=new DataView(input.buffer,input.byteOffset,input.byteLength),count=source.getUint16(4),tables=[];
 for(let i=0;i<count;i++){
  const entry=12+i*16,tag=source.getUint32(entry),offset=source.getUint32(entry+8),length=source.getUint32(entry+12);
  if(offset+length>input.length)throw Error('PDF用フォントのテーブル範囲が不正です');
  tables.push({tag,data:input.slice(offset,offset+length)});
 }
 tables.sort((a,b)=>a.tag-b.tag);
 let length=12+count*16;for(const table of tables){table.offset=length;length+=(table.data.length+3)&~3}
 const output=new Uint8Array(length),view=new DataView(output.buffer),exponent=Math.floor(Math.log2(count)),range=16*2**exponent;
 view.setUint32(0,0x00010000);view.setUint16(4,count);view.setUint16(6,range);view.setUint16(8,exponent);view.setUint16(10,count*16-range);
 let head;
 const sum=(start,end)=>{let value=0;for(let i=start;i<end;i+=4)value=(value+view.getUint32(i))>>>0;return value};
 tables.forEach((table,i)=>{
  const entry=12+i*16;output.set(table.data,table.offset);
  if(table.tag===0x68656164){head=table.offset;view.setUint32(head+8,0)}
  view.setUint32(entry,table.tag);view.setUint32(entry+4,sum(table.offset,table.offset+((table.data.length+3)&~3)));view.setUint32(entry+8,table.offset);view.setUint32(entry+12,table.data.length);
 });
 if(head===undefined)throw Error('PDF用フォントのheadテーブルがありません');
 view.setUint32(head+8,(0xB1B0AFBA-sum(0,output.length))>>>0);return output;
}

function normalizedSubsetStream(subset,encodeStream){
 const callbacks=new Map(),chunks=[],emit=(event,value)=>{for(const callback of callbacks.get(event)||[])callback(value)};
 encodeStream.call(subset).on('data',chunk=>chunks.push(chunk)).on('error',error=>emit('error',error)).on('end',()=>{
  try{const input=new Uint8Array(chunks.reduce((n,b)=>n+b.length,0));let offset=0;for(const chunk of chunks){input.set(chunk,offset);offset+=chunk.length}emit('data',normalizeTrueTypeSubset(input));emit('end')}
  catch(error){emit('error',error)}
 });
 return {on(event,callback){if(!callbacks.has(event))callbacks.set(event,[]);callbacks.get(event).push(callback);return this}};
}

// fontkit 1.1.1 writes a short loca table for small TrueType subsets, but can
// concatenate odd-sized glyph records. Short loca offsets lose the last bit,
// which corrupts subsequent glyphs. Pad each record before encoding the table.
export const alignedFontkit={...fontkit,create(...args){
 const font=fontkit.create(...args),createSubset=font.createSubset.bind(font);
 font.createSubset=()=>{const subset=createSubset();if(!font.directory.tables.glyf)return subset;const addGlyph=subset._addGlyph,encodeStream=subset.encodeStream;
  subset.encodeStream=function(){return normalizedSubsetStream(this,encodeStream)};
  if(typeof addGlyph!=='function')throw Error('PDF用フォントのサブセット処理に対応していません');
  subset._addGlyph=function(gid){const index=addGlyph.call(this,gid),data=this.glyf[index];if(data.length%2){const padded=data.constructor.alloc(data.length+1);padded.set(data);this.glyf[index]=padded;this.offset++}return index};return subset};return font;
}};
