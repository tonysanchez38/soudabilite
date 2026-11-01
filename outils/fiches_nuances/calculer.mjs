import fs from "fs";
const R=process.argv[2], OUT=process.argv[3];
const imp=(p)=>import("file://"+R+"/assets/js/core/"+p);
const {joint,plageDilution,dilutionParDefaut}=await imp("dilution.js");
const {ferriteSchaeffler,niveauIdeal,classifieZone}=await imp("schaeffler.js");
const {meilleursApports}=await imp("selection_apport.js");
const {estDuplex}=await imp("perimetre.js");
const {aiguille}=await imp("aiguillage.js");
const {crEqSchaeffler,niEqSchaeffler}=await imp("equivalents.js");
const C=await imp("carbone_eq.js");
const D=JSON.parse(fs.readFileSync(R+"/assets/data/data.json","utf8"));
const Z=JSON.parse(fs.readFileSync(R+"/assets/data/zones_schaeffler.json","utf8"));
const clean=c=>Object.fromEntries(Object.entries(c).map(([k,v])=>[k,v??0]));
const norm=s=>s.replace(/\s+/g," ").trim();
const find=n=>{const x=D.metaux_base.find(b=>norm(b.designation)===n); if(!x) throw new Error(n); return x;};
const ap=D.metaux_apport.filter(a=>!estDuplex(a.designation)).map(a=>({...a,composition:clean(a.composition)}));
function classe(A,B,proc){
  const d=dilutionParDefaut(proc,"BW","V");
  return meilleursApports(ap,proc,{A,B,dA:d.dA/100,dB:d.dB/100,dC:d.dC/100,centre:Z.centre_ideal,joint,crEq:crEqSchaeffler,niEq:niEqSchaeffler,ferrite:ferriteSchaeffler,niveauIdeal,zones:Z.zones,zoneS:Z.zone_s,plageDilution:plageDilution(proc),n:3})
   .map(r=>({designation:r.designation,niveau:r.analysePlage.niveauPire,ideal:Math.round(r.analysePlage.couvertureIdeale),ferrite:r.ferrite==null?null:+r.ferrite.toFixed(1),cr:+r.crEq.toFixed(2),ni:+r.niEq.toFixed(2)}));
}
const S235=clean(find("S 235 JR (E 24-2)").composition), L316=clean(find("316 L (Z 2 CN 18.12)").composition);
const liste=JSON.parse(process.argv[4]);
const out=[];
for (const g of liste){
  const x=find(g.designation); const c=clean(x.composition);
  const cr=crEqSchaeffler(c), ni=niEqSchaeffler(c);
  const type=aiguille(c,c).type;
  const r={...g,composition:Object.fromEntries(Object.entries(x.composition).filter(([k,v])=>v!=null&&v!==0)),
    crEq:+cr.toFixed(2),niEq:+ni.toFixed(2),zone:classifieZone(cr,ni,Z.zones),type};
  if(type==="carbone"){
    r.ceIIW=+C.ceIIW(c).toFixed(3); r.cet=+C.cet(c).toFixed(3); r.ceqSef=+C.ceqSeferian(c).toFixed(3);
    r.tp=[10,20,30].map(e=>{const t=C.tpSeferian(C.ceqSeferianCompense(c,e));return {e,ceqc:+C.ceqSeferianCompense(c,e).toFixed(3),tp:t==null?null:Math.round(t)};});
    r.hetero=classe(c,L316,"141"); r.heteroAvec="316L";
  } else {
    r.homo=classe(c,c,"141"); r.hetero=classe(S235,c,"141"); r.heteroAvec="S235JR";
  }
  out.push(r);
}
fs.writeFileSync(OUT,JSON.stringify(out,null,1));
for(const r of out) console.log(r.slug,r.type,r.zone,r.crEq,r.niEq,r.ceIIW??"",r.tp?r.tp.map(t=>t.tp).join("/"):"",(r.homo||[]).map(h=>h.designation+":"+h.niveau).join(" ; "),"|",r.hetero.map(h=>h.designation+":"+h.niveau+":"+h.ideal).join(" ; "));
