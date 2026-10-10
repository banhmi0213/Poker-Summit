/** Display a region of the supplied design at any size without altering the source. */
export function ReferenceSlice({region,alt,className=""}: {region: readonly [number,number,number,number]; alt: string; className?: string}) {
  const [x,y,width,height]=region;
  return <svg className={`sd-reference-slice ${className}`} viewBox={`${x} ${y} ${width} ${height}`} preserveAspectRatio="xMidYMid slice" style={{aspectRatio:`${width}/${height}`}} role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}><image href="/store-detail-reference.webp" width="1277" height="875" /></svg>;
}
