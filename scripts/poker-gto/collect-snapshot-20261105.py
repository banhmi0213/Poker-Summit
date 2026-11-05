import json, subprocess, zipfile, io, pathlib, concurrent.futures
m=json.loads(pathlib.Path("data/poker-gto/fit-work/partial-20261106-0505.json").read_text())
def collect(item):
 spot,a=item
 data=subprocess.check_output(["gh","api",f"repos/banhmi0213/Poker-Summit/actions/artifacts/{a['id']}/zip"])
 with zipfile.ZipFile(io.BytesIO(data)) as z:
  files=[n for n in z.namelist() if n.endswith(spot+"/"+a["flop"]+".json")]
  assert len(files)==1, (a,files)
  raw=z.read(files[0]); d=json.loads(raw)
  assert d["version"]==3 and d["iterations"]==250 and d.get("handEv"), a
  target=pathlib.Path("public/poker-gto/flops")/spot/(a["flop"]+".json")
  target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
 return spot
items=[(b["spot"],a) for b in m["batches"] for a in b["selected"]]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: results=list(pool.map(collect,items))
print({s:results.count(s) for s in set(results)})
