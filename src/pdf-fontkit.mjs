import fontkit from '@pdf-lib/fontkit';

// fontkit 1.1.1 writes a short loca table for small TrueType subsets, but can
// concatenate odd-sized glyph records. Short loca offsets lose the last bit,
// which corrupts subsequent glyphs. Pad each record before encoding the table.
export const alignedFontkit={...fontkit,create(...args){
 const font=fontkit.create(...args),createSubset=font.createSubset.bind(font);
 font.createSubset=()=>{const subset=createSubset();if(!font.directory.tables.glyf)return subset;const addGlyph=subset._addGlyph;
  if(typeof addGlyph!=='function')throw Error('PDF用フォントのサブセット処理に対応していません');
  subset._addGlyph=function(gid){const index=addGlyph.call(this,gid),data=this.glyf[index];if(data.length%2){const padded=data.constructor.alloc(data.length+1);padded.set(data);this.glyf[index]=padded;this.offset++}return index};return subset};return font;
}};
