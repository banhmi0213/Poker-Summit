import type { CSSProperties } from "react";
/** Display an asset region from the user-supplied design without altering it. */
export function ReferenceSlice({region,alt,className=""}: {region: readonly [number,number,number,number]; alt: string; className?: string}) {
  const [x,y,width,height]=region;
  const style: CSSProperties = {width:`${1277/width*100}%`, maxWidth:"none", height:"auto", left:`${-x/width*100}%`, top:`${-y/height*100}%`, position:"absolute"};
  return <span className={`sd-reference-slice ${className}`} style={{aspectRatio:`${width}/${height}`}}><img src="/store-detail-reference.png" alt={alt} style={style} /></span>;
}
