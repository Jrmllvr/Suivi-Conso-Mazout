const ENTRY_KEY="suivi-consommation-entries";
const CONVERSION_KEY="suivi-consommation-conversion";
const DEFAULT_CONVERSION=16;

let entries=loadEntries();
let conversion=loadConversion();
let editingId=null;

const $=id=>document.getElementById(id);

function loadEntries(){
  try{
    const data=JSON.parse(localStorage.getItem(ENTRY_KEY)||"[]");
    if(!Array.isArray(data)) return [];
    // Compatibilité avec les anciennes versions : les anciennes entrées sont des relevés.
    return data.map(e=>({
      id:e.id??Date.now()+Math.random(),
      date:e.date,
      cm:Number(e.cm),
      type:e.type==="delivery"?"delivery":"reading",
      quantity:e.quantity!=null?Number(e.quantity):null
    })).filter(e=>/^\d{4}-\d{2}-\d{2}$/.test(e.date)&&Number.isFinite(e.cm));
  }catch{return []}
}
function saveEntries(){localStorage.setItem(ENTRY_KEY,JSON.stringify(entries))}
function loadConversion(){
  const value=Number(localStorage.getItem(CONVERSION_KEY));
  return Number.isFinite(value)&&value>0?value:DEFAULT_CONVERSION;
}
function saveConversion(){localStorage.setItem(CONVERSION_KEY,String(conversion))}
function litresFromCm(cm){return Number(cm)*conversion}
function fmt(value){return Number(value).toLocaleString("fr-BE",{maximumFractionDigits:2})}
function dateLabel(value){
  if(!value)return "";
  const [y,m,d]=value.split("-");
  return `${d}/${m}/${y}`;
}
function daysBetween(a,b){
  const start=new Date(`${a}T12:00:00`);
  const end=new Date(`${b}T12:00:00`);
  return Math.round((end-start)/86400000);
}

// Calcule la consommation de chaque relevé par rapport au relevé précédent.
// Une livraison casse la période de consommation, mais son niveau en cm devient
// le nouveau point de départ pour le relevé suivant.
function calculatedRows(){
  const sorted=[...entries].sort((a,b)=>a.date.localeCompare(b.date)||Number(a.id)-Number(b.id));
  let previous=null;
  return sorted.map(entry=>{
    let consumedLitres=null;
    let daily=null;
    if(entry.type==="reading" && previous){
      const days=daysBetween(previous.date,entry.date);
      const difference=Number(previous.cm)-Number(entry.cm);
      if(days>0 && difference>=0){
        consumedLitres=difference*conversion;
        daily=consumedLitres/days;
      }else if(days>0 && difference<0){
        // Une hausse sans événement de livraison : on ne transforme pas cela en consommation négative.
        consumedLitres=0;
        daily=0;
      }
    }
    previous=entry;
    return {...entry,consumedLitres,daily};
  });
}

function render(){
  const rows=calculatedRows();
  const latest=rows[rows.length-1];
  $("tankBalance").textContent=latest ? `${fmt(litresFromCm(latest.cm))} L` : "0 L";

  // Moyenne globale pondérée : total des litres consommés / total des jours
  // réellement couverts par les périodes de calcul. Une livraison coupe la
  // période précédente, mais la période entre la livraison et le relevé suivant
  // reste bien prise en compte.
  let totalConsumed=0;
  let totalDays=0;
  let previous=null;
  rows.forEach(row=>{
    if(row.type==="reading" && previous){
      const days=daysBetween(previous.date,row.date);
      const difference=Number(previous.cm)-Number(row.cm);
      if(days>0 && difference>=0){
        totalConsumed += difference*conversion;
        totalDays += days;
      }
    }
    previous=row;
  });
  const averageDaily=totalDays>0 ? totalConsumed/totalDays : 0;
  $("averageDaily").textContent=`Moyenne : ${fmt(averageDaily)} L/j`;

  // Totaux annuels : litres réellement consommés, affectés à la date du relevé.
  const years={};
  rows.forEach(row=>{
    if(row.type!=="reading" || row.consumedLitres==null)return;
    const year=row.date.slice(0,4);
    years[year]=(years[year]||0)+row.consumedLitres;
  });
  const yearKeys=Object.keys(years).sort((a,b)=>b.localeCompare(a));
  $("annualTotals").innerHTML=yearKeys.map(year=>`
    <div class="annual-row"><span>${year}</span><strong>${fmt(years[year])} L</strong></div>`).join("");
  $("annualEmpty").style.display=yearKeys.length?"none":"block";

  $("entriesBody").innerHTML=rows.map(entry=>{
    const consumption=entry.type==="delivery"?"Livraison":(entry.daily==null?"0 L/j":`${fmt(entry.daily)} L/j`);
    const deliveryClass=entry.type==="delivery"?" delivery-label":"";
    return `<tr>
      <td>${dateLabel(entry.date)}</td>
      <td>${fmt(entry.cm)}</td>
      <td class="${deliveryClass}">${consumption}</td>
      <td class="actions-cell">
        <button class="icon-btn" title="Modifier" aria-label="Modifier" data-action="edit" data-id="${entry.id}">✎</button>
        <button class="icon-btn" title="Supprimer" aria-label="Supprimer" data-action="delete" data-id="${entry.id}">×</button>
      </td>
    </tr>`;
  }).join("");
  $("entriesEmpty").style.display=rows.length?"none":"block";
  $("conversionInput").value=conversion;
}

