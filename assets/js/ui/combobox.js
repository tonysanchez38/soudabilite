// =========================================================================
// combobox.js — liste déroulante à recherche (CLAUDE.md #11).
// Enrobe Choices.js (chargé via CDN). Repli gracieux : si Choices n'est pas
// disponible, le <select> natif reste fonctionnel (sans recherche).
// Aucune logique métier.
// =========================================================================

// Crée une combobox à partir d'un <select> existant.
// items : [{ value, label }]. placeholder : texte de recherche.
// Renvoie l'instance Choices, ou null si repli natif.
export function creerCombobox(selectEl, items, { placeholder = "" } = {}) {
  remplirSelectNatif(selectEl, items, placeholder);

  if (typeof window.Choices !== "function") {
    return null; // repli : select natif déjà rempli
  }

  const instance = new window.Choices(selectEl, {
    searchEnabled: true,
    searchResultLimit: 50,
    shouldSort: false, // on conserve l'ordre de la banque
    itemSelectText: "",
    placeholder: true,
    placeholderValue: placeholder,
    searchPlaceholderValue: placeholder,
    noResultsText: "Aucun résultat",
    noChoicesText: "Aucune option",
  });
  return instance;
}

// Remplit un <select> natif (utilisé aussi comme repli).
function remplirSelectNatif(selectEl, items, placeholder) {
  selectEl.replaceChildren();
  if (placeholder) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = placeholder;
    opt.disabled = true;
    opt.selected = true;
    selectEl.appendChild(opt);
  }
  for (const it of items) {
    const opt = document.createElement("option");
    opt.value = it.value;
    opt.textContent = it.label;
    selectEl.appendChild(opt);
  }
}

// Remplace la liste d'options d'une combobox (ex. apports filtrés par procédé).
// Gère les deux cas : instance Choices ou <select> natif.
export function majOptions(instance, selectEl, items, { placeholder = "" } = {}) {
  if (instance) {
    instance.clearStore();
    const choix = [];
    if (placeholder) {
      choix.push({ value: "", label: placeholder, placeholder: true, disabled: true });
    }
    for (const it of items) choix.push({ value: it.value, label: it.label });
    instance.setChoices(choix, "value", "label", true);
  } else {
    remplirSelectNatif(selectEl, items, placeholder);
  }
}
