export function captureBounds(a,b,width,height){
 const x=Math.max(0,Math.min(width,Math.min(a[0],b[0]))),y=Math.max(0,Math.min(height,Math.min(a[1],b[1]))),w=Math.min(width,Math.max(a[0],b[0]))-x,h=Math.min(height,Math.max(a[1],b[1]))-y;
 if(![x,y,w,h].every(Number.isFinite)||w<1||h<1)throw Error('1px以上の範囲を指定してください');return {x,y,w,h};
}
