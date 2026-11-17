// Export the document's full placed background, independently for every page.
export function pageBox(project,screen){
 const b=screen.background;
 if(b){let x=b.x,y=b.y,width=b.w,height=b.h;if(b.pdf){const fit=Math.min(b.w/b.pdf.pageWidth,b.h/b.pdf.pageHeight);width=b.pdf.pageWidth*fit;height=b.pdf.pageHeight*fit;x+=(b.w-width)/2;y+=(b.h-height)/2}return {x,y,width,height,points:b.pdf?[b.pdf.pageWidth,b.pdf.pageHeight]:[width*.75,height*.75]}}
 const width=screen.canvasWidth||project.width,height=screen.canvasHeight||project.height;return {x:0,y:0,width,height};
}