function openEntryForm(existing=null){
  editingId=existing?.id??null;
  $("entryForm").classList.add("open");
  $("entryDate").value=existing?.date||new Date().toISOString().slice(0,10);
  $("entryType").value=existing?.type||"reading";
  $("entryCm").value=existing?.cm??"";
  $("entryQuantity").value=existing?.quantity??"";
  updateQuantityVisibility();
  $("entryCm").focus();
}
function closeEntryForm(){
  editingId=null;
  $("entryForm").classList.remove("open");
}
function updateQuantityVisibility(){
  $("quantityField").classList.toggle("hidden",$("entryType").value!=="delivery");
}

$("addEntryBtn").onclick=()=>openEntryForm();
$("cancelEntry").onclick=closeEntryForm;
$("entryType").onchange=updateQuantityVisibility;
$("entryForm").addEventListener("submit",e=>{
  e.preventDefault();
  const date=$("entryDate").value;
  const type=$("entryType").value;
  const cm=Number($("entryCm").value);
  const quantity=Number($("entryQuantity").value);
  if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(cm)||cm<0){
    alert("Veuillez entrer une date et un relevé en cm valides.");return;
  }
  if(type==="delivery" && (!Number.isFinite(quantity)||quantity<=0)){
    alert("Veuillez entrer une quantité de livraison supérieure à 0 L.");return;
  }
  if(editingId!=null){
    const item=entries.find(x=>String(x.id)===String(editingId));
    if(item){item.date=date;item.type=type;item.cm=cm;item.quantity=type==="delivery"?quantity:null;}
  }else{
    entries.push({id:Date.now()+Math.random(),date,type,cm,quantity:type==="delivery"?quantity:null});
  }
  saveEntries();render();closeEntryForm();
});

$("entriesBody").onclick=e=>{
  const button=e.target.closest("[data-action]");
  if(!button)return;
  const entry=entries.find(x=>String(x.id)===String(button.dataset.id));
  if(!entry)return;
  if(button.dataset.action==="edit")openEntryForm(entry);
  if(button.dataset.action==="delete"&&confirm("Supprimer cette entrée ?")){
    entries=entries.filter(x=>String(x.id)!==String(entry.id));
    saveEntries();render();
  }
};

$("saveConversion").onclick=()=>{
  const value=Number($("conversionInput").value);
  if(!Number.isFinite(value)||value<=0){alert("La conversion doit être supérieure à 0.");return}
  conversion=value;saveConversion();render();
};
$("conversionInput").onkeydown=e=>{if(e.key==="Enter")$("saveConversion").click()};

$("exportBtn").onclick=()=>{
  if(typeof XLSX==="undefined"){alert("Le module Excel n'est pas disponible.");return}
  const rows=calculatedRows().map(e=>({
    Date:e.date,
    Relevé:e.cm,
    Type:e.type==="delivery"?"Livraison":"Relevé",
    "Livraison (L)":e.type==="delivery"?e.quantity:"",
    "Consommation (L/j)":e.type==="delivery"?"Livraison":(e.daily==null?0:e.daily)
  }));
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
        let cm=row.Relevé??row["Relevé (cm)"]??row.cm??row.Cm??row.CM;
        const typeValue=String(row.Type||row.type||"").toLowerCase();
        const type=typeValue.includes("livraison")?"delivery":"reading";
        const quantity=Number(row["Livraison (L)"]??row.Livraison??"");
        if(typeof date==="number"){
          const p=XLSX.SSF.parse_date_code(date);
          date=p?`${p.y}-${String(p.m).padStart(2,"0")}-${String(p.d).padStart(2,"0")}`:"";
        }
        return {id:Date.now()+i,date:String(date),cm:Number(cm),type,quantity:type==="delivery"?quantity:null};
      }).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&Number.isFinite(x.cm)&&(x.type!=="delivery"||Number.isFinite(x.quantity)&&x.quantity>0));
      if(!imported.length){alert("Aucune entrée valide trouvée.");return}
      entries=imported;saveEntries();render();
    }catch{alert("Impossible de lire le fichier Excel.")}
    finally{e.target.value=""}
  };
  reader.readAsArrayBuffer(file);
};

const scrollTop=$("scrollTop");
window.addEventListener("scroll",()=>scrollTop.classList.toggle("visible",window.scrollY>250));
scrollTop.onclick=()=>window.scrollTo({top:0,behavior:"smooth"});

render();
