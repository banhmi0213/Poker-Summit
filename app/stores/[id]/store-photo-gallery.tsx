"use client";
import { useState } from "react";
import { ReferenceSlice } from "./reference-slice";
type Slide = {id:string; url?:string; region?:readonly [number,number,number,number]};
export function StorePhotoGallery({photos,name,reference=false}: {photos:{id:string;url:string}[];name:string;reference?:boolean}) {
  const [selected,setSelected]=useState(0);
  const slides:Slide[] = reference && photos.length <= 1 ? [
    {id:"reference-interior",region:[129,58,640,274]},
    ...(photos.length ? photos : [{id:"reference-logo",region:[291,344,150,77] as const}]),
    {id:"reference-room",region:[452,344,150,77]},
    {id:"reference-cards",region:[612,344,150,77]},
  ] : photos;
  if(!slides.length) return <div className="sd-photo-empty"><span aria-hidden="true">♠</span><p>店舗写真は準備中です</p></div>;
  const current=slides[Math.min(selected,slides.length-1)];
  const move=(step:number)=>setSelected(index=>(index+step+slides.length)%slides.length);
  const photo=(slide:Slide,alt:string)=>slide.region ? <ReferenceSlice region={slide.region} alt={alt} /> : <img src={slide.url} alt={alt} />;
  return <div className="sd-gallery"><div className="sd-gallery-main">{photo(current,`${name}の店舗イメージ ${selected+1}`)}
    {slides.length>1 && <><button type="button" className="sd-gallery-prev" aria-label="前の写真" onClick={()=>move(-1)}>‹</button><button type="button" className="sd-gallery-next" aria-label="次の写真" onClick={()=>move(1)}>›</button></>}
  </div>{slides.length>1 && <div className="sd-gallery-thumbs" aria-label="店舗写真を選択">{slides.map((slide,index)=><button key={slide.id} type="button" aria-pressed={selected===index} className={selected===index ? "is-selected":""} aria-label={`写真 ${index+1}を表示`} onClick={()=>setSelected(index)}>{photo(slide,"")}</button>)}</div>}</div>;
}
