const ENTRY_KEY="suivi-consommation-entries";
const CONVERSION_KEY="suivi-consommation-conversion";
const DEFAULT_CONVERSION=16;

let entries=loadEntries();
let conversion=loadConversion();

const $=id=>document.getElementById(id);

function loadEntries(){
  try{
    const data=JSON.parse(localStorage.getItem(ENTRY_KEY)||"[]");
    return Array.isArray(data)?data:[];
  }catch{return []}
}
function saveEntries(){localStorage.setItem(ENTRY_KEY,JSON.stringify(entries))}
function loadConversion(){
  const value=Number(localStorage.getItem(CONVERSION_KEY));
  return Number.isFinite(value)&&value>0?value:DEFAULT_CONVERSION;
}
function saveConversion(){localStorage.setItem(CONVERSION_KEY,String(conversion))}
function litres(cm){return Number(cm)*conversion}
function fmt(value){return Number(value).toLocaleString("fr-BE",{maximumFractionDigits:2})}
function dateLabel(value){
  if(!value)return "";
  const [y,m,d]=value.split("-");
  return `${d}/${m}/${y}`;
}

/* Le solde est calculé à partir du dernier relevé.
   Le dernier relevé correspond au niveau restant dans la citerne. */
function render(){
  const sorted=[...entries].sort((a,b)=>a.date.localeCompare(b.date));
  const latest=sorted[sorted.length-1];

  $("tankBalance").textContent=latest ? `${fmt(litres(latest.cm))} L` : "0 L";

  const years={};
  sorted.forEach(entry=>{
    const year=entry.date.slice(0,4);
    years[year]=(years[year]||0)+litres(entry.cm);
  });
  const yearKeys=Object.keys(years).sort((a,b)=>b.localeCompare(a));
  $("annualTotals").innerHTML=yearKeys.map(year=>`
    <div class="annual-row">
      <span>${year}</span>
      <strong>${fmt(years[year])} L</strong>
    </div>`).join("");
  $("annualEmpty").style.display=yearKeys.length?"none":"block";

  $("entriesBody").innerHTML=sorted.map(entry=>`
    <tr>
      <td>${dateLabel(entry.date)}</td>
      <td>${fmt(entry.cm)}</td>
      <td>${fmt(litres(entry.cm))} L</td>
      <td>
        <button class="action" data-action="edit" data-id="${entry.id}">Modifier</button>
        <button class="action" data-action="delete" data-id="${entry.id}">Supprimer</button>
      </td>
    </tr>`).join("");
  $("entriesEmpty").style.display=sorted.length?"none":"block";
  $("conversionInput").value=conversion;
}

function openEntryForm(existing){
  const date=prompt("Date du relevé (AAAA-MM-JJ) :",existing?.date||new Date().toISOString().slice(0,10));
  if(date===null)return;
  const cm=prompt("Relevé en cm :",existing?.cm??"");
  if(cm===null)return;
  const value=Number(cm);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(value)||value<0){
    alert("Veuillez entrer une date valide et un relevé en cm valide.");
    return;
  }
  if(existing){
    existing.date=date; existing.cm=value;
  }else{
    entries.push({id:Date.now(),date,cm:value});
  }
  saveEntries();render();
}

$("addEntryBtn").onclick=()=>openEntryForm(null);

$("entriesBody").onclick=e=>{
  const button=e.target.closest("[data-action]");
  if(!button)return;
  const entry=entries.find(x=>String(x.id)===String(button.dataset.id));
  if(!entry)return;
  if(button.dataset.action==="edit")openEntryForm(entry);
  if(button.dataset.action==="delete" && confirm("Supprimer ce relevé ?")){
    entries=entries.filter(x=>String(x.id)!==String(entry.id));
    saveEntries();render();
  }
};

$("saveConversion").onclick=()=>{
  const value=Number($("conversionInput").value);
  if(!Number.isFinite(value)||value<=0){
    alert("La conversion doit être supérieure à 0.");
    return;
  }
  conversion=value;
  saveConversion();
  render();
};

$("conversionInput").onkeydown=e=>{
  if(e.key==="Enter")$("saveConversion").click();
};

$("exportBtn").onclick=()=>{
  if(typeof XLSX==="undefined"){alert("Le module Excel n'est pas disponible.");return}
  const rows=entries.map(e=>({Date:e.date,"Relevé (cm)":e.cm,"Litres":litres(e.cm)}));
  const ws=XLSX.utils.json_to_sheet(rows);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"Relevés");
  XLSX.writeFile(wb,"suivi-consommation.xlsx");
};

$("importBtn").onclick=()=>$("fileInput").click();

$("fileInput").onchange=e=>{
  const file=e.target.files[0];
  if(!file)return;
  if(typeof XLSX==="undefined"){alert("Le module Excel n'est pas disponible.");return}
  const reader=new FileReader();
  reader.onload=event=>{
    try{
      const wb=XLSX.read(event.target.result,{type:"array"});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:""});
      const imported=rows.map((row,i)=>{
        let date=row.Date||row.date||"";
        let cm=row["Relevé (cm)"]??row.cm??row.Cm??row.CM;
        if(typeof date==="number"){
          const p=XLSX.SSF.parse_date_code(date);
          date=p?`${p.y}-${String(p.m).padStart(2,"0")}-${String(p.d).padStart(2,"0")}`:"";
        }
        return {id:Date.now()+i,date:String(date),cm:Number(cm)};
      }).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&Number.isFinite(x.cm));
      if(!imported.length){alert("Aucun relevé valide trouvé.");return}
      entries=imported;
      saveEntries();render();
    }catch{alert("Impossible de lire le fichier Excel.")}
    finally{e.target.value=""}
  };
  reader.readAsArrayBuffer(file);
};

const scrollTop=$("scrollTop");
window.addEventListener("scroll",()=>scrollTop.classList.toggle("visible",window.scrollY>250));
scrollTop.onclick=()=>window.scrollTo({top:0,behavior:"smooth"});

render();
