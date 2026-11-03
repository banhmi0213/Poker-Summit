/** Spreadsheet formula injection prevention; preserve names as text. */
export function statisticsCSV(rows:readonly (readonly unknown[])[]){return '\ufeff'+rows.map(row=>row.map(value=>{let s=String(value??'');if(/^[\s\u0000-\u001f]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n');}
