const STORAGE_KEY="suivi-consommation-entries";
const CONVERSION_KEY="suivi-consommation-conversion";
const DEFAULT_CONVERSION=16;
let entries=loadEntries();
let conversion=loadConversion();
const $=id=>document.getElementById(id);

function loadEntries(){try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");return Array.isArray(x)?x:[]}catch{return[]}}
function saveEntries(){localStorage.setItem(STORAGE_KEY,JSON.stringify(entries))}
function loadConversion(){const x=Number(localStorage.getItem(CONVERSION_KEY));return Number.isFinite(x)&&x>0?x:DEFAULT_CONVERSION}
function saveConversion(){localStorage.setItem(CONVERSION_KEY,String(conversion))}
function litresFromCm(cm){return Number(cm)*conversion}
function fmt(x){return Number(x).toLocaleString("fr-BE",{maximumFractionDigits:2})}
function formatDate(s){if(!s)return"";const[a,b,c]=s.split("-");return`${c}/${b}/${a}`}

function render(){
  $("conversionInput").value=conversion;
  $("conversionDisplay").textContent=`1 cm = ${fmt(conversion)} L`;
  const sorted=[...entries].sort((a,b)=>a.date.localeCompare(b.date));
  $("entriesBody").innerHTML="";
  $("emptyMessage").style.display=sorted.length?"none":"block";
  let total=0, years={};
  sorted.forEach(e=>{
    const l=litresFromCm(e.cm); total+=l;
    const y=e.date?e.date.slice(0,4):"Sans date"; years[y]=(years[y]||0)+l;
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${formatDate(e.date)}</td><td>${fmt(e.cm)}</td><td>${fmt(l)} L</td><td><button class="secondary action-btn" data-action="edit" data-id="${e.id}">Modifier</button><button class="secondary action-btn" data-action="delete" data-id="${e.id}">Supprimer</button></td>`;
    $("entriesBody").appendChild(tr);
  });
  $("grandTotal").textContent=`${fmt(total)} L`;
  $("entryCount").textContent=entries.length;
  const ys=Object.keys(years).sort((a,b)=>b.localeCompare(a));
  $("yearlyTotals").innerHTML=ys.length?ys.map(y=>`<div class="year-row"><span>${y}</span><strong>${fmt(years[y])} L</strong></div>`).join(""):`<p class="empty">Aucun relevé enregistré.</p>`;
}

function openForm(e=null){
  $("formCard").classList.remove("hidden");
  if(e){$("formTitle").textContent="Modifier un relevé";$("editId").value=e.id;$("dateInput").value=e.date;$("cmInput").value=e.cm}
  else{$("formTitle").textContent="Ajouter un relevé";$("editId").value="";$("dateInput").value=new Date().toISOString().slice(0,10);$("cmInput").value=""}
  $("cmInput").focus();$("formCard").scrollIntoView({behavior:"smooth",block:"center"});
}
function closeForm(){$("formCard").classList.add("hidden");$("editId").value="";$("dateInput").value="";$("cmInput").value=""}

$("addBtn").onclick=()=>openForm();
$("cancelBtn").onclick=closeForm;

$("saveEntryBtn").onclick=()=>{
  const date=$("dateInput").value,cm=Number($("cmInput").value),id=$("editId").value;
  if(!date||!Number.isFinite(cm)||cm<0){alert("Veuillez compléter correctement la date et le relevé en cm.");return}
  if(id){const e=entries.find(x=>String(x.id)===String(id));if(e){e.date=date;e.cm=cm}}
  else entries.push({id:Date.now(),date,cm});
  saveEntries();render();closeForm();
};

$("entriesBody").onclick=e=>{
  const b=e.target.closest("button[data-action]");if(!b)return;
  const id=b.dataset.id,entry=entries.find(x=>String(x.id)===String(id));if(!entry)return;
  if(b.dataset.action==="edit")openForm(entry);
  if(b.dataset.action==="delete"&&confirm("Supprimer ce relevé ?")){entries=entries.filter(x=>String(x.id)!==String(id));saveEntries();render()}
};

$("saveConversionBtn").onclick=()=>{
  const v=Number($("conversionInput").value);
  if(!Number.isFinite(v)||v<=0){alert("Veuillez entrer une valeur supérieure à 0.");return}
  conversion=v;saveConversion();render();
};
$("conversionInput").onkeydown=e=>{if(e.key==="Enter")$("saveConversionBtn").click()};

$("exportBtn").onclick=()=>{
  if(typeof XLSX==="undefined"){alert("Le module Excel n'est pas disponible.");return}
  const data=entries.map(e=>({Date:e.date,cm:e.cm,Litres:litresFromCm(e.cm)}));
  const ws=XLSX.utils.json_to_sheet(data),wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"Relevés");XLSX.writeFile(wb,"suivi-consommation.xlsx");
};
$("importBtn").onclick=()=>$("fileInput").click();
$("fileInput").onchange=e=>{
  const file=e.target.files[0];if(!file||typeof XLSX==="undefined")return;
  const r=new FileReader();
  r.onload=ev=>{
    try{
      const wb=XLSX.read(ev.target.result,{type:"array"}),ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:""});
      const imported=rows.map((row,i)=>{
        let d=row.Date??row.date??"";
        if(typeof d==="number"){const p=XLSX.SSF.parse_date_code(d);if(p)d=`${p.y}-${String(p.m).padStart(2,"0")}-${String(p.d).padStart(2,"0")}`}
        return{id:Date.now()+i,date:String(d),cm:Number(row.cm??row.Cm??row.CM??row["Relevé en cm"])}
      }).filter(x=>x.date&&Number.isFinite(x.cm));
      if(!imported.length){alert("Aucun relevé exploitable trouvé dans le fichier.");return}
      entries=imported;saveEntries();render();alert(`${imported.length} relevé(s) importé(s).`);
    }catch(err){console.error(err);alert("Impossible de lire le fichier Excel.")}finally{e.target.value=""}
  };
  r.readAsArrayBuffer(file);
};

const scrollTopBtn=$("scrollTopBtn");
window.addEventListener("scroll",()=>scrollTopBtn.classList.toggle("visible",window.scrollY>300));
scrollTopBtn.onclick=()=>window.scrollTo({top:0,behavior:"smooth"});
render();
